import { describe, it, expect, vi, beforeEach } from 'vitest';

const getRoute = vi.fn();

vi.mock('../../services/maps.service.js', () => ({
  createMapsService: () => ({ getRoute }),
}));

import { resolveDistanceKm, calculateDistance } from '../../services/pricing.service.js';

// Puerto Montt -> Castro: el caso que motivo el cambio. En linea recta son
// ~85 km, pero por carretera son ~180 km mas el transbordo Pargua-Chacao.
const PUERTO_MONTT = { lat: -41.4693, lng: -72.9424 };
const CASTRO = { lat: -42.4825, lng: -73.7658 };

describe('resolveDistanceKm', () => {
  beforeEach(() => {
    getRoute.mockReset();
  });

  it('usa la distancia real de carretera cuando el ruteo responde', async () => {
    getRoute.mockResolvedValue({ distanceKm: 180.4, durationMin: 210 });

    const result = await resolveDistanceKm(
      PUERTO_MONTT.lat, PUERTO_MONTT.lng, CASTRO.lat, CASTRO.lng
    );

    expect(result.source).toBe('route');
    expect(result.distanceKm).toBe(180.4);
    expect(result.durationMin).toBe(210);
  });

  it('cae a la linea recta ajustada si el ruteo devuelve 0', async () => {
    getRoute.mockResolvedValue({ distanceKm: 0, durationMin: 0 });

    const result = await resolveDistanceKm(
      PUERTO_MONTT.lat, PUERTO_MONTT.lng, CASTRO.lat, CASTRO.lng
    );

    expect(result.source).toBe('estimate');
    const straight = calculateDistance(PUERTO_MONTT.lat, PUERTO_MONTT.lng, CASTRO.lat, CASTRO.lng);
    expect(result.distanceKm).toBeCloseTo(straight * 1.35, 1);
  });

  it('cae a la linea recta ajustada si el ruteo lanza error', async () => {
    getRoute.mockRejectedValue(new Error('sin conexion'));

    const result = await resolveDistanceKm(
      PUERTO_MONTT.lat, PUERTO_MONTT.lng, CASTRO.lat, CASTRO.lng
    );

    expect(result.source).toBe('estimate');
    expect(result.distanceKm).toBeGreaterThan(0);
  });

  // Un 0 se convierte en un envio gratis, asi que nunca debe salir de aqui
  // con coordenadas distintas.
  it('nunca devuelve 0 entre dos puntos distintos', async () => {
    getRoute.mockResolvedValue({ distanceKm: 0, durationMin: 0 });

    const result = await resolveDistanceKm(
      PUERTO_MONTT.lat, PUERTO_MONTT.lng, CASTRO.lat, CASTRO.lng
    );

    expect(result.distanceKm).toBeGreaterThan(0);
  });

  it('el respaldo cobra mas que la linea recta cruda', async () => {
    getRoute.mockRejectedValue(new Error('falla'));

    const straight = calculateDistance(PUERTO_MONTT.lat, PUERTO_MONTT.lng, CASTRO.lat, CASTRO.lng);
    const result = await resolveDistanceKm(
      PUERTO_MONTT.lat, PUERTO_MONTT.lng, CASTRO.lat, CASTRO.lng
    );

    expect(result.distanceKm).toBeGreaterThan(straight);
  });
});
