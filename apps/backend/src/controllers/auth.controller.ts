import { Request, Response } from 'express';
import { z } from 'zod';
import { createAuthClient, getSupabaseAdmin } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { User, UserRole } from '../types/index.js';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  // 'admin' se asigna manualmente en la DB, nunca por autoregistro.
  role: z.enum(['client', 'provider']).default('client'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, phone, role } = req.body as {
      email: string; password: string; name: string; phone?: string; role: UserRole;
    };
    const supabase = getSupabaseAdmin();

    // En produccion el email se confirma por link, no automaticamente: si no,
    // cualquiera registra un correo ajeno y queda con la cuenta activa.
    const autoConfirmEmail = env.NODE_ENV !== 'production';

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: autoConfirmEmail,
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
      role,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      res.status(400).json({ error: profileError.message });
      return;
    }

    const user = { id: authData.user.id, email, name, phone, role };

    // Sin email confirmado no se entrega token: hay que verificar el correo primero.
    if (!autoConfirmEmail) {
      res.status(201).json({
        message: 'User registered. Check your email to confirm your account before logging in.',
        emailConfirmationRequired: true,
        user,
      });
      return;
    }

    const token = generateToken({
      userId: authData.user.id,
      email,
      role,
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      emailConfirmationRequired: false,
      user,
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

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.userId)
      .single();

    if (!profile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    const newToken = generateToken({
      userId: req.user.userId,
      email: req.user.email,
      role: profile.role,
    });

    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
