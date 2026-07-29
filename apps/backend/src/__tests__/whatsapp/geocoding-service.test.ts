import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeocodingService } from '../../modules/whatsapp/services/geocoding.service.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GeocodingService', () => {
  let service: GeocodingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GeocodingService();
  });

  describe('geocode', () => {
    it('returns geocoding results for valid address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: '-41.4737',
            lon: '-72.9413',
            display_name: 'Puerto Montt, Chile',
            importance: 0.8,
          },
        ],
      });

      const results = await service.geocode('Puerto Montt');

      expect(results).toHaveLength(1);
      expect(results[0].lat).toBe(-41.4737);
      expect(results[0].lng).toBe(-72.9413);
      expect(results[0].displayName).toBe('Puerto Montt, Chile');
      expect(results[0].confidence).toBe(0.8);
    });

    it('returns empty array for no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const results = await service.geocode('NonexistentPlace12345');
      expect(results).toHaveLength(0);
    });

    it('handles API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const results = await service.geocode('Test');
      expect(results).toHaveLength(0);
    });

    it('caches results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: '-41.4737',
            lon: '-72.9413',
            display_name: 'Puerto Montt, Chile',
          },
        ],
      });

      await service.geocode('Puerto Montt');
      await service.geocode('Puerto Montt');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('reverseGeocode', () => {
    it('returns address for valid coordinates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          display_name: 'Puerto Montt, Chile',
        }),
      });

      const result = await service.reverseGeocode(-41.4737, -72.9413);

      expect(result).toBeTruthy();
      expect(result?.displayName).toBe('Puerto Montt, Chile');
    });

    it('returns null for failed reverse geocode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const result = await service.reverseGeocode(0, 0);
      expect(result).toBeNull();
    });
  });

  describe('searchPlaces', () => {
    it('delegates to geocode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: '-41.4737',
            lon: '-72.9413',
            display_name: 'Jumbo Puerto Montt, Chile',
          },
        ],
      });

      const results = await service.searchPlaces('Jumbo');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].displayName).toContain('Jumbo');
    });
  });

  describe('validateCoverage', () => {
    it('returns true for Puerto Montt coordinates', () => {
      expect(service.validateCoverage(-41.47, -72.94)).toBe(true);
    });

    it('returns false for Santiago coordinates', () => {
      expect(service.validateCoverage(-33.45, -70.66)).toBe(false);
    });

    it('returns false for coordinates outside Chile', () => {
      expect(service.validateCoverage(40.71, -74.00)).toBe(false);
    });
  });
});
