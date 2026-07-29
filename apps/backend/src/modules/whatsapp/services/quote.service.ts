import { calculatePriceCached } from '../../../services/pricing.service.js';
import { calculateDistance } from '../../../services/pricing.service.js';
import { DispatchOrderData, PriceBreakdown } from '../types/index.js';
import { VehicleType } from '../../../types/index.js';

export class QuoteService {
  async calculate(draft: Partial<DispatchOrderData>): Promise<PriceBreakdown> {
    let originLat = draft.originLat || 0;
    let originLng = draft.originLng || 0;
    let destLat = draft.destLat || 0;
    let destLng = draft.destLng || 0;

    if (!originLat || !originLng || !destLat || !destLng) {
      originLat = originLat || -33.4489;
      originLng = originLng || -70.6693;
      destLat = destLat || -33.4569;
      destLng = destLng || -70.6385;
    }

    const weight = draft.packageWeightKg || 1;
    const length = draft.packageLengthCm || 30;
    const width = draft.packageWidthCm || 20;
    const height = draft.packageHeightCm || 20;
    const volumeM3 = (length * width * height) / 1000000;

    const vehicleType = (draft.preferredVehicleType as VehicleType) || 'auto';
    const urgency = draft.urgency || false;

    return calculatePriceCached(originLat, originLng, destLat, destLng, vehicleType, weight, volumeM3, urgency);
  }
}
