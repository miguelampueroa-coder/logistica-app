// Unified notification service.
// Dispatches notifications via push, email, and WhatsApp.

import { PushNotificationProvider, PushPayload } from './push-notification.service.js';
import { EmailProvider, EmailMessage, EMAIL_TEMPLATES } from './email.service.js';
import { getSupabaseAdmin } from '../config/database.js';

export type NotificationChannel = 'push' | 'email' | 'whatsapp';

export interface NotificationOptions {
  channels: NotificationChannel[];
  userId?: string;
  email?: string;
  phone?: string;
  pushPayload?: PushPayload;
  emailMessage?: EmailMessage;
  whatsappMessage?: string;
}

export class UnifiedNotificationService {
  private pushProvider: PushNotificationProvider;
  private emailProvider: EmailProvider;

  constructor(pushProvider: PushNotificationProvider, emailProvider: EmailProvider) {
    this.pushProvider = pushProvider;
    this.emailProvider = emailProvider;
  }

  async send(options: NotificationOptions): Promise<Record<NotificationChannel, boolean>> {
    const results: Record<NotificationChannel, boolean> = {
      push: false,
      email: false,
      whatsapp: false,
    };

    const tasks: Promise<void>[] = [];

    if (options.channels.includes('push') && options.userId && options.pushPayload) {
      tasks.push(
        this.pushProvider.sendToUser(options.userId, options.pushPayload)
          .then(ok => { results.push = ok; })
          .catch(() => { results.push = false; })
      );
    }

    if (options.channels.includes('email') && options.email && options.emailMessage) {
      tasks.push(
        this.emailProvider.send(options.emailMessage)
          .then(ok => { results.email = ok; })
          .catch(() => { results.email = false; })
      );
    }

    if (options.channels.includes('whatsapp') && options.phone && options.whatsappMessage) {
      // WhatsApp sending handled by WhatsApp module
      results.whatsapp = true;
    }

    await Promise.allSettled(tasks);
    return results;
  }

  async sendOrderConfirmed(
    userId: string,
    email: string,
    phone: string,
    orderId: string,
    origin: string,
    destination: string
  ): Promise<void> {
    const template = EMAIL_TEMPLATES.ORDER_CONFIRMED(orderId, origin, destination);

    await this.send({
      channels: ['push', 'email'],
      userId,
      email,
      phone,
      pushPayload: {
        title: 'Envío confirmado',
        body: `Tu envío #${orderId} fue confirmado. Un repartidor será asignado pronto.`,
        data: { orderId, screen: 'order_detail' },
      },
      emailMessage: {
        to: email,
        ...template,
      },
    });
  }

  async sendDriverAssigned(
    userId: string,
    email: string,
    driverName: string,
    vehicleInfo: string
  ): Promise<void> {
    const template = EMAIL_TEMPLATES.DRIVER_ASSIGNED(driverName, vehicleInfo);

    await this.send({
      channels: ['push', 'email'],
      userId,
      email,
      pushPayload: {
        title: 'Repartidor asignado',
        body: `${driverName} va en camino a recoger tu paquete.`,
        data: { screen: 'tracking' },
      },
      emailMessage: {
        to: email,
        ...template,
      },
    });
  }

  async sendDelivered(
    userId: string,
    email: string,
    orderId: string
  ): Promise<void> {
    const template = EMAIL_TEMPLATES.DELIVERED(orderId);

    await this.send({
      channels: ['push', 'email'],
      userId,
      email,
      pushPayload: {
        title: '¡Entregado!',
        body: `Tu envío #${orderId} fue entregado.`,
        data: { orderId, screen: 'rate_delivery' },
      },
      emailMessage: {
        to: email,
        ...template,
      },
    });
  }

  async sendNewOrderAlert(
    providerIds: string[],
    orderId: string,
    origin: string,
    destination: string,
    price: number
  ): Promise<void> {
    await this.pushProvider.sendToMultiple(providerIds, {
      title: 'Nuevo envío disponible',
      body: `De ${origin} a ${destination} - $${price.toLocaleString('es-CL')} CLP`,
      data: { orderId, screen: 'available_orders' },
    });
  }

  async sendCancelled(
    userId: string,
    email: string,
    orderId: string,
    reason?: string
  ): Promise<void> {
    const template = EMAIL_TEMPLATES.ORDER_CANCELLED(orderId, reason);

    await this.send({
      channels: ['push', 'email'],
      userId,
      email,
      pushPayload: {
        title: 'Envío cancelado',
        body: `Tu envío #${orderId} fue cancelado.`,
        data: { orderId, screen: 'order_detail' },
      },
      emailMessage: {
        to: email,
        ...template,
      },
    });
  }

  async sendPickedUp(
    userId: string,
    email: string,
    orderId: string
  ): Promise<void> {
    const template = EMAIL_TEMPLATES.SHIPMENT_PICKED_UP(orderId);

    await this.send({
      channels: ['push', 'email'],
      userId,
      email,
      pushPayload: {
        title: 'Paquete recogido',
        body: `Tu envío #${orderId} fue recogido. En camino al destino.`,
        data: { orderId, screen: 'tracking' },
      },
      emailMessage: {
        to: email,
        ...template,
      },
    });
  }

  async sendRefundProcessed(
    userId: string,
    email: string,
    orderId: string,
    amount: number
  ): Promise<void> {
    const template = EMAIL_TEMPLATES.REFUND_PROCESSED(orderId, amount);

    await this.send({
      channels: ['push', 'email'],
      userId,
      email,
      pushPayload: {
        title: 'Reembolso procesado',
        body: `Se procesó un reembolso de $${amount.toLocaleString('es-CL')} CLP para el envío #${orderId}.`,
        data: { orderId, screen: 'order_detail' },
      },
      emailMessage: {
        to: email,
        ...template,
      },
    });
  }

  getPushProvider(): PushNotificationProvider {
    return this.pushProvider;
  }

  getEmailProvider(): EmailProvider {
    return this.emailProvider;
  }
}
