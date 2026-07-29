// WhatsApp Template Notification Engine.
// Sends proactive messages for order status updates, delivery confirmations, etc.
// Uses WhatsApp Business Template API for approved templates.

import { getSupabaseAdmin } from '../../../config/database.js';
import { ChannelManager } from '../channels/messaging.provider.js';

export interface TemplateVariable {
  type: 'text' | 'currency' | 'date_time';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
}

export interface NotificationPayload {
  to: string;
  templateName: string;
  language: string;
  variables: TemplateVariable[];
}

/**
 * Pre-built notification templates for logistics.
 */
export const LOGISTICS_TEMPLATES = {
  ORDER_CONFIRMED: {
    name: 'logistics_order_confirmed',
    language: 'es',
    getText: (vars: { orderId: string; origin: string; destination: string }) =>
      `Tu envío #${vars.orderId} ha sido confirmado.\nOrigen: ${vars.origin}\nDestino: ${vars.destination}\n\nUn repartidor será asignado pronto.`,
  },
  DRIVER_ASSIGNED: {
    name: 'logistics_driver_assigned',
    language: 'es',
    getText: (vars: { driverName: string; vehicleInfo: string }) =>
      `Repartidor asignado: ${vars.driverName}\nVehículo: ${vars.vehicleInfo}\n\nEl repartidor va en camino a recoger tu paquete.`,
  },
  PACKAGE_PICKED_UP: {
    name: 'logistics_package_picked_up',
    language: 'es',
    getText: (vars: { orderId: string }) =>
      `Tu envío #${vars.orderId} ha sido recogido y está en camino.`,
  },
  DELIVERY_IN_PROGRESS: {
    name: 'logistics_delivery_in_progress',
    language: 'es',
    getText: (vars: { orderId: string; estimatedTime: string }) =>
      `Tu envío #${vars.orderId} está en camino.\nTiempo estimado: ${vars.estimatedTime}`,
  },
  DELIVERED: {
    name: 'logistics_delivered',
    language: 'es',
    getText: (vars: { orderId: string }) =>
      `Tu envío #${vars.orderId} ha sido entregado.\n\n¿Todo bien? Califica tu experiencia con "calificar ${vars.orderId}"`,
  },
  ORDER_CANCELLED: {
    name: 'logistics_order_cancelled',
    language: 'es',
    getText: (vars: { orderId: string; reason: string }) =>
      `Tu envío #${vars.orderId} ha sido cancelado.\nMotivo: ${vars.reason}`,
  },
  PAYMENT_RECEIVED: {
    name: 'logistics_payment_received',
    language: 'es',
    getText: (vars: { amount: string }) =>
      `Hemos recibido tu pago de $${vars.amount}. Tu envío será procesado.`,
  },
} as const;

export class NotificationEngine {
  private channelManager: ChannelManager;

  constructor(channelManager: ChannelManager) {
    this.channelManager = channelManager;
  }

  /**
   * Send a pre-built notification using a template.
   */
  async sendTemplateNotification(
    payload: NotificationPayload
  ): Promise<boolean> {
    const provider = this.channelManager.get('whatsapp');
    if (!provider) {
      console.error('[Notification] No WhatsApp provider');
      return false;
    }

    try {
      // For mock provider, send as text instead of template
      // Real implementation would use WhatsApp Template API
      const template = Object.values(LOGISTICS_TEMPLATES)
        .find(t => t.name === payload.templateName);

      if (template && 'getText' in template) {
        const getTextFn = (template as unknown as { getText: (vars: Record<string, string>) => string }).getText;
        const varValues: Record<string, string> = {};
        payload.variables.forEach((v, i) => {
          varValues[`var${i}`] = v.text || v.currency?.fallback_value || v.date_time?.fallback_value || '';
        });
        const text = getTextFn(varValues);

        await provider.sendMessage({
          to: payload.to,
          channel: 'whatsapp',
          type: 'text',
          content: text,
        });
      }

      // Log the notification
      await this.logNotification(payload);
      return true;
    } catch (error) {
      console.error('[Notification] Failed:', error);
      return false;
    }
  }

  /**
   * Send a direct text message (for non-template notifications).
   */
  async sendDirectMessage(
    to: string,
    text: string
  ): Promise<boolean> {
    const provider = this.channelManager.get('whatsapp');
    if (!provider) return false;

    try {
      await provider.sendMessage({
        to,
        channel: 'whatsapp',
        type: 'text',
        content: text,
      });
      return true;
    } catch (error) {
      console.error('[Notification] Direct message failed:', error);
      return false;
    }
  }

  /**
   * Notify driver about assignment.
   */
  async notifyDriverAssigned(
    driverPhone: string,
    orderId: string,
    pickupAddress: string,
    vehicleInfo: string
  ): Promise<boolean> {
    return this.sendDirectMessage(
      driverPhone,
      `📦 Envío #${orderId} asignado a ti.\n` +
      `Recoger en: ${pickupAddress}\n` +
      `Vehículo: ${vehicleInfo}\n\n` +
      `Responde "listo" cuando vayas en camino.`
    );
  }

  /**
   * Notify customer about driver assigned.
   */
  async notifyCustomerDriverAssigned(
    customerPhone: string,
    driverName: string,
    vehicleInfo: string
  ): Promise<boolean> {
    return this.sendTemplateNotification({
      to: customerPhone,
      templateName: LOGISTICS_TEMPLATES.DRIVER_ASSIGNED.name,
      language: 'es',
      variables: [
        { type: 'text', text: driverName },
        { type: 'text', text: vehicleInfo },
      ],
    });
  }

  /**
   * Notify delivery completion.
   */
  async notifyDelivered(
    customerPhone: string,
    orderId: string
  ): Promise<boolean> {
    return this.sendTemplateNotification({
      to: customerPhone,
      templateName: LOGISTICS_TEMPLATES.DELIVERED.name,
      language: 'es',
      variables: [
        { type: 'text', text: orderId },
      ],
    });
  }

  private async logNotification(payload: NotificationPayload): Promise<void> {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('webhook_events').insert({
        channel: 'whatsapp',
        event_type: 'notification_sent',
        payload: {
          to: payload.to,
          template: payload.templateName,
          language: payload.language,
        },
        processing_status: 'completed',
      });
    } catch {
      // Silent fail
    }
  }
}
