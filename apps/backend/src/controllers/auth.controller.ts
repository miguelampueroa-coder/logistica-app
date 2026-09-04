import { Request, Response } from 'express';
import { z } from 'zod';
import { createAuthClient, getSupabaseAdmin } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { logger } from '../services/logger.js';
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

export const forgotPasswordSchema = z.object({
  email: z.string().email('Correo inválido'),
});

export const resetPasswordSchema = z.object({
  access_token: z.string().min(1, 'Falta el token del enlace de recuperación'),
  new_password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
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

/**
 * Envia el correo con el enlace para restablecer la contraseña.
 *
 * Responde siempre lo mismo, exista o no la cuenta. Si respondiera distinto,
 * cualquiera podria averiguar que correos estan registrados en Enviazo
 * probandolos uno por uno.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const respuestaNeutra = {
    message: 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña',
  };

  try {
    const { email } = req.body as { email: string };

    const redirectTo = env.PASSWORD_RESET_REDIRECT_URL;
    const { error } = await createAuthClient().auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      // Se registra pero no se le cuenta a quien pregunta: puede ser un correo
      // inexistente o un problema del proveedor de correo, y distinguirlos
      // hacia afuera filtra quien tiene cuenta.
      logger.warn({ err: error }, 'Fallo al enviar el correo de recuperacion');
    }

    res.json(respuestaNeutra);
  } catch (error) {
    logger.error({ err: error }, 'Error en forgotPassword');
    res.json(respuestaNeutra);
  }
}

/**
 * Fija la contraseña nueva usando el token del enlace del correo.
 *
 * El token lo emite Supabase y vence solo; aca se valida pidiendole a Supabase
 * el usuario que representa. Un token vencido o inventado no devuelve usuario.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { access_token, new_password } = req.body as {
      access_token: string;
      new_password: string;
    };

    const authClient = createAuthClient();
    const { data: userData, error: userError } = await authClient.auth.getUser(access_token);

    if (userError || !userData?.user) {
      res.status(400).json({
        error: 'El enlace de recuperación no es válido o ya venció. Pide uno nuevo.',
        reason: 'invalid_reset_token',
      });
      return;
    }

    // El cambio se hace con service role: el token del enlace sirve para
    // identificar al usuario, no para dejarlo operar sobre su cuenta.
    const supabase = getSupabaseAdmin();
    const { error: updateError } = await supabase.auth.admin.updateUserById(userData.user.id, {
      password: new_password,
    });

    if (updateError) {
      logger.error({ err: updateError, userId: userData.user.id }, 'Fallo al cambiar la contrasena');
      res.status(400).json({ error: 'No se pudo cambiar la contraseña. Intenta de nuevo.' });
      return;
    }

    logger.info({ userId: userData.user.id }, 'Contrasena restablecida');

    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (error) {
    logger.error({ err: error }, 'Error en resetPassword');
    res.status(500).json({ error: 'Error interno' });
  }
}
