import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../../../config/database.js';
import { authenticate } from '../../../middleware/auth.js';
import { NotificationEngine, LOGISTICS_TEMPLATES } from '../services/notification.engine.js';

// NotificationEngine is injected via setNotificationEngine
let notificationEngine: NotificationEngine | null = null;

export function setNotificationEngine(engine: NotificationEngine): void {
  notificationEngine = engine;
}

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// GET /api/whatsapp/conversations — List conversations
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const {
      status,
      phone,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = supabase
      .from('conversations')
      .select(`
        id, customer_phone, customer_name, channel, status,
        last_message_at, created_at, updated_at,
        messages (id, content, direction, created_at)
      `)
      .order('last_message_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (phone) query = query.eq('customer_phone', phone);

    const { data, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ conversations: data });
  } catch (error) {
    console.error('[Admin] List conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/whatsapp/conversations/:id — Conversation detail
router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, direction, type, content, media_url, metadata, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgError) {
      res.status(400).json({ error: msgError.message });
      return;
    }

    // Get associated dispatch orders
    const { data: orders } = await supabase
      .from('dispatch_orders')
      .select('id, status, shipment_id, extracted_data, priority, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false });

    res.json({
      conversation,
      messages: messages || [],
      orders: orders || [],
    });
  } catch (error) {
    console.error('[Admin] Get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/whatsapp/conversations/:id/reply — Manual reply as operator
router.post('/conversations/:id/reply', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { content } = req.body;
    const operatorId = req.user!.userId;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('customer_phone, channel, status')
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Store operator message
    await supabase.from('messages').insert({
      conversation_id: id,
      direction: 'outbound',
      type: 'text',
      content,
      metadata: { operator_id: operatorId, is_manual: true },
    });

    // Update conversation status to active if it was pending_human
    if (conversation.status === 'pending_human') {
      await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', id);

      // End operator assignment
      await supabase
        .from('operator_assignments')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('conversation_id', id)
        .eq('status', 'active');
    }

    res.json({ message: 'Reply sent' });
  } catch (error) {
    console.error('[Admin] Reply error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/whatsapp/conversations/:id/assign — Assign operator
router.post('/conversations/:id/assign', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const operatorId = req.user!.userId;

    const { error } = await supabase
      .from('operator_assignments')
      .insert({
        conversation_id: id,
        operator_id: operatorId,
        status: 'active',
      });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    await supabase
      .from('conversations')
      .update({ status: 'active' })
      .eq('id', id);

    res.json({ message: 'Operator assigned' });
  } catch (error) {
    console.error('[Admin] Assign operator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/whatsapp/conversations/:id/close — Close conversation
router.post('/conversations/:id/close', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { error } = await supabase
      .from('conversations')
      .update({ status: 'closed' })
      .eq('id', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Conversation closed' });
  } catch (error) {
    console.error('[Admin] Close conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/whatsapp/orders — Orders created from WhatsApp
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { status, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('dispatch_orders')
      .select(`
        id, customer_phone, customer_name, status, priority,
        source_channel, extracted_data, shipment_id,
        created_at, updated_at
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ orders: data });
  } catch (error) {
    console.error('[Admin] List orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/whatsapp/metrics — CRM metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();

    const [
      { count: totalConversations },
      { count: activeConversations },
      { count: pendingHuman },
      { count: totalOrders },
    ] = await Promise.all([
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'pending_human'),
      supabase.from('dispatch_orders').select('*', { count: 'exact', head: true }),
    ]);

    // Get today's metrics
    const today = new Date().toISOString().split('T')[0];
    const { data: todayMetrics } = await supabase
      .from('crm_daily_metrics')
      .select('*')
      .eq('date', today)
      .single();

    res.json({
      summary: {
        totalConversations: totalConversations || 0,
        activeConversations: activeConversations || 0,
        pendingHumanIntervention: pendingHuman || 0,
        totalOrders: totalOrders || 0,
      },
      today: todayMetrics || {
        total_conversations: 0,
        ai_handled: 0,
        human_handled: 0,
        orders_created: 0,
        orders_delivered: 0,
        orders_cancelled: 0,
        total_revenue_clp: 0,
      },
    });
  } catch (error) {
    console.error('[Admin] Metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/whatsapp/metrics/aggregate — Aggregate daily metrics (run via cron)
router.post('/metrics/aggregate', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const date = req.body.date || new Date().toISOString().split('T')[0];

    // Count conversations created today
    const { count: convCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${date}T00:00:00Z`)
      .lt('created_at', `${date}T23:59:59Z`);

    // Count orders created today
    const { count: orderCount } = await supabase
      .from('dispatch_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${date}T00:00:00Z`)
      .lt('created_at', `${date}T23:59:59Z`);

    // Count delivered today
    const { count: deliveredCount } = await supabase
      .from('dispatch_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'delivered')
      .gte('updated_at', `${date}T00:00:00Z`)
      .lt('updated_at', `${date}T23:59:59Z`);

    // Count cancelled today
    const { count: cancelledCount } = await supabase
      .from('dispatch_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('updated_at', `${date}T00:00:00Z`)
      .lt('updated_at', `${date}T23:59:59Z`);

    // Count escalated today
    const { count: escalatedCount } = await supabase
      .from('crm_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('interaction_type', 'escalated')
      .gte('created_at', `${date}T00:00:00Z`)
      .lt('created_at', `${date}T23:59:59Z`);

    // Upsert daily metrics
    const { error } = await supabase
      .from('crm_daily_metrics')
      .upsert(
        {
          company_id: req.body.companyId || '00000000-0000-0000-0000-000000000000',
          date,
          total_conversations: convCount || 0,
          ai_handled: (convCount || 0) - (escalatedCount || 0),
          human_handled: escalatedCount || 0,
          orders_created: orderCount || 0,
          orders_delivered: deliveredCount || 0,
          orders_cancelled: cancelledCount || 0,
        },
        { onConflict: 'company_id,date' }
      );

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      date,
      aggregated: {
        conversations: convCount || 0,
        orders: orderCount || 0,
        delivered: deliveredCount || 0,
        cancelled: cancelledCount || 0,
        escalated: escalatedCount || 0,
      },
    });
  } catch (error) {
    console.error('[Admin] Metrics aggregation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/whatsapp/notifications/send — Send a custom message
router.post('/notifications/send', async (req: Request, res: Response) => {
  try {
    if (!notificationEngine) {
      res.status(503).json({ error: 'Notification engine not available' });
      return;
    }

    const { to, message } = req.body;

    if (!to || !message) {
      res.status(400).json({ error: 'to and message are required' });
      return;
    }

    const sent = await notificationEngine.sendDirectMessage(to, message);

    if (sent) {
      res.json({ message: 'Notification sent' });
    } else {
      res.status(500).json({ error: 'Failed to send notification' });
    }
  } catch (error) {
    console.error('[Admin] Send notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/whatsapp/notifications/order-status — Send order status update
router.post('/notifications/order-status', async (req: Request, res: Response) => {
  try {
    if (!notificationEngine) {
      res.status(503).json({ error: 'Notification engine not available' });
      return;
    }

    const { to, status, orderId, extras } = req.body;

    if (!to || !status || !orderId) {
      res.status(400).json({ error: 'to, status, and orderId are required' });
      return;
    }

    const template = LOGISTICS_TEMPLATES[status as keyof typeof LOGISTICS_TEMPLATES];
    if (!template) {
      res.status(400).json({ error: `Unknown status template: ${status}` });
      return;
    }

    const sent = await notificationEngine.sendTemplateNotification({
      to,
      templateName: template.name,
      language: 'es',
      variables: [
        { type: 'text', text: orderId },
        ...(extras || []),
      ],
    });

    if (sent) {
      res.json({ message: 'Order status notification sent' });
    } else {
      res.status(500).json({ error: 'Failed to send notification' });
    }
  } catch (error) {
    console.error('[Admin] Order status notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/whatsapp/notifications/bulk — Send bulk notifications
router.post('/notifications/bulk', async (req: Request, res: Response) => {
  try {
    if (!notificationEngine) {
      res.status(503).json({ error: 'Notification engine not available' });
      return;
    }

    const { recipients, message } = req.body;

    if (!Array.isArray(recipients) || !message) {
      res.status(400).json({ error: 'recipients (array) and message are required' });
      return;
    }

    const results = await Promise.allSettled(
      recipients.map((to: string) => notificationEngine!.sendDirectMessage(to, message))
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - sent;

    res.json({ sent, failed, total: results.length });
  } catch (error) {
    console.error('[Admin] Bulk notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
