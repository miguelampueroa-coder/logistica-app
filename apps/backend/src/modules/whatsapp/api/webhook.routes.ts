import express, { Router, Request, Response, NextFunction } from 'express';
import { WhatsAppModule } from '../index.js';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

function captureRawBody(req: Request, res: Response, next: NextFunction): void {
  const jsonParser = express.json({
    verify: (_req, _res, buf) => {
      req.rawBody = buf;
    },
  });
  jsonParser(req, res, next);
}

export function createWebhookRoutes(whatsapp: WhatsAppModule): Router {
  const router = Router();

  router.get('/whatsapp', (req: Request, res: Response) => {
    whatsapp.webhookGateway.handleVerification(req, res);
  });

  router.post('/whatsapp', captureRawBody, (req: Request, res: Response) => {
    whatsapp.webhookGateway.handleIncoming(req, res);
  });

  // POST /webhook/test — Send a test message (dev only)
  if (process.env.NODE_ENV === 'development') {
    router.post('/test', async (req: Request, res: Response) => {
      const { phone, text } = req.body;

      if (!phone || !text) {
        res.status(400).json({ error: 'phone and text are required' });
        return;
      }

      const provider = whatsapp.channelManager.get('whatsapp');
      if (!provider) {
        res.status(500).json({ error: 'No provider available' });
        return;
      }

      // Simulate an incoming message
      const simulatedMessages = provider.parseWebhook({
        _testMessage: { from: phone, text, type: 'text' },
      });

      if (simulatedMessages.length === 0) {
        res.status(500).json({ error: 'Failed to simulate message' });
        return;
      }

      // Process through engine
      const companyId = whatsapp.config.defaultCompanyId || '00000000-0000-0000-0000-000000000000';
      await whatsapp.conversationEngine.processMessage(simulatedMessages[0], companyId);

      res.json({
        message: 'Test message processed',
        simulated: { from: phone, text },
      });
    });
  }

  return router;
}
