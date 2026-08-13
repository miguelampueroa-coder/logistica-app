import { EventEmitter } from 'events';

export interface ShipmentEvent {
  type: 'shipment:created' | 'shipment:accepted' | 'shipment:in_transit' | 'shipment:delivered' | 'shipment:cancelled';
  shipmentId: string;
  userId: string;
  providerId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export class EventBus extends EventEmitter {
  static instance: EventBus;

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emitShipmentEvent(event: ShipmentEvent): void {
    this.emit(event.type, event);
    this.emit('shipment:*', event);
  }
}

export const eventBus = EventBus.getInstance();
