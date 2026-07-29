import { VehicleType, PriceBreakdown } from '../types/index.js';
import { getCacheService } from './cache.service.js';

const BASE_RATE = 700;
const URGENCY_FEE = 300;
const WEIGHT_THRESHOLD = 10;
const WEIGHT_FEE_PER_KG = 100;
const VOLUME_THRESHOLD = 0.5;
const VOLUME_FEE_PER_M3 = 500;

const VEHICLE_MULTIPLIERS: Record<VehicleType, number> = {
  moto: 1.0,
  auto: 1.2,
  furgoneta: 1.5,
  camioneta: 1.8,
  microbus: 2.2,
  camion: 2.5,
};

const PRICING_CACHE_PREFIX = 'pricing';

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
  return `quote:${originLat}:${originLng}:${destLat}:${destLng}:${vehicleType}:${weight}:${volumeM3}:${urgency}`;
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
  const vehicleMultiplier = VEHICLE_MULTIPLIERS[vehicleType] || 1.0;
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

  const distanceKm = calculateDistance(originLat, originLng, destLat, destLng);
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
