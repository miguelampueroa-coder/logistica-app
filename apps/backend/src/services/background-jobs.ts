// Background job system using BullMQ.
// Handles async tasks: notifications, scheduled cleanups, metrics aggregation.

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';

// Redis connection (shared across all queues)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

connection.on('connect', () => {
  console.log('[Redis] Connected');
});

const activeWorkers: Worker[] = [];

// ─── Queue Definitions ──────────────────────────────────────────────

export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  EMAIL: 'email',
  METRICS: 'metrics',
  CLEANUP: 'cleanup',
  TRACKING: 'tracking',
  WEBHOOKS: 'webhooks',
} as const;

// Notification queue
export const notificationQueue = new Queue(QUEUES.NOTIFICATIONS, { connection });
export const emailQueue = new Queue(QUEUES.EMAIL, { connection });
export const metricsQueue = new Queue(QUEUES.METRICS, { connection });
export const cleanupQueue = new Queue(QUEUES.CLEANUP, { connection });
export const trackingQueue = new Queue(QUEUES.TRACKING, { connection });
export const webhookQueue = new Queue(QUEUES.WEBHOOKS, { connection });

// ─── Job Types ──────────────────────────────────────────────────────

export interface NotificationJobData {
  type: 'push' | 'email' | 'whatsapp';
  userId?: string;
  email?: string;
  phone?: string;
  template: string;
  params: Record<string, string>;
}

export interface MetricsJobData {
  date: string;
  companyId?: string;
}

export interface CleanupJobData {
  type: 'conversations' | 'webhook_events' | 'location_history' | 'fcm_tokens';
  olderThanDays: number;
}

export interface WebhookJobData {
  url: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  retries?: number;
}

// ─── Job Processors (Workers) ───────────────────────────────────────

export function startWorkers(): Worker[] {
  const workers: Worker[] = [];

  // Notification Worker
  const notificationWorker = new Worker(QUEUES.NOTIFICATIONS, async (job: Job<NotificationJobData>) => {
    console.log(`[Worker] Processing notification: ${job.data.template}`);
    // Import services lazily to avoid circular deps
    const { createPushProvider } = await import('../services/push-notification.service.js');
    const { createEmailProvider, EMAIL_TEMPLATES } = await import('../services/email.service.js');

    const push = createPushProvider();
    const email = createEmailProvider();

    const { type, userId, email: toEmail, phone, template, params } = job.data;

    if (type === 'push' && userId) {
      await push.sendToUser(userId, {
        title: params.title || 'Enviazo',
        body: params.body || '',
        data: params.data ? JSON.parse(params.data) : {},
      });
    }

    if (type === 'email' && toEmail) {
      const tmpl = EMAIL_TEMPLATES[template as keyof typeof EMAIL_TEMPLATES];
      if (tmpl) {
        const emailData = (tmpl as (p: string) => { subject: string; html: string })(
          params.value || ''
        );
        await email.send({
          to: toEmail,
          subject: emailData.subject,
          html: emailData.html,
        });
      }
    }
  }, { connection, concurrency: 5 });

  notificationWorker.on('failed', (job, err) => {
    console.error(`[Worker] Notification job ${job?.id} failed:`, err.message);
  });

  // Email Worker (batch processing)
  const emailWorker = new Worker(QUEUES.EMAIL, async (job: Job<{ to: string; subject: string; html: string }>) => {
    console.log(`[Worker] Processing email to ${job.data.to}`);
    const { createEmailProvider } = await import('../services/email.service.js');
    const emailProvider = createEmailProvider();
    await emailProvider.send(job.data);
  }, { connection, concurrency: 3 });

  // Metrics Worker
  const metricsWorker = new Worker(QUEUES.METRICS, async (job: Job<MetricsJobData>) => {
    console.log(`[Worker] Aggregating metrics for ${job.data.date}`);
    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();

    const { date, companyId } = job.data;
    const cid = companyId || '00000000-0000-0000-0000-000000000000';

    // Count conversations
    const { count: convCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${date}T00:00:00Z`)
      .lt('created_at', `${date}T23:59:59Z`);

    // Count orders
    const { count: orderCount } = await supabase
      .from('dispatch_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${date}T00:00:00Z`)
      .lt('created_at', `${date}T23:59:59Z`);

    // Count delivered
    const { count: deliveredCount } = await supabase
      .from('dispatch_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'delivered')
      .gte('updated_at', `${date}T00:00:00Z`)
      .lt('updated_at', `${date}T23:59:59Z`);

    // Upsert metrics
    await supabase.from('crm_daily_metrics').upsert({
      company_id: cid,
      date,
      total_conversations: convCount || 0,
      orders_created: orderCount || 0,
      orders_delivered: deliveredCount || 0,
    }, { onConflict: 'company_id,date' });
  }, { connection, concurrency: 1 });

  // Cleanup Worker
  const cleanupWorker = new Worker(QUEUES.CLEANUP, async (job: Job<CleanupJobData>) => {
    console.log(`[Worker] Running cleanup: ${job.data.type}`);
    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();

    const cutoff = new Date(Date.now() - job.data.olderThanDays * 86400000).toISOString();

    switch (job.data.type) {
      case 'webhook_events':
        await supabase.from('webhook_events')
          .delete()
          .lt('created_at', cutoff);
        break;

      case 'location_history':
        await supabase.from('location_history')
          .delete()
          .lt('timestamp', cutoff);
        break;

      case 'fcm_tokens':
        // Remove tokens not updated in 90 days
        const oldCutoff = new Date(Date.now() - 90 * 86400000).toISOString();
        await supabase.from('fcm_tokens')
          .delete()
          .lt('updated_at', oldCutoff);
        break;

      case 'conversations':
        // Close inactive conversations older than 30 days
        await supabase.from('conversations')
          .update({ status: 'closed' })
          .eq('status', 'active')
          .lt('last_message_at', cutoff);
        break;
    }
  }, { connection, concurrency: 1 });

  workers.push(notificationWorker, emailWorker, metricsWorker, cleanupWorker);

  console.log('[Workers] All workers started');
  return workers;
}

// ─── Scheduled Jobs ─────────────────────────────────────────────────

export async function scheduleDailyMetrics(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await metricsQueue.add('daily-metrics', { date: today }, {
    repeat: { pattern: '0 2 * * *' }, // 2:00 AM daily
    jobId: `metrics-${today}`,
  });
}

export async function scheduleCleanup(): Promise<void> {
  // Clean webhook events older than 30 days
  await cleanupQueue.add('cleanup-webhooks', {
    type: 'webhook_events',
    olderThanDays: 30,
  }, {
    repeat: { pattern: '0 3 * * 0' }, // Sundays at 3 AM
  });

  // Clean location history older than the configured retention
  // (0 = conservar indefinidamente, requerido por la trazabilidad/bitacora)
  const locationRetentionDays = env.LOCATION_HISTORY_RETENTION_DAYS;
  if (locationRetentionDays > 0) {
    await cleanupQueue.add('cleanup-locations', {
      type: 'location_history',
      olderThanDays: locationRetentionDays,
    }, {
      repeat: { pattern: '0 3 * * 1' }, // Mondays at 3 AM
    });
  }

  // Clean stale FCM tokens
  await cleanupQueue.add('cleanup-tokens', {
    type: 'fcm_tokens',
    olderThanDays: 90,
  }, {
    repeat: { pattern: '0 4 1 * *' }, // 1st of month at 4 AM
  });

  // Close inactive conversations
  await cleanupQueue.add('cleanup-conversations', {
    type: 'conversations',
    olderThanDays: 30,
  }, {
    repeat: { pattern: '0 5 * * *' }, // Daily at 5 AM
  });
}

// ─── Job Helpers ────────────────────────────────────────────────────

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  await notificationQueue.add('send-notification', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
  });
}

export async function enqueueWebhook(data: WebhookJobData): Promise<void> {
  await webhookQueue.add('send-webhook', data, {
    attempts: data.retries || 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: true,
  });
}

export async function getQueueStats(): Promise<Record<string, { waiting: number; active: number; completed: number; failed: number }>> {
  const queues = [
    notificationQueue, emailQueue, metricsQueue,
    cleanupQueue, trackingQueue, webhookQueue,
  ];

  const stats: Record<string, { waiting: number; active: number; completed: number; failed: number }> = {};

  for (const queue of queues) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    stats[queue.name] = { waiting, active, completed, failed };
  }

  return stats;
}
