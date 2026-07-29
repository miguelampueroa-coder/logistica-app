import { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../config/database.js';

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  is_available: z.boolean().optional(),
});

export const addVehicleSchema = z.object({
  type: z.enum(['moto', 'auto', 'furgoneta', 'camioneta', 'microbus', 'camion']),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.number().optional(),
  plate: z.string().optional(),
  capacity_kg: z.number().positive().optional(),
  capacity_m3: z.number().positive().optional(),
  photos: z.array(z.string()).optional(),
});

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const supabase = getSupabaseAdmin();

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const parsed = updateProfileSchema.parse(req.body);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('users')
      .update(parsed)
      .eq('id', userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function addVehicle(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const parsed = addVehicleSchema.parse(req.body);
    const supabase = getSupabaseAdmin();

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert({
        user_id: userId,
        ...parsed,
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({
      message: 'Vehicle added successfully',
      vehicle,
    });
  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMyVehicles(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const supabase = getSupabaseAdmin();

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ vehicles });
  } catch (error) {
    console.error('Get my vehicles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProviderEarnings(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const supabase = getSupabaseAdmin();

    // Obtener envíos completados del proveedor
    const { data: shipments, error } = await supabase
      .from('shipments')
      .select('total_price, delivered_at')
      .eq('provider_id', userId)
      .eq('status', 'delivered');

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Calcular ganancias
    const totalEarnings = shipments.reduce((sum, s) => sum + (s.total_price || 0), 0);
    const today = new Date().toISOString().split('T')[0];
    
    const todayEarnings = shipments
      .filter((s) => s.delivered_at && s.delivered_at.toString().startsWith(today))
      .reduce((sum, s) => sum + (s.total_price || 0), 0);

    res.json({
      earnings: {
        total: totalEarnings,
        today: todayEarnings,
        total_deliveries: shipments.length,
      },
    });
  } catch (error) {
    console.error('Get provider earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
