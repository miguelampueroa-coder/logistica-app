// Real-time tracking service for shipments.
// Uses Supabase Realtime for WebSocket-based GPS updates.
// Providers report location, clients see live position on map.

import { getSupabaseAdmin } from '../config/database.js';

export interface LocationUpdate {
  shipmentId: string;
  providerId: string;
  lat: number;
  lng: number;
  speed?: number; // km/h
  heading?: number; // degrees
  accuracy?: number; // meters
  timestamp: string;
}

export interface TrackingState {
  shipmentId: string;
  status: string;
  provider: {
    id: string;
    name: string;
    phone: string;
    vehicleType: string;
    vehiclePlate: string;
  } | null;
  currentLocation: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    updatedAt: string;
  } | null;
  origin: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  estimatedArrival: string | null;
  route: {
    distanceKm: number;
    durationMin: number;
    polyline?: string;
  } | null;
  lastUpdates: LocationUpdate[];
}

export class TrackingService {
  private locationBuffer = new Map<string, LocationUpdate[]>();
  private readonly BUFFER_MAX = 100;

  /**
   * Report a provider's GPS location.
   * Stores in buffer and persists to DB periodically.
   */
  async reportLocation(update: LocationUpdate): Promise<void> {
    const supabase = getSupabaseAdmin();

    // Store in memory buffer
    const buffer = this.locationBuffer.get(update.shipmentId) || [];
    buffer.push(update);
    if (buffer.length > this.BUFFER_MAX) buffer.shift();
    this.locationBuffer.set(update.shipmentId, buffer);

    // Upsert current location
    await supabase
      .from('shipments')
      .update({
        current_lat: update.lat,
        current_lng: update.lng,
        last_location_at: update.timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', update.shipmentId);

    // Store location history
    await supabase.from('location_history').insert({
      shipment_id: update.shipmentId,
      provider_id: update.providerId,
      lat: update.lat,
      lng: update.lng,
      speed: update.speed,
      heading: update.heading,
      accuracy: update.accuracy,
      timestamp: update.timestamp,
    });
  }

  /**
   * Get current tracking state for a shipment.
   */
  async getTrackingState(shipmentId: string): Promise<TrackingState | null> {
    const supabase = getSupabaseAdmin();

    const { data: shipment, error } = await supabase
      .from('shipments')
      .select(`
        id, status, current_lat, current_lng, last_location_at,
        origin_address, origin_lat, origin_lng,
        dest_address, dest_lat, dest_lng,
        distance_km, picked_up_at, delivered_at,
        estimated_minutes,
        provider_id,
        users!shipments_provider_id_fkey (id, name, phone),
        vehicles!shipments_vehicle_id_fkey (type, plate)
      `)
      .eq('id', shipmentId)
      .single();

    if (error || !shipment) return null;

    // Get last 10 location updates
    const { data: locationHistory } = await supabase
      .from('location_history')
      .select('lat, lng, speed, heading, accuracy, timestamp')
      .eq('shipment_id', shipmentId)
      .order('timestamp', { ascending: false })
      .limit(10);

    const lastUpdates: LocationUpdate[] = (locationHistory || []).map((l: Record<string, unknown>) => ({
      shipmentId,
      providerId: String(shipment.provider_id || ''),
      lat: Number(l.lat),
      lng: Number(l.lng),
      speed: l.speed != null ? Number(l.speed) : undefined,
      heading: l.heading != null ? Number(l.heading) : undefined,
      accuracy: l.accuracy != null ? Number(l.accuracy) : undefined,
      timestamp: String(l.timestamp),
    }));

    const usersData = shipment.users as unknown as Record<string, unknown> | null;
    const vehiclesData = shipment.vehicles as unknown as Record<string, unknown> | null;

    return {
      shipmentId,
      status: shipment.status,
      provider: usersData ? {
        id: String(shipment.provider_id),
        name: String(usersData.name || ''),
        phone: String(usersData.phone || ''),
        vehicleType: String(vehiclesData?.type || ''),
        vehiclePlate: String(vehiclesData?.plate || ''),
      } : null,
      currentLocation: shipment.current_lat ? {
        lat: shipment.current_lat,
        lng: shipment.current_lng,
        speed: lastUpdates[0]?.speed || 0,
        heading: lastUpdates[0]?.heading || 0,
        updatedAt: shipment.last_location_at,
      } : null,
      origin: {
        lat: shipment.origin_lat,
        lng: shipment.origin_lng,
        address: shipment.origin_address,
      },
      destination: {
        lat: shipment.dest_lat,
        lng: shipment.dest_lng,
        address: shipment.dest_address,
      },
      estimatedArrival: shipment.estimated_minutes
        ? new Date(Date.now() + shipment.estimated_minutes * 60000).toISOString()
        : null,
      route: shipment.distance_km ? {
        distanceKm: shipment.distance_km,
        durationMin: shipment.estimated_minutes || 0,
      } : null,
      lastUpdates,
    };
  }

  /**
   * Get all active shipments being tracked.
   */
  async getActiveTrackings(providerId?: string): Promise<TrackingState[]> {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('shipments')
      .select('id')
      .in('status', ['accepted', 'in_transit'])
      .not('provider_id', 'is', null);

    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    const { data: shipments } = await query;

    if (!shipments) return [];

    const trackings: TrackingState[] = [];
    for (const s of shipments) {
      const state = await this.getTrackingState(s.id);
      if (state) trackings.push(state);
    }

    return trackings;
  }

  /**
   * Calculate ETA based on current location and route.
   */
  calculateETA(
    currentLat: number,
    currentLng: number,
    destLat: number,
    destLng: number,
    speedKmh: number = 30
  ): number {
    // Haversine distance
    const R = 6371;
    const dLat = (destLat - currentLat) * Math.PI / 180;
    const dLng = (destLng - currentLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(currentLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // ETA in minutes
    return Math.round((distanceKm / speedKmh) * 60);
  }
}
