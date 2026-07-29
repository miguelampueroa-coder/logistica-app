import { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../config/database.js';
import { calculatePrice, calculateDistance } from '../services/pricing.service.js';
import { VehicleType, PaymentMethod } from '../types/index.js';
import { PaymentService, PaymentProviderType } from '../services/payment.service.js';
import { UnifiedNotificationService } from '../services/unified-notification.service.js';
import { createPushProvider } from '../services/push-notification.service.js';
import { createEmailProvider } from '../services/email.service.js';

const paymentService = new PaymentService();
let notificationService: UnifiedNotificationService | null = null;

function getNotificationService(): UnifiedNotificationService {
  if (!notificationService) {
    notificationService = new UnifiedNotificationService(
      createPushProvider(),
      createEmailProvider()
    );
  }
  return notificationService;
}

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

    const notifications = getNotificationService();

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone')
      .eq('id', userId)
      .single();

    if (clientUser) {
      notifications.sendOrderConfirmed(
        userId,
        clientUser.email,
        clientUser.phone || '',
        shipmentData.id,
        data.origin_address,
        data.dest_address
      ).catch(err => console.error('[Order] Client notification failed:', err));
    }

    const { data: nearbyProviders } = await supabase.rpc('find_nearby_providers', {
      p_lat: data.origin_lat,
      p_lng: data.origin_lng,
      p_radius_km: SEARCH_RADIUS_KM,
    });

    if (nearbyProviders && nearbyProviders.length > 0) {
      const providerIds = nearbyProviders.map((p: { id: string }) => p.id);
      notifications.sendNewOrderAlert(
        providerIds,
        shipmentData.id,
        data.origin_address,
        data.dest_address,
        priceBreakdown.totalPrice
      ).catch(err => console.error('[Order] Provider notification failed:', err));
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

    const notifications = getNotificationService();

    const { data: providerUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', providerId)
      .single();

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone')
      .eq('id', shipment.user_id)
      .single();

    if (clientUser && providerUser) {
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('brand, model, plate')
        .eq('id', vehicle_id)
        .single();

      const vehicleInfo = vehicleData
        ? `${vehicleData.brand || ''} ${vehicleData.model || ''} (${vehicleData.plate || ''})`.trim()
        : 'N/A';

      notifications.sendDriverAssigned(
        shipment.user_id,
        clientUser.email,
        providerUser.name,
        vehicleInfo
      ).catch(err => console.error('[Order] Accept notification failed:', err));
    }

    res.json({ message: 'Shipment accepted successfully' });
  } catch (error) {
    console.error('Accept shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function pickupShipment(req: Request, res: Response): Promise<void> {
  try {
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

    const notifications = getNotificationService();

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone')
      .eq('id', shipment.user_id)
      .single();

    if (clientUser) {
      notifications.sendPickedUp(
        shipment.user_id,
        clientUser.email,
        shipment.id
      ).catch(err => console.error('[Order] Pickup notification failed:', err));
    }

    res.json({ message: 'Shipment picked up successfully' });
  } catch (error) {
    console.error('Pickup shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deliverShipment(req: Request, res: Response): Promise<void> {
  try {
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
      if (providerType) {
        paymentService.confirmPayment(shipment.payment_id, providerType)
          .catch(err => console.error('[Order] Payment confirmation failed:', err));
      }
    }

    const notifications = getNotificationService();

    const { data: clientUser } = await supabase
      .from('users')
      .select('email, phone')
      .eq('id', shipment.user_id)
      .single();

    if (clientUser) {
      notifications.sendDelivered(
        shipment.user_id,
        clientUser.email,
        shipment.id
      ).catch(err => console.error('[Order] Delivery notification failed:', err));
    }

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
        users!shipments_user_id_fkey (name, phone),
        users!shipments_provider_id_fkey (name, phone)
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

    if (shipment.payment_id && shipment.payment_method && shipment.total_price) {
      const providerType = PAYMENT_METHOD_MAP[shipment.payment_method as PaymentMethod];
      if (providerType) {
        paymentService.refundPayment(shipment.payment_id, providerType, shipment.total_price)
          .then(() => {
            supabase
              .from('shipments')
              .update({ payment_status: 'refunded' })
              .eq('id', id)
              .then(() => {});
          })
          .catch(err => console.error('[Order] Refund failed:', err));
      }
    }

    const notifications = getNotificationService();

    const notifyUser = async (uid: string) => {
      const { data: user } = await supabase
        .from('users')
        .select('email, phone')
        .eq('id', uid)
        .single();
      return user;
    };

    const clientUser = await notifyUser(shipment.user_id);
    if (clientUser) {
      notifications.sendCancelled(
        shipment.user_id,
        clientUser.email,
        shipment.id,
        reason
      ).catch(err => console.error('[Order] Cancel notification (client) failed:', err));
    }

    if (shipment.provider_id) {
      const providerUser = await notifyUser(shipment.provider_id);
      if (providerUser) {
        notifications.sendCancelled(
          shipment.provider_id,
          providerUser.email,
          shipment.id,
          reason
        ).catch(err => console.error('[Order] Cancel notification (provider) failed:', err));
      }
    }

    res.json({ message: 'Shipment cancelled successfully' });
  } catch (error) {
    console.error('Cancel shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
