import { Request, Response } from 'express';
import { z } from 'zod';
import { createAuthClient, getSupabaseAdmin } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { User, UserRole } from '../types/index.js';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, phone } = req.body;
    const supabase = getSupabaseAdmin();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      res.status(400).json({ error: authError.message });
      return;
    }

    const { error: profileError } = await supabase.from('users').insert({
      id: authData.user.id,
      email,
      name,
      phone,
      role: 'client',
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      res.status(400).json({ error: profileError.message });
      return;
    }

    const token = generateToken({
      userId: authData.user.id,
      email,
      role: 'client',
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: authData.user.id,
        email,
        name,
        phone,
        role: 'client',
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const supabase = getSupabaseAdmin();

    // Cliente efimero: signInWithPassword deja la sesion del usuario
    // adherida al cliente que la ejecuta, y el admin es un singleton
    // compartido por todo el proceso.
    const { data: authData, error: authError } = await createAuthClient().auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    // Generar token
    const token = generateToken({
      userId: authData.user.id,
      email,
      role: profile.role,
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
