// Google Maps / Distance Matrix service.
// Provides geocoding, directions, distance matrix, and ETA calculations.

export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
  placeId?: string;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  durationText: string;
  distanceText: string;
  polyline?: string;
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  startLocation: MapLocation;
  endLocation: MapLocation;
}

export interface DistanceMatrixElement {
  distanceKm: number;
  durationMin: number;
  distanceText: string;
  durationText: string;
}

export interface MapsService {
  geocode(address: string): Promise<MapLocation[]>;
  reverseGeocode(lat: number, lng: number): Promise<MapLocation | null>;
  getRoute(origin: MapLocation, destination: MapLocation): Promise<RouteResult>;
  getDistanceMatrix(origins: MapLocation[], destinations: MapLocation[]): Promise<DistanceMatrixElement[][]>;
  searchPlaces(query: string, location?: MapLocation, radiusMeters?: number): Promise<MapLocation[]>;
}

/**
 * Google Maps implementation.
 * Requires GOOGLE_MAPS_API_KEY environment variable.
 */
export class GoogleMapsService implements MapsService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async geocode(address: string): Promise<MapLocation[]> {
    const params = new URLSearchParams({
      address,
      key: this.apiKey,
      language: 'es',
      region: 'cl',
    });

    const response = await fetch(`${this.baseUrl}/geocode/json?${params}`);
    if (!response.ok) return [];

    const data = await response.json() as { results: Array<{
      geometry: { location: { lat: number; lng: number } };
      formatted_address: string;
      place_id: string;
    }> };

    return data.results.map(r => ({
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      address: r.formatted_address,
      placeId: r.place_id,
    }));
  }

  async reverseGeocode(lat: number, lng: number): Promise<MapLocation | null> {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: this.apiKey,
      language: 'es',
    });

    const response = await fetch(`${this.baseUrl}/geocode/json?${params}`);
    if (!response.ok) return null;

    const data = await response.json() as { results: Array<{
      geometry: { location: { lat: number; lng: number } };
      formatted_address: string;
      place_id: string;
    }> };

    if (data.results.length === 0) return null;

    const r = data.results[0];
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      address: r.formatted_address,
      placeId: r.place_id,
    };
  }

  async getRoute(origin: MapLocation, destination: MapLocation): Promise<RouteResult> {
    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key: this.apiKey,
      language: 'es',
      units: 'metric',
      alternatives: 'false',
    });

    const response = await fetch(`${this.baseUrl}/directions/json?${params}`);
    if (!response.ok) {
      return { distanceKm: 0, durationMin: 0, durationText: '', distanceText: '', steps: [] };
    }

    const data = await response.json() as {
      routes: Array<{
        legs: Array<{
          distance: { value: number; text: string };
          duration: { value: number; text: string };
          steps: Array<{
            html_instructions: string;
            distance: { value: number };
            duration: { value: number };
            start_location: { lat: number; lng: number };
            end_location: { lat: number; lng: number };
          }>;
        }>;
        overview_polyline?: { points: string };
      }>;
    };

    if (data.routes.length === 0) {
      return { distanceKm: 0, durationMin: 0, durationText: '', distanceText: '', steps: [] };
    }

    const leg = data.routes[0].legs[0];
    return {
      distanceKm: Math.round(leg.distance.value / 100) / 10,
      durationMin: Math.round(leg.duration.value / 60),
      durationText: leg.duration.text,
      distanceText: leg.distance.text,
      polyline: data.routes[0].overview_polyline?.points,
      steps: leg.steps.map(s => ({
        instruction: s.html_instructions.replace(/<[^>]*>/g, ''),
        distanceMeters: s.distance.value,
        durationSeconds: s.duration.value,
        startLocation: { lat: s.start_location.lat, lng: s.start_location.lng },
        endLocation: { lat: s.end_location.lat, lng: s.end_location.lng },
      })),
    };
  }

  async getDistanceMatrix(
    origins: MapLocation[],
    destinations: MapLocation[]
  ): Promise<DistanceMatrixElement[][]> {
    const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
    const destsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

    const params = new URLSearchParams({
      origins: originsStr,
      destinations: destsStr,
      key: this.apiKey,
      language: 'es',
      units: 'metric',
    });

    const response = await fetch(`${this.baseUrl}/distancematrix/json?${params}`);
    if (!response.ok) return [];

    const data = await response.json() as {
      rows: Array<{
        elements: Array<{
          distance: { value: number; text: string };
          duration: { value: number; text: string };
          status: string;
        }>;
      }>;
    };

    return data.rows.map(row =>
      row.elements.map(el => ({
        distanceKm: Math.round(el.distance.value / 100) / 10,
        durationMin: Math.round(el.duration.value / 60),
        distanceText: el.distance.text,
        durationText: el.duration.text,
      }))
    );
  }

  async searchPlaces(
    query: string,
    location?: MapLocation,
    radiusMeters: number = 50000
  ): Promise<MapLocation[]> {
    const params = new URLSearchParams({
      input: query,
      key: this.apiKey,
      language: 'es',
      types: 'establishment|geocode',
    });

    if (location) {
      params.set('location', `${location.lat},${location.lng}`);
      params.set('radius', radiusMeters.toString());
    }

    const response = await fetch(`${this.baseUrl}/place/autocomplete/json?${params}`);
    if (!response.ok) return [];

    const data = await response.json() as {
      predictions: Array<{
        description: string;
        place_id: string;
        structured_formatting?: { main_text: string };
      }>;
    };

    // For autocomplete, we don't have coordinates.
    // Use geocode on the description to get coordinates.
    const results: MapLocation[] = [];
    for (const pred of data.predictions.slice(0, 5)) {
      const geocoded = await this.geocode(pred.description);
      if (geocoded.length > 0) {
        results.push(geocoded[0]);
      }
    }

    return results;
  }
}

/**
 * Nominatim/OpenStreetMap implementation (free, no API key).
 * Good for development, limited for production.
 */
export class NominatimMapsService implements MapsService {
  private userAgent = 'EnviazoLogistics/1.0';
  private cache = new Map<string, unknown>();

  async geocode(address: string): Promise<MapLocation[]> {
    const cacheKey = `geo:${address}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey) as MapLocation[];

    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '5',
      addressdetails: '1',
      countrycodes: 'cl',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': this.userAgent },
    });

    if (!response.ok) return [];

    const data = await response.json() as Array<{
      lat: string;
      lon: string;
      display_name: string;
      place_id: number;
    }>;

    const results: MapLocation[] = data.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      address: r.display_name,
      placeId: String(r.place_id),
    }));

    this.cache.set(cacheKey, results);
    return results;
  }

  async reverseGeocode(lat: number, lng: number): Promise<MapLocation | null> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      addressdetails: '1',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'User-Agent': this.userAgent },
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      lat: string;
      lon: string;
      display_name: string;
      place_id: number;
    };

    return {
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon),
      address: data.display_name,
      placeId: String(data.place_id),
    };
  }

  async getRoute(origin: MapLocation, destination: MapLocation): Promise<RouteResult> {
    // OSRM (Open Source Routing Machine) - free routing
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'polyline',
      steps: 'true',
      annotations: 'true',
    });

    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?${params}`;

    const response = await fetch(url);
    if (!response.ok) {
      return { distanceKm: 0, durationMin: 0, durationText: '', distanceText: '', steps: [] };
    }

    const data = await response.json() as {
      routes: Array<{
        distance: number;
        duration: number;
        legs: Array<{
          steps: Array<{
            maneuver: { type: string; location: [number, number] };
            name: string;
            distance: number;
            duration: number;
          }>;
        }>;
        geometry: string;
      }>;
    };

    if (data.routes.length === 0) {
      return { distanceKm: 0, durationMin: 0, durationText: '', distanceText: '', steps: [] };
    }

    const route = data.routes[0];
    const distanceKm = Math.round(route.distance / 100) / 10;
    const durationMin = Math.round(route.duration / 60);

    return {
      distanceKm,
      durationMin,
      durationText: `${durationMin} min`,
      distanceText: `${distanceKm} km`,
      polyline: route.geometry,
      steps: route.legs[0]?.steps.map(s => ({
        instruction: s.name || `${s.maneuver.type}`,
        distanceMeters: s.distance,
        durationSeconds: s.duration,
        startLocation: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] },
        endLocation: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] },
      })) || [],
    };
  }

  async getDistanceMatrix(
    origins: MapLocation[],
    destinations: MapLocation[]
  ): Promise<DistanceMatrixElement[][]> {
    // For Nominatim, we use OSRM table API
    const coords = [...origins, ...destinations]
      .map(c => `${c.lng},${c.lat}`)
      .join(';');

    const params = new URLSearchParams({
      annotations: 'distance,duration',
    });

    const url = `https://router.project-osrm.org/table/v1/driving/${coords}?${params}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json() as {
      distances: number[][];
      durations: number[][];
    };

    if (!data.distances || !data.durations) return [];

    const originCount = origins.length;
    const destCount = destinations.length;

    return data.distances.slice(0, originCount).map((row, i) =>
      row.slice(originCount, originCount + destCount).map((dist, j) => ({
        distanceKm: Math.round(dist / 100) / 10,
        durationMin: Math.round(data.durations[i][originCount + j] / 60),
        distanceText: `${Math.round(dist / 100) / 10} km`,
        durationText: `${Math.round(data.durations[i][originCount + j] / 60)} min`,
      }))
    );
  }

  async searchPlaces(
    query: string,
    location?: MapLocation,
    radiusMeters: number = 50000
  ): Promise<MapLocation[]> {
    // Nominatim doesn't have a proper places search.
    // Fall back to geocoding the query.
    return this.geocode(query);
  }
}

/**
 * Factory: creates the appropriate maps service based on config.
 */
export function createMapsService(): MapsService {
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    console.log('[Maps] Using Google Maps API');
    return new GoogleMapsService(googleApiKey);
  }
  console.log('[Maps] Using Nominatim/OSRM (free, no API key)');
  return new NominatimMapsService();
}
