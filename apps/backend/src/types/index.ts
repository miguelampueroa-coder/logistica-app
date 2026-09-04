export type UserRole = 'client' | 'provider' | 'admin';

// bicicleta cubre el reparto urbano corto; barco cubre las islas, que en la
// zona de Chiloe y Palena no tienen otra via. Ver config/vehicles.ts.
export type VehicleType =
  | 'bicicleta'
  | 'moto'
  | 'auto'
  | 'furgoneta'
  | 'camioneta'
  | 'microbus'
  | 'camion'
  | 'barco';

export type ShipmentStatus = 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled';

// Enviazo no acepta efectivo (decision de Miguel, 2026-09): si el cliente le
// paga en mano al prestador, la plata nunca pasa por la plataforma y no hay de
// donde descontar la comision. Solo pagos virtuales.
export type PaymentMethod = 'card' | 'qr' | 'transfer';

export type PaymentStatusType = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  location_lat?: number;
  location_lng?: number;
  is_available: boolean;
  created_at: Date;
}

export interface Vehicle {
  id: string;
  user_id: string;
  type: VehicleType;
  brand?: string;
  model?: string;
  year?: number;
  plate?: string;
  capacity_kg?: number;
  capacity_m3?: number;
  photos: string[];
  is_active: boolean;
}

export interface Package {
  id: string;
  user_id: string;
  description: string;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  declared_value?: number;
  photos: string[];
  notes?: string;
  created_at: Date;
}

export interface Shipment {
  id: string;
  package_id: string;
  user_id: string;
  provider_id?: string;
  vehicle_id?: string;
  
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  origin_contact_name?: string;
  origin_contact_phone?: string;
  
  dest_address: string;
  dest_lat: number;
  dest_lng: number;
  dest_contact_name?: string;
  dest_contact_phone?: string;
  
  distance_km?: number;
  base_price?: number;
  urgency_fee: number;
  total_price?: number;

  status: ShipmentStatus;
  urgency: boolean;
  scheduled_at?: Date;
  picked_up_at?: Date;
  delivered_at?: Date;
  created_at: Date;
  updated_at: Date;

  payment_id?: string;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatusType;
}

export interface Payment {
  id: string;
  shipment_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatusType;
  stripe_payment_id?: string;
  created_at: Date;
}

export interface Rating {
  id: string;
  shipment_id: string;
  from_user_id: string;
  to_user_id: string;
  score: number;
  comment?: string;
  created_at: Date;
}

export interface PriceBreakdown {
  basePrice: number;
  weightFee: number;
  volumeFee: number;
  urgencyFee: number;
  vehicleMultiplier: number;
  totalPrice: number;
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}
