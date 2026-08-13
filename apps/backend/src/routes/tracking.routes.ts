import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { TrackingService } from '../services/tracking.service.js';
import { createMapsService } from '../services/maps.service.js';
import { broadcastLocationUpdate } from '../services/tracking-event-emitter.js';

const router = Router();
const trackingService = new TrackingService();
const mapsService = createMapsService();

// POST /api/tracking/:shipmentId/location — Provider reports GPS location
router.post('/:shipmentId/location', authenticate, async (req: Request, res: Response) => {
  try {
    const providerId = req.user!.userId;
    const { shipmentId } = req.params;
    const { lat, lng, speed, heading, accuracy } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const supabase = getSupabaseAdmin();

    // Verify provider owns this shipment
    const { data: shipment } = await supabase
      .from('shipments')
      .select('id, provider_id, status, dest_lat, dest_lng')
      .eq('id', shipmentId)
      .single();

    if (!shipment || shipment.provider_id !== providerId) {
      res.status(403).json({ error: 'Not authorized to track this shipment' });
      return;
    }

    // Report location
    const timestamp = new Date().toISOString();
    await trackingService.reportLocation({
      shipmentId,
      providerId,
      lat,
      lng,
      speed,
      heading,
      accuracy,
      timestamp,
    });

    // Broadcast to WebSocket subscribers in real-time (replaces 15s polling)
    broadcastLocationUpdate(shipmentId, providerId, lat, lng, speed, heading);

    // Calculate ETA
    const eta = trackingService.calculateETA(
      lat, lng,
      shipment.dest_lat, shipment.dest_lng,
      speed || 30
    );

    // Update estimated minutes
    await supabase
      .from('shipments')
      .update({ estimated_minutes: eta })
      .eq('id', shipmentId);

    res.json({ message: 'Location reported', eta });
  } catch (error) {
    console.error('[Tracking] Report location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tracking/active — Get all active trackings (admin/provider)
// Debe ir antes de /:shipmentId, que si no captura "active" como id.
router.get('/active', authenticate, async (req: Request, res: Response) => {
  try {
    const trackings = await trackingService.getActiveTrackings();
    res.json({ trackings, count: trackings.length });
  } catch (error) {
    console.error('[Tracking] Get active error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tracking/:shipmentId — Get tracking state for a shipment
router.get('/:shipmentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;

    const state = await trackingService.getTrackingState(shipmentId);
    if (!state) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    res.json({ tracking: state });
  } catch (error) {
    console.error('[Tracking] Get state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tracking/:shipmentId/route — Calculate route for a shipment
router.post('/:shipmentId/route', authenticate, async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const supabase = getSupabaseAdmin();

    const { data: shipment } = await supabase
      .from('shipments')
      .select('origin_lat, origin_lng, dest_lat, dest_lng')
      .eq('id', shipmentId)
      .single();

    if (!shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const route = await mapsService.getRoute(
      { lat: shipment.origin_lat, lng: shipment.origin_lng },
      { lat: shipment.dest_lat, lng: shipment.dest_lng }
    );

    res.json({ route });
  } catch (error) {
    console.error('[Tracking] Route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tracking/geocode — Geocode an address
router.post('/geocode', authenticate, async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    if (!address) {
      res.status(400).json({ error: 'address is required' });
      return;
    }

    const results = await mapsService.geocode(address);
    res.json({ results });
  } catch (error) {
    console.error('[Tracking] Geocode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tracking/reverse-geocode — Reverse geocode coordinates
router.post('/reverse-geocode', authenticate, async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const result = await mapsService.reverseGeocode(lat, lng);
    res.json({ result });
  } catch (error) {
    console.error('[Tracking] Reverse geocode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
