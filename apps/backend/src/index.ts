import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger, httpLogger } from './services/logger.js';
import { getHealthStatus } from './services/health.js';
import { setupGracefulShutdown } from './services/graceful-shutdown.js';
import { getCacheService } from './services/cache.service.js';
import authRoutes from './routes/auth.routes.js';
import orderRoutes from './routes/order.routes.js';
import userRoutes from './routes/user.routes.js';
import trackingRoutes from './routes/tracking.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import adminRoutes from './routes/admin.routes.js';
import pushRoutes from './routes/push.routes.js';
import { WhatsAppModule } from './modules/whatsapp/index.js';
import { createWebhookRoutes } from './modules/whatsapp/api/webhook.routes.js';
import whatsappAdminRoutes from './modules/whatsapp/api/admin.routes.js';
import { TrackingWebSocket } from './services/tracking-websocket.js';
import { startWorkers, scheduleDailyMetrics, scheduleCleanup, connection as redisConn } from './services/background-jobs.js';
import { setupSwagger } from './config/swagger.js';

const app = express();
const server = createServer(app);

// Logging HTTP
app.use(httpLogger);

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many auth attempts, please try again later.',
});

app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// API docs
setupSwagger(app);

// Health check
app.get('/health', async (req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);

// WhatsApp Logistics AI
let whatsappModule: WhatsAppModule | undefined;
if (env.WHATSAPP_ENABLED) {
  whatsappModule = WhatsAppModule.create({
    enabled: true,
    whatsapp: {
      accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
      verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
      apiVersion: env.WHATSAPP_API_VERSION,
    },
    defaultCompanyId: env.WHATSAPP_DEFAULT_COMPANY_ID,
  });

  app.use('/webhook', createWebhookRoutes(whatsappModule));
  app.use('/api/whatsapp', whatsappAdminRoutes);

  logger.info('WhatsApp Logistics AI module loaded');
} else {
  logger.info('WhatsApp Logistics AI module disabled (WHATSAPP_ENABLED=false)');
}

// WebSocket for real-time tracking
const trackingWs = new TrackingWebSocket(server);

// Background jobs
let workers: ReturnType<typeof startWorkers> = [];
try {
  workers = startWorkers();
  scheduleDailyMetrics();
  scheduleCleanup();
  logger.info('Background jobs initialized');
} catch (err) {
  logger.error({ err }, 'Failed to initialize background jobs');
}

// Initialize cache
getCacheService();

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Graceful shutdown
setupGracefulShutdown(server, {
  wsServers: [trackingWs.wss],
  redisConnections: [redisConn],
  workers,
  onShutdown: async () => {
    const cache = getCacheService();
    await cache.disconnect();
  },
});

// Start server
server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, `Server running on port ${env.PORT}`);
});

export default app;
