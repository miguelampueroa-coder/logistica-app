// WebSocket server for real-time shipment tracking.
// Clients subscribe to shipment updates, receive live GPS positions.

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyToken } from '../middleware/auth.js';

interface TrackingSubscription {
  ws: WebSocket;
  shipmentIds: Set<string>;
  userId: string;
  role: string;
}

export class TrackingWebSocket {
  private _wss: WebSocketServer;
  private subscriptions = new Map<WebSocket, TrackingSubscription>();
  private shipmentClients = new Map<string, Set<WebSocket>>();

  constructor(server: Server) {
    this._wss = new WebSocketServer({ server, path: '/ws/tracking' });

    this._wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log('[TrackingWS] WebSocket server started on /ws/tracking');
  }

  private async handleConnection(ws: WebSocket, req: import('http').IncomingMessage): Promise<void> {
    // Authenticate via query token
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const user = await verifyToken(token);
    if (!user) {
      ws.close(4001, 'Invalid token');
      return;
    }

    const sub: TrackingSubscription = {
      ws,
      shipmentIds: new Set(),
      userId: user.userId,
      role: user.role,
    };

    this.subscriptions.set(ws, sub);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(sub, msg);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      this.cleanupSubscription(sub);
    });

    ws.send(JSON.stringify({
      type: 'connected',
      userId: user.userId,
      role: user.role,
    }));
  }

  private handleMessage(sub: TrackingSubscription, msg: { type: string; shipmentId?: string; shipmentIds?: string[] }): void {
    switch (msg.type) {
      case 'subscribe':
        if (msg.shipmentId) {
          this.subscribeToShipment(sub, msg.shipmentId);
        }
        break;

      case 'unsubscribe':
        if (msg.shipmentId) {
          this.unsubscribeFromShipment(sub, msg.shipmentId);
        }
        break;

      case 'subscribe_bulk':
        if (Array.isArray(msg.shipmentIds)) {
          msg.shipmentIds.forEach(id => this.subscribeToShipment(sub, id));
        }
        break;

      case 'ping':
        sub.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  private subscribeToShipment(sub: TrackingSubscription, shipmentId: string): void {
    sub.shipmentIds.add(shipmentId);

    if (!this.shipmentClients.has(shipmentId)) {
      this.shipmentClients.set(shipmentId, new Set());
    }
    this.shipmentClients.get(shipmentId)!.add(sub.ws);

    sub.ws.send(JSON.stringify({
      type: 'subscribed',
      shipmentId,
    }));
  }

  private unsubscribeFromShipment(sub: TrackingSubscription, shipmentId: string): void {
    sub.shipmentIds.delete(shipmentId);
    const clients = this.shipmentClients.get(shipmentId);
    if (clients) {
      clients.delete(sub.ws);
      if (clients.size === 0) {
        this.shipmentClients.delete(shipmentId);
      }
    }

    sub.ws.send(JSON.stringify({
      type: 'unsubscribed',
      shipmentId,
    }));
  }

  private cleanupSubscription(sub: TrackingSubscription): void {
    sub.shipmentIds.forEach(id => {
      const clients = this.shipmentClients.get(id);
      if (clients) {
        clients.delete(sub.ws);
        if (clients.size === 0) {
          this.shipmentClients.delete(id);
        }
      }
    });
    this.subscriptions.delete(sub.ws);
  }

  /**
   * Broadcast location update to all subscribers of a shipment.
   */
  broadcastLocation(shipmentId: string, data: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    timestamp: string;
    providerId: string;
  }): void {
    const clients = this.shipmentClients.get(shipmentId);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'location_update',
      shipmentId,
      ...data,
    });

    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Broadcast status change to all subscribers.
   */
  broadcastStatusChange(shipmentId: string, newStatus: string, metadata?: Record<string, unknown>): void {
    const clients = this.shipmentClients.get(shipmentId);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'status_change',
      shipmentId,
      status: newStatus,
      metadata,
      timestamp: new Date().toISOString(),
    });

    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Get connected client count for a shipment.
   */
  getClientCount(shipmentId: string): number {
    return this.shipmentClients.get(shipmentId)?.size || 0;
  }

  /**
   * Get total connected clients.
   */
  get wss(): WebSocketServer {
    return this._wss;
  }

  getTotalClients(): number {
    return this.subscriptions.size;
  }
}
