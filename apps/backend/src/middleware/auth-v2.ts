import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getSupabaseAdmin } from '../config/database.js';
import { AuthPayload, UserRole } from '../types/index.js';
import { getCacheService } from '../services/cache.service.js';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  is_available: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload & { profile?: UserProfile };
    }
  }
}

const USER_PROFILE_CACHE_TTL = 300; // 5 minutes

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const cache = getCacheService();
  const cacheKey = `user:profile:${userId}`;

  // Try cache first
  const cached = await cache.get<UserProfile>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from DB
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, phone, role, is_available')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  // Cache it
  await cache.set(cacheKey, JSON.stringify(data), USER_PROFILE_CACHE_TTL);
  return data as UserProfile;
}

export function generateToken(payload: AuthPayload): string {
  const expiresInSeconds = 24 * 60 * 60;
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: expiresInSeconds,
  });
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Centralized authentication middleware:
 * 1. Validates JWT signature
 * 2. Fetches user profile from BD (with cache)
 * 3. Verifies user is active
 * 4. Injects complete profile into request
 */
export async function authenticateV2(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Validate JWT
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

    // Fetch user profile with cache
    const profile = await getUserProfile(decoded.userId);

    if (!profile) {
      res.status(401).json({ error: 'User account not found' });
      return;
    }

    if (!profile.is_available) {
      res.status(403).json({ error: 'User account is suspended or inactive' });
      return;
    }

    // Inject complete user data
    req.user = {
      userId: decoded.userId,
      email: profile.email,
      role: profile.role,
      profile,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid or expired token' });
    } else {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

// Backwards compatibility: keep old names but use new implementation
export const authenticate = authenticateV2;
export const authenticateWithStatus = authenticateV2;
