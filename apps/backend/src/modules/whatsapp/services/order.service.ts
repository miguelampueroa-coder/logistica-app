import { getSupabaseAdmin } from '../../../config/database.js';
import { calculatePrice, calculateDistance } from '../../../services/pricing.service.js';
import { DispatchOrderData } from '../types/index.js';
import { VehicleType } from '../../../types/index.js';
import { NotificationEngine } from './notification.engine.js';

export interface OrderCreationResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export class OrderService {
  private notificationEngine?: NotificationEngine;

  setNotificationEngine(engine: NotificationEngine): void {
    this.notificationEngine = engine;
  }

  // El telefono del cliente vive en dispatch_orders, no en shipments.
  private async getCustomerPhone(shipmentId: string): Promise<string | null> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('dispatch_orders')
      .select('customer_phone')
      .eq('shipment_id', shipmentId)
      .maybeSingle();

    return data?.customer_phone ?? null;
  }

  /**
   * Notify customer when a provider accepts the shipment.
   */
  async notifyProviderAssigned(
    shipmentId: string,
    providerId: string,
    companyPhone: string
  ): Promise<void> {
    if (!this.notificationEngine) return;

    const supabase = getSupabaseAdmin();
    const customerPhone = await this.getCustomerPhone(shipmentId);

    const { data: provider } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', providerId)
      .single();

    if (provider) {
      await this.notificationEngine.notifyCustomerDriverAssigned(
        customerPhone || companyPhone,
        provider.name || 'Repartidor',
        provider.phone || 'Sin teléfono'
      );
    }
  }

  /**
   * Notify customer when package is picked up.
   */
  async notifyPickedUp(shipmentId: string): Promise<void> {
    if (!this.notificationEngine) return;

    const customerPhone = await this.getCustomerPhone(shipmentId);

    if (customerPhone) {
      await this.notificationEngine.sendDirectMessage(
        customerPhone,
        `📦 Tu envío #${shipmentId.slice(0, 8)} ha sido recogido y está en camino.`
      );
    }
  }

  /**
   * Notify customer when delivery is completed.
   */
  async notifyDelivered(shipmentId: string): Promise<void> {
    if (!this.notificationEngine) return;

    const customerPhone = await this.getCustomerPhone(shipmentId);

    if (customerPhone) {
      await this.notificationEngine.notifyDelivered(
        customerPhone,
        shipmentId.slice(0, 8)
      );
    }
  }
  /**
   * Find or create a user by phone number for WhatsApp orders.
   * Creates a minimal 'client' user if none exists.
   */
  async findOrCreateUserByPhone(
    phone: string,
    name?: string
  ): Promise<string | null> {
    const supabase = getSupabaseAdmin();

    // Look for existing user by phone
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .limit(1)
      .single();

    if (existing) return existing.id;

    // Create a new client user
    const email = `whatsapp_${phone}@enviazo.chat`;
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email,
        name: name || `Cliente WhatsApp ${phone.slice(-4)}`,
        phone,
        role: 'client',
      })
      .select('id')
      .single();

    if (error || !newUser) {
      console.error('[OrderService] Failed to create user:', error);
      return null;
    }

    return newUser.id;
  }

  async createFromChat(
    companyId: string,
    conversationId: string,
    draft: Partial<DispatchOrderData>,
    customerPhone: string
  ): Promise<OrderCreationResult> {
    const supabase = getSupabaseAdmin();

    try {
      // Validate required fields
      if (!draft.originAddress || !draft.originLat || !draft.originLng) {
        return { success: false, error: 'Falta la dirección de origen' };
      }
      if (!draft.destAddress || !draft.destLat || !draft.destLng) {
        return { success: false, error: 'Falta la dirección de destino' };
      }
      if (!draft.packageDescription || !draft.packageWeightKg) {
        return { success: false, error: 'Faltan datos del paquete' };
      }

      // Find or create the user linked to this phone number
      const userId = await this.findOrCreateUserByPhone(
        customerPhone,
        draft.originContactName
      );

      if (!userId) {
        return { success: false, error: 'No se pudo crear el usuario' };
      }

      // Calculate distance and price
      const distanceKm = calculateDistance(
        draft.originLat, draft.originLng,
        draft.destLat, draft.destLng
      );

      const weight = draft.packageWeightKg || 1;
      const length = draft.packageLengthCm || 30;
      const width = draft.packageWidthCm || 20;
      const height = draft.packageHeightCm || 20;
      const volumeM3 = (length * width * height) / 1000000;
      const vehicleType = (draft.preferredVehicleType as VehicleType) || 'auto';
      const urgency = draft.urgency || false;

      const price = calculatePrice(distanceKm, weight, volumeM3, vehicleType, urgency);

      // Create package
      const { data: packageData, error: pkgErr } = await supabase
        .from('packages')
        .insert({
          user_id: userId,
          description: draft.packageDescription,
          weight_kg: weight,
          length_cm: length,
          width_cm: width,
          height_cm: height,
          notes: draft.packageNotes,
        })
        .select('id')
        .single();

      if (pkgErr || !packageData) {
        return { success: false, error: `Error creando paquete: ${pkgErr?.message}` };
      }

      // Create shipment
      const { data: shipmentData, error: shipErr } = await supabase
        .from('shipments')
        .insert({
          package_id: packageData.id,
          user_id: userId,
          origin_address: draft.originAddress,
          origin_lat: draft.originLat,
          origin_lng: draft.originLng,
          origin_contact_name: draft.originContactName,
          origin_contact_phone: draft.originContactPhone || customerPhone,
          dest_address: draft.destAddress,
          dest_lat: draft.destLat,
          dest_lng: draft.destLng,
          dest_contact_name: draft.destContactName,
          dest_contact_phone: draft.destContactPhone,
          distance_km: distanceKm,
          base_price: price.basePrice,
          urgency_fee: price.urgencyFee,
          total_price: price.totalPrice,
          status: 'pending',
          urgency: urgency,
        })
        .select('id')
        .single();

      if (shipErr || !shipmentData) {
        return { success: false, error: `Error creando envío: ${shipErr?.message}` };
      }

      // Create dispatch_order record
      const { error: dispatchErr } = await supabase
        .from('dispatch_orders')
        .insert({
          company_id: companyId,
          conversation_id: conversationId,
          shipment_id: shipmentData.id,
          customer_phone: customerPhone,
          customer_name: draft.originContactName || draft.destContactName,
          status: 'submitted',
          extracted_data: draft as unknown as Record<string, unknown>,
          missing_fields: [],
          priority: urgency ? 'high' : 'normal',
          source_channel: 'whatsapp',
        });

      if (dispatchErr) {
        console.error('[OrderService] Failed to create dispatch_order:', dispatchErr);
      }

      return { success: true, orderId: shipmentData.id };
    } catch (error) {
      console.error('[OrderService] Creation error:', error);
      return { success: false, error: 'Error interno al crear la orden' };
    }
  }

  async cancelShipment(shipmentId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('shipments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', shipmentId)
      .in('status', ['pending', 'accepted']);

    return !error;
  }

  async getShipmentStatus(shipmentId: string): Promise<Record<string, unknown> | null> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('shipments')
      .select('status, origin_address, dest_address, total_price, picked_up_at, delivered_at, provider_id')
      .eq('id', shipmentId)
      .single();

    return data;
  }
}
