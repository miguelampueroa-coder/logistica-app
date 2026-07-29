// Geocoding service using OpenStreetMap Nominatim (free, no API key needed).
// Falls back gracefully when geocoding is unavailable.

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
  displayName: string;
  confidence: number;
}

export interface ReverseGeocodeResult {
  address: string;
  displayName: string;
}

export class GeocodingService {
  private baseUrl = 'https://nominatim.openstreetmap.org';
  private userAgent = 'EnviazoLogistics/1.0';
  private cache: Map<string, GeocodeResult[]> = new Map();

  /**
   * Forward geocode: address string → coordinates.
   * Returns multiple results for ambiguous addresses.
   */
  async geocode(address: string, limit = 5): Promise<GeocodeResult[]> {
    const cacheKey = `fwd:${address.toLowerCase().trim()}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const params = new URLSearchParams({
        q: address,
        format: 'json',
        limit: limit.toString(),
        addressdetails: '1',
        countrycodes: 'cl', // Chile by default
      });

      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: { 'User-Agent': this.userAgent },
      });

      if (!response.ok) {
        console.warn(`[Geocoding] Nominatim returned ${response.status}`);
        return [];
      }

      const data = await response.json() as Array<{
        lat: string;
        lon: string;
        display_name: string;
        address?: Record<string, string>;
        importance?: number;
      }>;

      const results: GeocodeResult[] = data.map((item) => ({
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
        confidence: item.importance || 0.5,
      }));

      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.warn('[Geocoding] Error:', error);
      return [];
    }
  }

  /**
   * Reverse geocode: coordinates → address.
   */
  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    const cacheKey = `rev:${lat},${lng}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)![0] as unknown as ReverseGeocodeResult;
    }

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1',
      });

      const response = await fetch(`${this.baseUrl}/reverse?${params}`, {
        headers: { 'User-Agent': this.userAgent },
      });

      if (!response.ok) return null;

      const data = await response.json() as { display_name: string };
      const result: ReverseGeocodeResult = {
        address: data.display_name,
        displayName: data.display_name,
      };

      return result;
    } catch (error) {
      console.warn('[Geocoding] Reverse error:', error);
      return null;
    }
  }

  /**
   * Search for places by name (e.g., "Jumbo Puerto Montt").
   * Returns multiple results for disambiguation.
   */
  async searchPlaces(query: string, limit = 5): Promise<GeocodeResult[]> {
    return this.geocode(query, limit);
  }

  /**
   * Validate that an address falls within a coverage area.
   * Simple bounding box check for Puerto Montt region.
   */
  validateCoverage(lat: number, lng: number): boolean {
    // Puerto Montt approximate bounding box
    const bounds = {
      minLat: -41.60,
      maxLat: -41.40,
      minLng: -73.10,
      maxLng: -72.85,
    };

    return (
      lat >= bounds.minLat &&
      lat <= bounds.maxLat &&
      lng >= bounds.minLng &&
      lng <= bounds.maxLng
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}
