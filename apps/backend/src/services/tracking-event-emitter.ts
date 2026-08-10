// Bridges EventBus lifecycle events with WebSocket real-time tracking updates.
// Automatically broadcasts shipment status changes to connected clients.

import { eventBus, ShipmentEvent } from './event-bus.js';
import { TrackingWebSocket } from './tracking-websocket.js';
import { logger } from './logger.js';

let trackingWsInstance: TrackingWebSocket | null = null;

export function setTrackingWebSocket(ws: TrackingWebSocket): void {
  trackingWsInstance = ws;
  logger.info('Tracking WebSocket instance registered');
}

export function setupTrackingEventSubscribers(): void {
  if (!trackingWsInstance) {
    throw new Error('TrackingWebSocket must be registered before setting up subscribers. Call setTrackingWebSocket() first.');
  }

  const ws = trackingWsInstance;

  // Broadcast status changes to all tracking subscribers
  eventBus.on('shipment:accepted', (event: ShipmentEvent) => {
    try {
      ws.broadcastStatusChange(event.shipmentId, 'accepted', {
        providerId: event.providerId,
        providerName: event.metadata.providerName,
        vehicleType: event.metadata.vehicleType,
      });
      logger.debug({ shipmentId: event.shipmentId }, 'Broadcast: shipment accepted');
    } catch (err) {
      logger.error({ err, shipmentId: event.shipmentId }, 'Failed to broadcast shipment:accepted');
    }
  });

  eventBus.on('shipment:in_transit', (event: ShipmentEvent) => {
    try {
      ws.broadcastStatusChange(event.shipmentId, 'in_transit', {
        providerId: event.providerId,
      });
      logger.debug({ shipmentId: event.shipmentId }, 'Broadcast: shipment in transit');
    } catch (err) {
      logger.error({ err, shipmentId: event.shipmentId }, 'Failed to broadcast shipment:in_transit');
    }
  });

  eventBus.on('shipment:delivered', (event: ShipmentEvent) => {
    try {
      ws.broadcastStatusChange(event.shipmentId, 'delivered', {
        deliveredAt: new Date().toISOString(),
      });
      logger.debug({ shipmentId: event.shipmentId }, 'Broadcast: shipment delivered');
    } catch (err) {
      logger.error({ err, shipmentId: event.shipmentId }, 'Failed to broadcast shipment:delivered');
    }
  });

  eventBus.on('shipment:cancelled', (event: ShipmentEvent) => {
    try {
      ws.broadcastStatusChange(event.shipmentId, 'cancelled', {
        reason: event.metadata.reason,
      });
      logger.debug({ shipmentId: event.shipmentId }, 'Broadcast: shipment cancelled');
    } catch (err) {
      logger.error({ err, shipmentId: event.shipmentId }, 'Failed to broadcast shipment:cancelled');
    }
  });

  logger.info('Tracking event subscribers initialized');
}

export function broadcastLocationUpdate(
  shipmentId: string,
  providerId: string,
  lat: number,
  lng: number,
  speed?: number,
  heading?: number
): void {
  if (!trackingWsInstance) {
    logger.warn({ shipmentId, providerId }, 'broadcastLocationUpdate called but WebSocket not registered');
    return;
  }

  try {
    trackingWsInstance.broadcastLocation(shipmentId, {
      lat,
      lng,
      speed,
      heading,
      timestamp: new Date().toISOString(),
      providerId,
    });
  } catch (err) {
    logger.error({ err, shipmentId, providerId }, 'Failed to broadcast location update');
  }
}
