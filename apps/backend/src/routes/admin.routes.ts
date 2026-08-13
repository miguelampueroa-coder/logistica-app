import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize('admin'));

// ─── Dashboard Overview ─────────────────────────────────────────────

// GET /api/admin/dashboard — Full dashboard overview
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [
      { count: totalUsers },
      { count: totalProviders },
      { count: totalShipments },
      { count: activeShipments },
      { count: deliveredToday },
      { count: pendingShipments },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'provider'),
      supabase.from('shipments').select('*', { count: 'exact', head: true }),
      supabase.from('shipments').select('*', { count: 'exact', head: true }).in('status', ['accepted', 'in_transit']),
      supabase.from('shipments').select('*', { count: 'exact', head: true })
        .eq('status', 'delivered')
        .gte('delivered_at', `${today}T00:00:00Z`),
      supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    // Revenue (last 30 days)
    const { data: recentPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo);

    const revenue30d = (recentPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    // Today's metrics
    const { data: todayMetrics } = await supabase
      .from('crm_daily_metrics')
      .select('*')
      .eq('date', today)
      .single();

    res.json({
      overview: {
        totalUsers: totalUsers || 0,
        totalProviders: totalProviders || 0,
        totalShipments: totalShipments || 0,
        activeShipments: activeShipments || 0,
        pendingShipments: pendingShipments || 0,
        deliveredToday: deliveredToday || 0,
        revenueLast30Days: revenue30d,
      },
      today: todayMetrics || {
        total_conversations: 0,
        ai_handled: 0,
        human_handled: 0,
        orders_created: 0,
        orders_delivered: 0,
      },
    });
  } catch (error) {
    console.error('[Admin] Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── User Management ────────────────────────────────────────────────

// GET /api/admin/users — List all users with filters
router.get('/users', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { role, search, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (role) query = query.eq('role', role);
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ users: data, total: count });
  } catch (error) {
    console.error('[Admin] List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/users/:id — User detail with shipments
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at, updated_at')
      .eq('id', id)
      .single();

    if (userError || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get user's shipments
    const { data: shipments } = await supabase
      .from('shipments')
      .select('id, status, total_price, created_at, dest_address')
      .or(`user_id.eq.${id},provider_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get user's vehicles (if provider)
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, type, brand, model, plate, is_active')
      .eq('user_id', id);

    // Get user's ratings
    const { data: ratings } = await supabase
      .from('ratings')
      .select('score, comment, created_at')
      .eq('to_user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    const avgRating = ratings?.length
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : null;

    res.json({
      user,
      shipments: shipments || [],
      vehicles: vehicles || [],
      ratings: ratings || [],
      avgRating,
      totalShipments: shipments?.length || 0,
    });
  } catch (error) {
    console.error('[Admin] Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:id/toggle-active — Activate/deactivate user
router.patch('/users/:id/toggle-active', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: user } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', id)
      .single();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ is_active: !user.is_active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: `User ${user.is_active ? 'deactivated' : 'activated'}` });
  } catch (error) {
    console.error('[Admin] Toggle user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:id/role — Change user role
router.patch('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { role } = req.body;

    if (!['client', 'provider', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: `Role updated to ${role}` });
  } catch (error) {
    console.error('[Admin] Change role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Shipment Management ────────────────────────────────────────────

// GET /api/admin/shipments — List all shipments with filters
router.get('/shipments', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { status, provider_id, user_id, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('shipments')
      .select(`
        id, status, total_price, distance_km, urgency, created_at, updated_at,
        origin_address, dest_address,
        client:users!shipments_user_id_fkey (name, phone),
        provider:users!shipments_provider_id_fkey (name, phone)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (provider_id) query = query.eq('provider_id', provider_id);
    if (user_id) query = query.eq('user_id', user_id);

    const { data, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ shipments: data });
  } catch (error) {
    console.error('[Admin] List shipments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/shipments/:id/assign — Manually assign provider
router.patch('/shipments/:id/assign', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { provider_id, vehicle_id } = req.body;

    if (!provider_id || !vehicle_id) {
      res.status(400).json({ error: 'provider_id and vehicle_id are required' });
      return;
    }

    const { error } = await supabase
      .from('shipments')
      .update({
        provider_id,
        vehicle_id,
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending');

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Provider assigned successfully' });
  } catch (error) {
    console.error('[Admin] Assign provider error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/shipments/:id/cancel — Admin cancel shipment
router.patch('/shipments/:id/cancel', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { reason } = req.body;

    const { error } = await supabase
      .from('shipments')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || 'Cancelled by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Shipment cancelled' });
  } catch (error) {
    console.error('[Admin] Cancel shipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Financial Reports ──────────────────────────────────────────────

// GET /api/admin/finance/summary — Financial summary
router.get('/finance/summary', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data: payments } = await supabase
      .from('payments')
      .select('amount, method, status, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    const completed = (payments || []).filter(p => p.status === 'completed');
    const totalRevenue = completed.reduce((sum, p) => sum + (p.amount || 0), 0);

    const byMethod = {
      cash: completed.filter(p => p.method === 'cash').reduce((s, p) => s + (p.amount || 0), 0),
      card: completed.filter(p => p.method === 'card').reduce((s, p) => s + (p.amount || 0), 0),
      transfer: completed.filter(p => p.method === 'transfer').reduce((s, p) => s + (p.amount || 0), 0),
    };

    // Daily revenue
    const dailyRevenue: Record<string, number> = {};
    completed.forEach(p => {
      const day = p.created_at.split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + (p.amount || 0);
    });

    res.json({
      period: `${days} days`,
      totalRevenue,
      totalTransactions: completed.length,
      byMethod,
      dailyRevenue,
      avgTransactionValue: completed.length ? Math.round(totalRevenue / completed.length) : 0,
    });
  } catch (error) {
    console.error('[Admin] Finance summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── System Health ──────────────────────────────────────────────────

// GET /api/admin/system/health — System health check
router.get('/system/health', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();

    // Check DB connectivity
    const start = Date.now();
    const { error: dbError } = await supabase.from('users').select('id').limit(1);
    const dbLatency = Date.now() - start;

    // Check Redis
    let redisStatus = 'unknown';
    try {
      const Redis = (await import('ioredis')).default as unknown as new (...args: unknown[]) => { ping(): Promise<string>; disconnect(): void };
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      await redis.ping();
      redisStatus = 'connected';
      redis.disconnect();
    } catch {
      redisStatus = 'disconnected';
    }

    res.json({
      status: dbError ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbError ? 'error' : 'ok',
          latencyMs: dbLatency,
        },
        redis: {
          status: redisStatus,
        },
      },
    });
  } catch (error) {
    console.error('[Admin] Health check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
