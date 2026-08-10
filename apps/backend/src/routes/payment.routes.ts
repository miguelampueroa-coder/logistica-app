import { Router, Request, Response } from 'express';
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { PaymentService, PaymentProviderType } from '../services/payment.service.js';
import { getSupabaseAdmin } from '../config/database.js';
import { logger } from '../services/logger.js';

const router = Router();
const paymentService = new PaymentService();

// GET /api/payments/providers — List available payment providers
router.get('/providers', (_req: Request, res: Response) => {
  const providers = paymentService.getAvailableProviders();
  res.json({ providers });
});

// POST /api/payments/create — Create a payment intent
router.post('/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { shipmentId, method, returnUrl } = req.body;

    if (!shipmentId || !method) {
      res.status(400).json({ error: 'shipmentId and method are required' });
      return;
    }

    const validMethods: PaymentProviderType[] = ['stripe', 'webpay', 'cash'];
    if (!validMethods.includes(method)) {
      res.status(400).json({ error: `Invalid method. Use: ${validMethods.join(', ')}` });
      return;
    }

    // Get shipment price
    const supabase = getSupabaseAdmin();
    const { data: shipment } = await supabase
      .from('shipments')
      .select('id, total_price, user_id')
      .eq('id', shipmentId)
      .single();

    if (!shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    // Verify user owns this shipment
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (shipment.user_id !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    // Check if already paid
    const existingPayment = await paymentService.getPaymentByShipment(shipmentId);
    if (existingPayment && existingPayment.status === 'completed') {
      res.status(400).json({ error: 'Shipment already paid' });
      return;
    }

    const intent = await paymentService.createPayment(
      shipmentId,
      shipment.total_price,
      method,
      {
        userId: req.user.userId,
        returnUrl: returnUrl || 'http://localhost:3000/payment/return',
      }
    );

    res.status(201).json({
      payment: {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        clientSecret: intent.clientSecret,
        paymentUrl: intent.paymentUrl,
      },
    });
  } catch (error) {
    console.error('[Payment] Create error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments/confirm — Confirm a payment
router.post('/confirm', authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentId, method, payload } = req.body;

    if (!paymentId || !method) {
      res.status(400).json({ error: 'paymentId and method are required' });
      return;
    }

    const result = await paymentService.confirmPayment(paymentId, method, payload);

    if (result.success) {
      res.json({
        message: 'Payment confirmed',
        receipt: result.receipt,
      });
    } else {
      res.status(400).json({ error: result.error || 'Payment failed' });
    }
  } catch (error) {
    console.error('[Payment] Confirm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments/refund — Refund a payment
router.post('/refund', authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentId, method, amount } = req.body;

    if (!paymentId || !method) {
      res.status(400).json({ error: 'paymentId and method are required' });
      return;
    }

    // Only admin can refund
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can process refunds' });
      return;
    }

    const result = await paymentService.refundPayment(paymentId, method, amount);

    if (result.success) {
      res.json({
        message: 'Refund processed',
        refundId: result.refundId,
        amount: result.amount,
      });
    } else {
      res.status(400).json({ error: result.error || 'Refund failed' });
    }
  } catch (error) {
    console.error('[Payment] Refund error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payments/:shipmentId — Get payment for a shipment
router.get('/:shipmentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;

    const payment = await paymentService.getPaymentByShipment(shipmentId);
    if (!payment) {
      res.status(404).json({ error: 'No payment found for this shipment' });
      return;
    }

    res.json({ payment });
  } catch (error) {
    console.error('[Payment] Get error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments/webhook/stripe — Stripe webhook handler
// Use raw body middleware for Stripe signature validation
router.post('/webhook/stripe', express.raw({type: 'application/json'}), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      logger.warn('Stripe webhook missing signature header');
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    const result = await paymentService.handleWebhook('stripe', req.body, signature);

    if (result) {
      // Handle specific events
      switch (result.event) {
        case 'payment_intent.succeeded': {
          const paymentIntent = result.data;
          const meta = paymentIntent.metadata as Record<string, string> | undefined;
          const shipmentId = meta?.shipmentId;
          if (shipmentId) {
            // Mark shipment as paid
            const supabase = getSupabaseAdmin();
            await supabase
              .from('shipments')
              .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
              .eq('id', shipmentId);
          }
          break;
        }
        case 'payment_intent.payment_failed':
          console.log('[Webhook] Payment failed:', result.data.id);
          break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Payment] Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// POST /api/payments/webhook/webpay — Webpay webhook handler
router.post('/webhook/webpay', async (req: Request, res: Response) => {
  try {
    // Extract signature from Transbank header or token_ws query param
    const signature = (req.headers['x-transbank-signature'] || req.query.token_ws) as string;
    if (!signature) {
      logger.warn('Webpay webhook missing signature');
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    const result = await paymentService.handleWebhook('webpay', req.body, signature);

    if (result?.event === 'payment.succeeded') {
      const token = result.data.token as string;
      // Update payment status
      const supabase = getSupabaseAdmin();
      await supabase
        .from('payments')
        .update({ status: 'completed' })
        .eq('stripe_payment_id', token);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Payment] Webpay webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

export default router;
