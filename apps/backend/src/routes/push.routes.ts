import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getSupabaseAdmin } from '../config/database.js';

const router = Router();

const registerSchema = z.object({
  token: z.string().min(1, 'FCM token is required'),
  platform: z.enum(['ios', 'android']),
});

router.post(
  '/register',
  authenticate,
  validate(registerSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { token, platform } = req.body;
      const supabase = getSupabaseAdmin();

      const { data: existing } = await supabase
        .from('fcm_tokens')
        .select('id')
        .eq('token', token)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('fcm_tokens')
          .update({
            user_id: userId,
            platform,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) {
          res.status(400).json({ error: error.message });
          return;
        }

        res.json({ message: 'Token updated successfully' });
        return;
      }

      const { error } = await supabase.from('fcm_tokens').insert({
        user_id: userId,
        token,
        platform,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json({ message: 'Token registered successfully' });
    } catch (error) {
      console.error('Register push token error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/deregister', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { token } = req.body as { token?: string };
    const supabase = getSupabaseAdmin();

    let query = supabase.from('fcm_tokens').delete().eq('user_id', userId);

    if (token) {
      query = query.eq('token', token);
    }

    const { error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Device(s) deregistered successfully' });
  } catch (error) {
    console.error('Deregister push token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/devices', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const supabase = getSupabaseAdmin();

    const { data: devices, error } = await supabase
      .from('fcm_tokens')
      .select('id, platform, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ devices });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
