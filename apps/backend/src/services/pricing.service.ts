import { VehicleType, PriceBreakdown } from '../types/index.js';
import { getCacheService } from './cache.service.js';
import { createMapsService, MapsService } from './maps.service.js';
import { VEHICLE_SPECS } from '../config/vehicles.js';
import { logger } from './logger.js';

const BASE_RATE = 700;
const URGENCY_FEE = 300;
const WEIGHT_THRESHOLD = 10;
const WEIGHT_FEE_PER_KG = 100;
const VOLUME_THRESHOLD = 0.5;
const VOLUME_FEE_PER_M3 = 500;

// Los multiplicadores viven en config/vehicles.ts junto a la capacidad, para
// que agregar un tipo de vehiculo sea un solo cambio y no dos tablas que se
// desincronizan.

const PRICING_CACHE_PREFIX = 'pricing';

// Factor de rodeo: cuanto mas larga es la ruta real que la linea recta.
// La linea recta subestima siempre, y en la zona sur (fiordos, peninsulas,
// caminos que bordean la costa) la diferencia es grande: Puerto Montt-Castro
// son ~85 km en linea recta y ~180 km por carretera mas el transbordo.
// 1.35 es el valor tipico en terreno normal; se usa SOLO como respaldo cuando
// no se pudo obtener la ruta real, para no cobrarle de menos al prestador.
const ROAD_CIRCUITY_FACTOR = 1.35;

let mapsServiceInstance: MapsService | null = null;

function getMaps(): MapsService {
  if (!mapsServiceInstance) {
    mapsServiceInstance = createMapsService();
  }
  return mapsServiceInstance;
}

export interface DistanceResult {
  distanceKm: number;
  /** 'route' = distancia real de carretera. 'estimate' = linea recta ajustada. */
  source: 'route' | 'estimate';
  durationMin?: number;
}

/**
 * Distancia a cobrar entre dos puntos.
 *
 * Usa la ruta real (Google Directions, o OSRM si no hay API key). Si el
 * proveedor falla o devuelve 0, cae a la linea recta ajustada por el factor de
 * rodeo. Nunca devuelve 0 con coordenadas distintas: un 0 se convertiria en un
 * envio gratis.
 */
export async function resolveDistanceKm(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DistanceResult> {
  try {
    const route = await getMaps().getRoute(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng }
    );

    if (route.distanceKm > 0) {
      return {
        distanceKm: route.distanceKm,
        source: 'route',
        durationMin: route.durationMin > 0 ? route.durationMin : undefined,
      };
    }

    logger.warn(
      { originLat, originLng, destLat, destLng },
      'Ruteo devolvio 0 km, se cobra por linea recta ajustada'
    );
  } catch (error) {
    logger.warn({ err: error }, 'Ruteo fallo, se cobra por linea recta ajustada');
  }

  const straight = calculateDistance(originLat, originLng, destLat, destLng);
  return {
    distanceKm: Math.round(straight * ROAD_CIRCUITY_FACTOR * 100) / 100,
    source: 'estimate',
  };
}

function buildQuoteCacheKey(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  vehicleType: VehicleType,
  weight: number,
  volumeM3: number,
  urgency: boolean
): string {
  return `${PRICING_CACHE_PREFIX}:${originLat}:${originLng}:${destLat}:${destLng}:${vehicleType}:${weight}:${volumeM3}:${urgency}`;
}

export function calculatePrice(
  distanceKm: number,
  packageWeight: number,
  packageVolumeM3: number,
  vehicleType: VehicleType,
  urgency: boolean
): PriceBreakdown {
  const basePrice = Math.ceil(distanceKm * BASE_RATE);
  const weightFee =
    packageWeight > WEIGHT_THRESHOLD
      ? Math.ceil((packageWeight - WEIGHT_THRESHOLD) * WEIGHT_FEE_PER_KG)
      : 0;
  const volumeFee =
    packageVolumeM3 > VOLUME_THRESHOLD
      ? Math.ceil((packageVolumeM3 - VOLUME_THRESHOLD) * VOLUME_FEE_PER_M3)
      : 0;
  const urgencyFee = urgency ? URGENCY_FEE : 0;
  const vehicleMultiplier = VEHICLE_SPECS[vehicleType]?.priceMultiplier ?? 1.0;
  const subtotal = basePrice + weightFee + volumeFee + urgencyFee;
  const totalPrice = Math.ceil(subtotal * vehicleMultiplier);

  return {
    basePrice,
    weightFee,
    volumeFee,
    urgencyFee,
    vehicleMultiplier,
    totalPrice,
  };
}

export async function calculatePriceCached(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  vehicleType: VehicleType,
  weight: number,
  volumeM3: number,
  urgency: boolean
): Promise<PriceBreakdown> {
  const cache = getCacheService();
  const cacheKey = buildQuoteCacheKey(originLat, originLng, destLat, destLng, vehicleType, weight, volumeM3, urgency);

  const cached = await cache.get<PriceBreakdown>(cacheKey);
  if (cached) return cached;

  const { distanceKm } = await resolveDistanceKm(originLat, originLng, destLat, destLng);
  const result = calculatePrice(distanceKm, weight, volumeM3, vehicleType, urgency);

  await cache.set(cacheKey, result, 300);

  return result;
}

export async function invalidatePricingCache(): Promise<void> {
  const cache = getCacheService();
  await cache.invalidatePattern(`${PRICING_CACHE_PREFIX}:*`);
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
