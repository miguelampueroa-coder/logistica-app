import { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin, withRetry } from '../config/database.js';
import { calculatePrice, calculateDistance } from '../services/pricing.service.js';
import { VehicleType, PaymentMethod } from '../types/index.js';
import { PaymentService, PaymentProviderType } from '../services/payment.service.js';
import { eventBus } from '../services/event-bus.js';
import { logger } from '../services/logger.js';

const paymentService = new PaymentService();

const PAYMENT_METHOD_MAP: Record<PaymentMethod, PaymentProviderType> = {
  card: 'stripe',
  transfer: 'webpay',
  cash: 'cash',
};

const SEARCH_RADIUS_KM = 10;

export const createShipmentSchema = z.object({
  package_description: z.string().min(1, 'Package description is required'),
  package_weight_kg: z.number().positive('Weight must be positive'),
  package_length_cm: z.number().positive('Length must be positive'),
  package_width_cm: z.number().positive('Width must be positive'),
  package_height_cm: z.number().positive('Height must be positive'),
  package_declared_value: z.number().positive().optional(),
  package_photos: z.array(z.string()).optional(),
  package_notes: z.string().optional(),

  origin_address: z.string().min(1, 'Origin address is required'),
  origin_lat: z.number(),
  origin_lng: z.number(),
  origin_contact_name: z.string().optional(),
  origin_contact_phone: z.string().optional(),

  dest_address: z.string().min(1, 'Destination address is required'),
  dest_lat: z.number(),
  dest_lng: z.number(),
  dest_contact_name: z.string().optional(),
  dest_contact_phone: z.string().optional(),

  urgency: z.boolean().default(false),
  scheduled_at: z.string().datetime().optional(),
  preferred_vehicle_type: z.enum(['moto', 'auto', 'furgoneta', 'camioneta', 'microbus', 'camion']).optional(),
  payment_method: z.enum(['card', 'transfer', 'cash']).default('card'),
});

export async function createShipment(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const supabase = getSupabaseAdmin();

    const distanceKm = calculateDistance(
      data.origin_lat,
      data.origin_lng,
      data.dest_lat,
      data.dest_lng
    );

    const packageVolumeM3 =
      (data.package_length_cm * data.package_width_cm * data.package_height_cm) / 1000000;

    const vehicleType = data.preferred_vehicle_type || 'auto';
    const priceBreakdown = calculatePrice(
      distanceKm,
      data.package_weight_kg,
      packageVolumeM3,
      vehicleType as VehicleType,
      data.urgency
    );

    const { data: packageData, error: packageError } = await supabase
      .from('packages')
      .insert({
        user_id: userId,
        description: data.package_description,
        weight_kg: data.package_weight_kg,
        length_cm: data.package_length_cm,
        width_cm: data.package_width_cm,
        height_cm: data.package_height_cm,
        declared_value: data.package_declared_value,
        photos: data.package_photos || [],
        notes: data.package_notes,
      })
      .select()
      .single();

    if (packageError) {
      res.status(400).json({ error: packageError.message });
      return;
    }

    const { data: shipmentData, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        package_id: packageData.id,
        user_id: userId,
        origin_address: data.origin_address,
        origin_lat: data.origin_lat,
        origin_lng: data.origin_lng,
        origin_contact_name: data.origin_contact_name,
        origin_contact_phone: data.origin_contact_phone,
        dest_address: data.dest_address,
        dest_lat: data.dest_lat,
        dest_lng: data.dest_lng,
        dest_contact_name: data.dest_contact_name,
        dest_contact_phone: data.dest_contact_phone,
        distance_km: distanceKm,
        base_price: priceBreakdown.basePrice,
        urgency_fee: priceBreakdown.urgencyFee,
        total_price: priceBreakdown.totalPrice,
        status: 'pending',
        urgency: data.urgency,
        scheduled_at: data.scheduled_at,
        payment_method: data.payment_method,
      })
      .select()
      .single();

    if (shipmentError) {
      res.status(400).json({ error: shipmentError.message });
      return;
    }

    const paymentMethod = data.payment_method as PaymentMethod;
    const providerType = PAYMENT_METHOD_MAP[paymentMethod];
    let paymentIntent = null;

    if (providerType) {
      try {
        paymentIntent = await paymentService.createPayment(
          shipmentData.id,
          priceBreakdown.totalPrice,
          providerType,
          { userId }
        );

        const { error: paymentLinkError } = await supabase
          .from('shipments')
          .update({ payment_id: paymentIntent.id })
          .eq('id', shipmentData.id);

        if (paymentLinkError) {
          console.error('[Order] Failed to link payment to shipment:', paymentLinkError.message);
        }
      } catch (err) {
        console.error('[Order] Payment creation failed:', err);
      }
    }

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone, name')
      .eq('id', userId)
      .single();

    eventBus.emitShipmentEvent({
      type: 'shipment:created',
      shipmentId: shipmentData.id,
      userId,
      metadata: {
        userEmail: clientUser?.email,
        userPhone: clientUser?.phone,
        userName: clientUser?.name,
        destination: data.dest_address,
        price: priceBreakdown.totalPrice,
        origin: data.origin_address,
      },
      timestamp: new Date(),
    });

    const { data: nearbyProviders } = await supabase.rpc('find_nearby_providers', {
      p_lat: data.origin_lat,
      p_lng: data.origin_lng,
      p_radius_km: SEARCH_RADIUS_KM,
    });

    if (nearbyProviders && nearbyProviders.length > 0) {
      logger.info(`New shipment ${shipmentData.id} notified to ${nearbyProviders.length} nearby providers`);
    }

    res.status(201).json({
      message: 'Shipment created successfully',
      shipment: {
        ...shipmentData,
        price_breakdown: priceBreakdown,
        payment_id: paymentIntent?.id || null,
        payment_url: paymentIntent?.paymentUrl || null,
        client_secret: paymentIntent?.clientSecret || null,
      },
    });
  } catch (error) {
    console.error('Create shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAvailableShipments(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: shipments, error } = await supabase
      .from('shipments')
      .select(`
        id, origin_address, origin_lat, origin_lng, dest_address, dest_lat, dest_lng,
        distance_km, base_price, urgency_fee, total_price, urgency, created_at,
        packages (description, weight_kg, length_cm, width_cm, height_cm)
      `)
      .eq('status', 'pending')
      .is('provider_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ shipments });
  } catch (error) {
    console.error('Get available shipments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function acceptShipment(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'provider') {
      res.status(403).json({ error: 'Only providers can accept shipments' });
      return;
    }

    const providerId = req.user!.userId;
    const { id } = req.params;
    const { vehicle_id } = req.body;
    const supabase = getSupabaseAdmin();

    if (!vehicle_id) {
      res.status(400).json({ error: 'vehicle_id is required' });
      return;
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', vehicle_id)
      .eq('user_id', providerId)
      .eq('is_active', true)
      .single();

    if (vehicleError || !vehicle) {
      res.status(400).json({ error: 'Invalid vehicle: must be your own active vehicle' });
      return;
    }

    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    if (shipment.status !== 'pending') {
      res.status(400).json({ error: 'Shipment is not available' });
      return;
    }

    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        provider_id: providerId,
        vehicle_id: vehicle_id,
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .is('provider_id', null);

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    const { data: updated } = await supabase
      .from('shipments')
      .select('provider_id')
      .eq('id', id)
      .single();

    if (!updated || updated.provider_id !== providerId) {
      res.status(409).json({ error: 'Shipment was just taken by another provider' });
      return;
    }

    const { data: providerUser } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', providerId)
      .single();

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone, name')
      .eq('id', shipment.user_id)
      .single();

    const { data: vehicleData } = await supabase
      .from('vehicles')
      .select('brand, model, plate, type')
      .eq('id', vehicle_id)
      .single();

    const vehicleInfo = vehicleData
      ? `${vehicleData.brand || ''} ${vehicleData.model || ''} (${vehicleData.plate || ''})`.trim()
      : 'N/A';

    eventBus.emitShipmentEvent({
      type: 'shipment:accepted',
      shipmentId: shipment.id,
      userId: shipment.user_id,
      providerId,
      metadata: {
        userEmail: clientUser?.email,
        userPhone: clientUser?.phone,
        userName: clientUser?.name,
        providerName: providerUser?.name,
        providerPhone: providerUser?.phone,
        vehicleInfo,
        vehicleType: vehicleData?.type,
      },
      timestamp: new Date(),
    });

    res.json({ message: 'Shipment accepted successfully' });
  } catch (error) {
    console.error('Accept shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function pickupShipment(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'provider') {
      res.status(403).json({ error: 'Only providers can pick up shipments' });
      return;
    }

    const providerId = req.user!.userId;
    const { id } = req.params;
    const supabase = getSupabaseAdmin();

    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    if (shipment.status !== 'accepted' || shipment.provider_id !== providerId) {
      res.status(400).json({ error: 'Shipment cannot be picked up' });
      return;
    }

    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        status: 'in_transit',
        picked_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone, name')
      .eq('id', shipment.user_id)
      .single();

    const { data: provider } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', providerId)
      .single();

    eventBus.emitShipmentEvent({
      type: 'shipment:in_transit',
      shipmentId: id,
      userId: shipment.user_id,
      providerId,
      metadata: {
        userEmail: clientUser?.email,
        userPhone: clientUser?.phone,
        userName: clientUser?.name,
        providerName: provider?.name,
        providerPhone: provider?.phone,
      },
      timestamp: new Date(),
    });

    res.json({ message: 'Shipment picked up successfully' });
  } catch (error) {
    console.error('Pickup shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deliverShipment(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'provider') {
      res.status(403).json({ error: 'Only providers can deliver shipments' });
      return;
    }

    const providerId = req.user!.userId;
    const { id } = req.params;
    const supabase = getSupabaseAdmin();

    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    if (shipment.status !== 'in_transit' || shipment.provider_id !== providerId) {
      res.status(400).json({ error: 'Shipment cannot be delivered' });
      return;
    }

    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    if (shipment.payment_id && shipment.payment_method) {
      const providerType = PAYMENT_METHOD_MAP[shipment.payment_method as PaymentMethod];

      try {
        await withRetry(
          async () => {
            const result = await paymentService.confirmPayment(
              shipment.payment_id,
              providerType as PaymentProviderType
            );
            if (!result.success) throw new Error(result.error || 'Payment confirmation failed');
            return true;
          },
          3,
          500
        );
        logger.info(`Payment ${shipment.payment_id} confirmed for shipment ${id}`);
      } catch (paymentErr) {
        logger.error({ err: paymentErr, shipmentId: id }, `Failed to confirm payment ${shipment.payment_id} after retries`);
        res.status(500).json({ error: 'Payment confirmation failed. Shipment marked as delivered but payment pending.' });
        return;
      }
    }

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone, name')
      .eq('id', shipment.user_id)
      .single();

    eventBus.emitShipmentEvent({
      type: 'shipment:delivered',
      shipmentId: id,
      userId: shipment.user_id,
      providerId,
      metadata: {
        userEmail: clientUser?.email,
        userPhone: clientUser?.phone,
        userName: clientUser?.name,
      },
      timestamp: new Date(),
    });

    res.json({ message: 'Shipment delivered successfully' });
  } catch (error) {
    console.error('Deliver shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMyShipments(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const supabase = getSupabaseAdmin();

    let query = supabase.from('shipments').select(`
      *,
      packages (*),
      users!shipments_provider_id_fkey (name, phone)
    `);

    if (role === 'client') {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('provider_id', userId);
    }

    const { data: shipments, error } = await query.order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ shipments });
  } catch (error) {
    console.error('Get my shipments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getShipmentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const supabase = getSupabaseAdmin();

    const { data: shipment, error } = await supabase
      .from('shipments')
      .select(`
        *,
        packages (description, weight_kg, length_cm, width_cm, height_cm, notes),
        client:users!shipments_user_id_fkey (name, phone),
        provider:users!shipments_provider_id_fkey (name, phone)
      `)
      .eq('id', id)
      .single();

    if (error || !shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    if (role !== 'admin' && shipment.user_id !== userId && shipment.provider_id !== userId) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    res.json({ shipment });
  } catch (error) {
    console.error('Get shipment by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function cancelShipment(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    const supabase = getSupabaseAdmin();

    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('id, user_id, provider_id, status, payment_id, payment_method, total_price')
      .eq('id', id)
      .single();

    if (fetchError || !shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    if (role === 'client' && shipment.user_id !== userId) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    if (!['pending', 'accepted'].includes(shipment.status)) {
      res.status(400).json({ error: 'Shipment cannot be cancelled at this stage' });
      return;
    }

    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    // El refund se espera: si falla, el cliente tiene que enterarse. Antes esto
    // corria en background y se marcaba 'refunded' aunque el reembolso fallara.
    let refundStatus: 'not_applicable' | 'refunded' | 'failed' = 'not_applicable';
    let refundError: string | undefined;

    if (shipment.payment_id && shipment.payment_method && shipment.total_price) {
      const providerType = PAYMENT_METHOD_MAP[shipment.payment_method as PaymentMethod];
      if (providerType) {
        try {
          const refund = await paymentService.refundPayment(
            shipment.payment_id,
            providerType,
            shipment.total_price
          );

          if (refund.success) {
            refundStatus = 'refunded';
            await supabase
              .from('shipments')
              .update({ payment_status: 'refunded' })
              .eq('id', id);
          } else {
            refundStatus = 'failed';
            refundError = refund.error || 'Refund was not completed by the provider';
            await supabase
              .from('shipments')
              .update({ payment_status: 'refund_failed' })
              .eq('id', id);
            console.error('[Order] Refund failed for shipment', id, refundError);
          }
        } catch (err) {
          refundStatus = 'failed';
          refundError = err instanceof Error ? err.message : 'Unknown refund error';
          await supabase
            .from('shipments')
            .update({ payment_status: 'refund_failed' })
            .eq('id', id);
          console.error('[Order] Refund threw for shipment', id, err);
        }
      }
    }

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone, name')
      .eq('id', shipment.user_id)
      .single();

    eventBus.emitShipmentEvent({
      type: 'shipment:cancelled',
      shipmentId: id,
      userId: shipment.user_id,
      providerId: shipment.provider_id || undefined,
      metadata: {
        userEmail: clientUser?.email,
        userName: clientUser?.name,
        cancellationReason: reason,
      },
      timestamp: new Date(),
    });

    if (shipment.provider_id) {
      const { data: providerUser } = await supabase
        .from('users')
        .select('email, phone, name')
        .eq('id', shipment.provider_id)
        .single();

      eventBus.emitShipmentEvent({
        type: 'shipment:cancelled',
        shipmentId: id,
        userId: shipment.provider_id,
        metadata: {
          userEmail: providerUser?.email,
          userName: providerUser?.name,
          cancellationReason: reason,
          role: 'provider',
        },
        timestamp: new Date(),
      });
    }

    if (refundStatus === 'failed') {
      res.status(200).json({
        message: 'Shipment cancelled, but the refund could not be processed',
        refundStatus,
        refundError,
        action: 'Contact support to complete the refund manually',
      });
      return;
    }

    res.json({ message: 'Shipment cancelled successfully', refundStatus });
  } catch (error) {
    console.error('Cancel shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
