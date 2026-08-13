import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '../../../config/database.js';
import { ChannelManager } from '../channels/messaging.provider.js';
import { IncomingMessage } from '../types/index.js';
import { createChildLogger } from '../../../services/logger.js';

const log = createChildLogger('webhook-gateway');

export class WebhookGateway {
  private channelManager: ChannelManager;
  private messageHandler?: (msg: IncomingMessage) => Promise<void>;
  private appSecret: string;
  private verifySignature: boolean;

  constructor(channelManager: ChannelManager) {
    this.channelManager = channelManager;
    this.appSecret = process.env.WHATSAPP_WEBHOOK_SECRET || '';
    this.verifySignature = process.env.WHATSAPP_VERIFY_SIGNATURE !== 'false';
  }

  setMessageHandler(handler: (msg: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  verifyRequestSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!this.verifySignature) return true;

    // Sin secreto no se puede verificar nada. En produccion eso significa
    // rechazar: dejar pasar webhooks sin firma permite que cualquiera inyecte
    // mensajes falsos y genere pedidos. En desarrollo se deja pasar para poder
    // probar sin credenciales, pero avisando.
    if (!this.appSecret) {
      if (process.env.NODE_ENV === 'production') {
        log.error('WHATSAPP_WEBHOOK_SECRET not configured: rejecting webhook in production');
        return false;
      }
      log.warn('WHATSAPP_WEBHOOK_SECRET not configured, skipping signature verification (dev only)');
      return true;
    }

    if (!signatureHeader) return false;

    const expectedPrefix = 'sha256=';
    if (!signatureHeader.startsWith(expectedPrefix)) return false;

    const expectedSignature = signatureHeader.slice(expectedPrefix.length);

    // Solo hex: sin esto, una firma del largo correcto pero con caracteres no
    // hex produce un Buffer mas corto y timingSafeEqual tira una excepcion.
    if (!/^[0-9a-f]+$/i.test(expectedSignature)) return false;

    const hmac = createHmac('sha256', this.appSecret).update(rawBody).digest('hex');

    if (hmac.length !== expectedSignature.length) return false;

    return timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedSignature, 'hex'));
  }

  handleVerification(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Sin el token configurado, token y WHATSAPP_VERIFY_TOKEN son ambos
    // undefined y la comparacion daba true, dejando pasar la verificacion.
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && expectedToken && token === expectedToken) {
      log.info('Webhook verification successful');
      res.status(200).send(challenge);
    } else {
      log.warn('Webhook verification failed');
      res.sendStatus(403);
    }
  }

  async handleIncoming(req: Request, res: Response): Promise<void> {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    if (!this.verifyRequestSignature(rawBody || Buffer.from(JSON.stringify(req.body)), signature)) {
      log.warn('Webhook signature verification failed');
      res.sendStatus(403);
      return;
    }

    const supabase = getSupabaseAdmin();

    try {
      res.sendStatus(200);

      const body = req.body;

      // Log webhook event for audit
      const eventType = body.entry?.[0]?.changes?.[0]?.field || 'unknown';
      await supabase.from('webhook_events').insert({
        channel: 'whatsapp',
        event_type: eventType,
        payload: body,
        processing_status: 'pending',
      });

      // Determine which channel provider to use
      const provider = this.channelManager.get('whatsapp');
      if (!provider) {
        console.error('[Webhook] No WhatsApp provider registered');
        return;
      }

      // Parse messages from webhook payload
      const messages = provider.parseWebhook(body);

      for (const msg of messages) {
        await this.processMessage(msg, supabase);
      }
    } catch (error) {
      console.error('[Webhook] Processing error:', error);

      // Try to log the error
      try {
        await supabase.from('webhook_events').insert({
          channel: 'whatsapp',
          event_type: 'processing_error',
          payload: { error: String(error) },
          processing_status: 'failed',
          error: String(error),
        });
      } catch {
        // Silently fail — don't crash on logging errors
      }
    }
  }

  private async processMessage(
    msg: IncomingMessage,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<void> {
    // Idempotency check — skip duplicate messages
    if (msg.id) {
      const { data: existing } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('provider_message_id', msg.id)
        .eq('processing_status', 'completed')
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[Webhook] Duplicate message ${msg.id}, skipping`);
        return;
      }
    }

    // Mark as processing
    if (msg.id) {
      await supabase.from('webhook_events').insert({
        channel: msg.channel,
        event_type: 'message',
        provider_message_id: msg.id,
        payload: msg.rawPayload,
        processing_status: 'processing',
        idempotency_key: `${msg.channel}:${msg.id}`,
      });
    }

    // Dispatch to handler
    if (this.messageHandler) {
      await this.messageHandler(msg);
    }

    // Mark as completed
    if (msg.id) {
      await supabase
        .from('webhook_events')
        .update({ processing_status: 'completed' })
        .eq('provider_message_id', msg.id)
        .eq('processing_status', 'processing');
    }
  }
}
