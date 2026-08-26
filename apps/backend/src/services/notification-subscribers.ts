import { eventBus, ShipmentEvent } from './event-bus.js';
import { UnifiedNotificationService } from './unified-notification.service.js';
import { createPushProvider } from './push-notification.service.js';
import { createEmailProvider } from './email.service.js';
import { logger } from './logger.js';

let notificationService: UnifiedNotificationService | null = null;
type ShipmentEventHandler = (event: ShipmentEvent) => Promise<void>;

const listeners: Array<{ event: string; handler: ShipmentEventHandler }> = [];

export function setupNotificationSubscribers(): void {
  if (notificationService) {
    logger.warn('Notification subscribers already initialized — skipping duplicate setup');
    return;
  }

  notificationService = new UnifiedNotificationService(
    createPushProvider(),
    createEmailProvider()
  );

  const handler1 = async (event: ShipmentEvent) => {
    try {
      const providerIds = event.metadata.nearbyProviderIds as string[] | undefined;
      if (Array.isArray(providerIds) && providerIds.length > 0) {
        await notificationService!.sendNewOrderAlert(
          providerIds,
          event.shipmentId,
          event.metadata.origin,
          event.metadata.destination,
          event.metadata.price
        );
      }

      await notificationService!.send({
        channels: ['email'],
        userId: event.userId,
        email: event.metadata.userEmail,
        emailMessage: {
          to: event.metadata.userEmail,
          subject: `Envío creado: ${event.shipmentId}`,
          html: `<p>Tu envío a ${event.metadata.destination} está listado</p>`,
        },
      });
    } catch (err) {
      logger.error({ err, shipmentId: event.shipmentId }, 'Failed to send shipment:created notification');
    }
  };
  eventBus.on('shipment:created', handler1);
  listeners.push({ event: 'shipment:created', handler: handler1 });

  const handler2 = async (event: ShipmentEvent) => {
    try {
      await notificationService!.send({
        channels: ['push', 'email'],
        userId: event.userId,
        email: event.metadata.userEmail,
        pushPayload: {
          title: 'Repartidor asignado',
          body: `${event.metadata.providerName} está en camino`,
          data: { shipmentId: event.shipmentId, action: 'open_tracking' },
        },
        emailMessage: {
          to: event.metadata.userEmail,
          subject: 'Repartidor asignado a tu envío',
          html: `<p>${event.metadata.providerName} entregará tu paquete</p>`,
        },
      });
    } catch (err) {
      logger.error({ err, shipmentId: event.shipmentId }, 'Failed to send shipment:accepted notification');
    }
  };
  eventBus.on('shipment:accepted', handler2);
  listeners.push({ event: 'shipment:accepted', handler: handler2 });

  const handler3 = async (event: ShipmentEvent) => {
    try {
      await notificationService!.send({
        channels: ['email', 'push'],
        userId: event.userId,
        email: event.metadata.userEmail,
        pushPayload: {
          title: 'Entregado',
          body: 'Tu envío llegó a destino',
          data: { shipmentId: event.shipmentId },
        },
        emailMessage: {
          to: event.metadata.userEmail,
          subject: 'Tu envío fue entregado',
          html: `<p>El envío ${event.shipmentId} fue entregado correctamente</p>`,
        },
      });
    } catch (err) {
      logger.error({ err, shipmentId: event.shipmentId }, 'Failed to send shipment:delivered notification');
    }
  };
  eventBus.on('shipment:delivered', handler3);
  listeners.push({ event: 'shipment:delivered', handler: handler3 });

  logger.info('Notification subscribers initialized');
}

export function teardownNotificationSubscribers(): void {
  listeners.forEach(({ event, handler }) => {
    eventBus.removeListener(event, handler);
  });
  listeners.length = 0;
  notificationService = null;
  logger.info('Notification subscribers torn down');
}
