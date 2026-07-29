import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../config/database.js', () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock('../../services/pricing.service.js', () => ({
  calculatePrice: vi.fn().mockReturnValue({
    basePrice: 500,
    weightFee: 100,
    volumeFee: 50,
    urgencyFee: 0,
    vehicleMultiplier: 1,
    totalPrice: 650,
  }),
  calculateDistance: vi.fn().mockReturnValue(5.5),
}));

vi.mock('../../services/payment.service.js', () => ({
  PaymentService: vi.fn().mockImplementation(function () {
    return {
      createPayment: vi.fn().mockResolvedValue({
        id: 'pay_test_123',
        paymentUrl: 'https://pay.example.com/123',
        clientSecret: 'secret_123',
      }),
      confirmPayment: vi.fn().mockResolvedValue(true),
      refundPayment: vi.fn().mockResolvedValue(true),
    };
  }),
  PaymentProviderType: {},
}));

vi.mock('../../services/unified-notification.service.js', () => ({
  UnifiedNotificationService: vi.fn().mockImplementation(function () {
    return {
      sendOrderConfirmed: vi.fn().mockResolvedValue(true),
      sendNewOrderAlert: vi.fn().mockResolvedValue(true),
      sendDriverAssigned: vi.fn().mockResolvedValue(true),
      sendPickedUp: vi.fn().mockResolvedValue(true),
      sendDelivered: vi.fn().mockResolvedValue(true),
      sendCancelled: vi.fn().mockResolvedValue(true),
    };
  }),
}));

vi.mock('../../services/push-notification.service.js', () => ({
  createPushProvider: vi.fn().mockReturnValue({
    sendToUser: vi.fn().mockResolvedValue(true),
    sendToMultiple: vi.fn().mockResolvedValue({ success: true, successCount: 1, failureCount: 0 }),
    sendToTopic: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('../../services/email.service.js', () => ({
  createEmailProvider: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue(true),
  }),
}));

import { getSupabaseAdmin } from '../../config/database.js';

const JWT_SECRET = 'test-secret-jwt-for-integration';

function generateToken(payload: { userId: string; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

function createMockChain(overrides?: Partial<Record<string, unknown>>): MockChain {
  const chain: MockChain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit'];
  for (const m of methods) {
    chain[m as keyof MockChain].mockReturnValue(chain);
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      (chain as unknown as Record<string, unknown>)[key] = value;
    }
  }

  return chain;
}

function authenticateTest(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: 'client' | 'provider' | 'admin' };
    (req as Request & { user: { userId: string; email: string; role: 'client' | 'provider' | 'admin' } }).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorizeTest(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!(req as Request & { user?: { role: string } }).user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes((req as Request & { user: { role: string } }).user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

function validateTest(schema: { parse: (data: unknown) => unknown }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ error: 'Validation failed' });
    }
  };
}

import {
  createShipment,
  getAvailableShipments,
  acceptShipment,
  pickupShipment,
  deliverShipment,
  getMyShipments,
  getShipmentById,
  cancelShipment,
  createShipmentSchema,
} from '../../controllers/order.controller.js';

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());

  const orderRouter = express.Router();
  orderRouter.post('/', authenticateTest, authorizeTest('client'), validateTest(createShipmentSchema), createShipment);
  orderRouter.get('/', authenticateTest, getMyShipments);
  orderRouter.get('/:id', authenticateTest, getShipmentById);
  orderRouter.get('/available', authenticateTest, authorizeTest('provider'), getAvailableShipments);
  orderRouter.post('/:id/accept', authenticateTest, authorizeTest('provider'), acceptShipment);
  orderRouter.post('/:id/pickup', authenticateTest, authorizeTest('provider'), pickupShipment);
  orderRouter.post('/:id/deliver', authenticateTest, authorizeTest('provider'), deliverShipment);
  orderRouter.post('/:id/cancel', authenticateTest, cancelShipment);

  app.use('/api/orders', orderRouter);
  return app;
}

describe('Order Lifecycle Integration', () => {
  let app: express.Express;
  let clientToken: string;
  let providerToken: string;
  let mockDb: Record<string, unknown>;

  const createBody = {
    package_description: 'Test package',
    package_weight_kg: 5,
    package_length_cm: 30,
    package_width_cm: 20,
    package_height_cm: 15,
    origin_address: 'Av. Libertador 1000, Buenos Aires',
    origin_lat: -34.6037,
    origin_lng: -58.3816,
    dest_address: 'Av. Corrientes 2000, Buenos Aires',
    dest_lat: -34.6097,
    dest_lng: -58.3796,
    urgency: false,
    payment_method: 'card',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();

    mockDb = {
      from: vi.fn().mockImplementation((_table: string) => createMockChain()),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    clientToken = generateToken({
      userId: 'user-client-1',
      email: 'client@test.com',
      role: 'client',
    });
    providerToken = generateToken({
      userId: 'user-provider-1',
      email: 'provider@test.com',
      role: 'provider',
    });
  });

  function mockFrom(handler: (table: string) => MockChain) {
    (mockDb.from as ReturnType<typeof vi.fn>).mockImplementation(handler);
  }

  function usersChain(data: Record<string, unknown>): MockChain {
    return createMockChain({
      single: vi.fn().mockResolvedValue({ data, error: null }),
    });
  }

  it('should create a shipment successfully as a client', async () => {
    const pkgChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'pkg-1', description: 'Test package', weight_kg: 5 },
        error: null,
      }),
    });

    const shipChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'ship-1', status: 'pending', total_price: 650, user_id: 'user-client-1' },
        error: null,
      }),
    });

    mockFrom((table: string) => {
      if (table === 'users') return usersChain({ email: 'client@test.com', phone: '+1234567890', role: 'client' });
      if (table === 'packages') return pkgChain;
      if (table === 'shipments') return shipChain;
      return createMockChain();
    });

    (mockDb.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'user-provider-1' }],
      error: null,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', clientToken)
      .send(createBody);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Shipment created successfully');
  });

  it('should reject order creation without auth', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(createBody);

    expect(res.status).toBe(401);
  });

  it('should reject order creation by a provider', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', providerToken)
      .send(createBody);

    expect(res.status).toBe(403);
  });

  it('should accept a pending shipment as a provider', async () => {
    const vehicleChain = createMockChain({
      single: vi.fn().mockResolvedValue({ data: { id: 'vehicle-1' }, error: null }),
    });

    const shipmentChain = createMockChain({
      single: vi.fn()
        .mockResolvedValueOnce({
          data: { id: 'ship-1', status: 'pending', provider_id: null },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'ship-1', status: 'accepted', provider_id: 'user-provider-1' },
          error: null,
        }),
    });

    mockFrom((table: string) => {
      if (table === 'vehicles') return vehicleChain;
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ name: 'Provider', email: 'provider@test.com', phone: '+111', role: 'provider' });
      return createMockChain();
    });

    const res = await request(app)
      .post('/api/orders/ship-1/accept')
      .set('Authorization', providerToken)
      .send({ vehicle_id: 'vehicle-1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('accepted');
  });

  it('should pick up an accepted shipment', async () => {
    const shipmentChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'ship-1',
          status: 'accepted',
          provider_id: 'user-provider-1',
          user_id: 'user-client-1',
        },
        error: null,
      }),
    });

    mockFrom((table: string) => {
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ email: 'client@test.com', phone: '+123', role: 'provider' });
      return createMockChain();
    });

    const res = await request(app)
      .post('/api/orders/ship-1/pickup')
      .set('Authorization', providerToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('picked up');
  });

  it('should deliver an in_transit shipment', async () => {
    const shipmentChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'ship-1',
          status: 'in_transit',
          provider_id: 'user-provider-1',
          user_id: 'user-client-1',
          payment_id: 'pay_test_123',
          payment_method: 'card',
          total_price: 650,
        },
        error: null,
      }),
    });

    mockFrom((table: string) => {
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ email: 'client@test.com', phone: '+123', role: 'provider' });
      return createMockChain();
    });

    const res = await request(app)
      .post('/api/orders/ship-1/deliver')
      .set('Authorization', providerToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('delivered');
  });

  it('should cancel a pending shipment', async () => {
    const shipmentChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'ship-1',
          status: 'pending',
          user_id: 'user-client-1',
          provider_id: null,
          payment_id: null,
          payment_method: null,
          total_price: 650,
        },
        error: null,
      }),
    });

    mockFrom((table: string) => {
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ email: 'client@test.com', phone: '+123', role: 'client' });
      return createMockChain();
    });

    const res = await request(app)
      .post('/api/orders/ship-1/cancel')
      .set('Authorization', clientToken)
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('cancelled');
  });

  it('should reject cancelling a delivered shipment', async () => {
    const shipmentChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'ship-1', status: 'delivered', provider_id: 'user-provider-1', user_id: 'user-client-1' },
        error: null,
      }),
    });

    mockFrom((table: string) => {
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ role: 'client' });
      return createMockChain();
    });

    const res = await request(app)
      .post('/api/orders/ship-1/cancel')
      .set('Authorization', clientToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot be cancelled');
  });

  it('should reject pickup on a pending shipment', async () => {
    const shipmentChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'ship-1', status: 'pending', provider_id: 'user-provider-1' },
        error: null,
      }),
    });

    mockFrom((table: string) => {
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ role: 'provider' });
      return createMockChain();
    });

    const res = await request(app)
      .post('/api/orders/ship-1/pickup')
      .set('Authorization', providerToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot be picked up');
  });

  it('should reject delivery on a pending shipment', async () => {
    const shipmentChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'ship-1', status: 'pending', provider_id: 'user-provider-1' },
        error: null,
      }),
    });

    mockFrom((table: string) => {
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ role: 'provider' });
      return createMockChain();
    });

    const res = await request(app)
      .post('/api/orders/ship-1/deliver')
      .set('Authorization', providerToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot be delivered');
  });

  it('should return 404 for a non-existent shipment', async () => {
    const shipmentChain = createMockChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    });

    mockFrom((table: string) => {
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ role: 'client' });
      return createMockChain();
    });

    const res = await request(app)
      .get('/api/orders/nonexistent-id')
      .set('Authorization', clientToken);

    expect(res.status).toBe(404);
  });

  it('should reject accept with missing vehicle_id', async () => {
    const shipmentChain = createMockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'ship-1', status: 'pending', provider_id: null },
        error: null,
      }),
    });

    mockFrom((table: string) => {
      if (table === 'shipments') return shipmentChain;
      if (table === 'users') return usersChain({ role: 'provider' });
      return createMockChain();
    });

    const res = await request(app)
      .post('/api/orders/ship-1/accept')
      .set('Authorization', providerToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('vehicle_id');
  });
});
