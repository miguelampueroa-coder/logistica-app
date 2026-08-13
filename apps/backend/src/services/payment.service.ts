// Payment service with Stripe and Webpay (Transbank) support.
// Handles payment creation, confirmation, refunds, and webhooks.

import Stripe from 'stripe';
import { getSupabaseAdmin } from '../config/database.js';

export type PaymentProviderType = 'stripe' | 'webpay' | 'cash';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface PaymentIntent {
  id: string;
  amount: number; // CLP
  currency: string;
  status: PaymentStatus;
  clientSecret?: string; // For Stripe frontend confirmation
  paymentUrl?: string; // For Webpay redirect
  metadata?: Record<string, string>;
}

export interface PaymentConfirmation {
  success: boolean;
  paymentId?: string;
  error?: string;
  receipt?: {
    amount: number;
    method: string;
    date: string;
    transactionId: string;
  };
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  error?: string;
}

export interface PaymentProvider {
  createPaymentIntent(amount: number, currency: string, metadata: Record<string, string>): Promise<PaymentIntent>;
  confirmPayment(paymentId: string, payload?: Record<string, unknown>): Promise<PaymentConfirmation>;
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
  handleWebhook(payload: unknown, signature: string): Promise<{ event: string; data: Record<string, unknown> } | null>;
}

// ─── Stripe Provider ────────────────────────────────────────────────

export class StripePaymentProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey);
  }

  async createPaymentIntent(
    amount: number,
    currency: string = 'clp',
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount), // Stripe expects integer
      currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    });

    return {
      id: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: this.mapStatus(intent.status),
      clientSecret: intent.client_secret || undefined,
    };
  }

  async confirmPayment(paymentId: string): Promise<PaymentConfirmation> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentId);

      if (intent.status === 'succeeded') {
        return {
          success: true,
          paymentId: intent.id,
          receipt: {
            amount: intent.amount,
            method: 'card',
            date: new Date().toISOString(),
            transactionId: intent.id,
          },
        };
      }

      return {
        success: false,
        error: `Payment status: ${intent.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount: amount ? Math.round(amount) : undefined,
      });

      return {
        success: refund.status === 'succeeded',
        refundId: refund.id,
        amount: refund.amount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async handleWebhook(
    payload: unknown,
    signature: string
  ): Promise<{ event: string; data: Record<string, unknown> } | null> {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
      const event = this.stripe.webhooks.constructEvent(
        payload as string | Buffer,
        signature,
        webhookSecret
      );

      return {
        event: event.type,
        data: event.data.object as unknown as Record<string, unknown>,
      };
    } catch (error) {
      console.error('[Stripe] Webhook signature verification failed:', error);
      return null;
    }
  }

  private mapStatus(stripeStatus: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'processing',
      'processing': 'processing',
      'succeeded': 'completed',
      'payment_failed': 'failed',
      'canceled': 'cancelled',
    };
    return map[stripeStatus] || 'pending';
  }
}

// ─── Webpay (Transbank) Provider ────────────────────────────────────

export class WebpayPaymentProvider implements PaymentProvider {
  private commerceCode: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { commerceCode: string; apiKey: string; environment?: string }) {
    this.commerceCode = config.commerceCode;
    this.apiKey = config.apiKey;
    this.baseUrl = config.environment === 'production'
      ? 'https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2'
      : 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2';
  }

  async createPaymentIntent(
    amount: number,
    _currency: string = 'clp',
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntent> {
    const sessionId = metadata.sessionId || `sess_${Date.now()}`;
    const buyOrder = metadata.orderId || `order_${Date.now()}`;

    const response = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tbk-Api-Key-Id': this.commerceCode,
        'Tbk-Api-Key-Secret': this.apiKey,
      },
      body: JSON.stringify({
        buy_order: buyOrder,
        session_id: sessionId,
        amount: Math.round(amount),
        return_url: metadata.returnUrl || 'http://localhost:3000/payment/return',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Webpay create failed: ${error}`);
    }

    const data = await response.json() as {
      token: string;
      url: string;
    };

    return {
      id: data.token,
      amount,
      currency: 'clp',
      status: 'pending',
      paymentUrl: `${data.url}?token_ws=${data.token}`,
      metadata: { buyOrder, sessionId },
    };
  }

  async confirmPayment(paymentId: string): Promise<PaymentConfirmation> {
    const response = await fetch(`${this.baseUrl}/transactions/${paymentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Tbk-Api-Key-Id': this.commerceCode,
        'Tbk-Api-Key-Secret': this.apiKey,
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Webpay confirm failed' };
    }

    const data = await response.json() as {
      response_code: number;
      status: string;
      amount: number;
      buy_order: string;
      authorization_code: string;
    };

    // response_code: 0 = success
    if (data.response_code === 0) {
      return {
        success: true,
        paymentId,
        receipt: {
          amount: data.amount,
          method: 'card',
          date: new Date().toISOString(),
          transactionId: data.authorization_code,
        },
      };
    }

    return {
      success: false,
      error: `Webpay response code: ${data.response_code}`,
    };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    // Webpay refund via credit note
    const response = await fetch(`${this.baseUrl}/transactions/${paymentId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tbk-Api-Key-Id': this.commerceCode,
        'Tbk-Api-Key-Secret': this.apiKey,
      },
      body: JSON.stringify({
        amount: amount ? Math.round(amount) : undefined,
      }),
    });

    if (!response.ok) {
      return { success: false, error: 'Webpay refund failed' };
    }

    const data = await response.json() as { type: string; response_code: number };

    return {
      success: data.response_code === 0,
      refundId: data.type,
      amount,
    };
  }

  // Webpay Plus no envia firma HMAC: Transbank redirige el navegador al
  // return_url con token_ws y la confirmacion autoritativa es el PUT a su API
  // con las credenciales de comercio. Por eso no se valida ninguna firma aqui;
  // lo que si se devuelve es el monto confirmado por Transbank para que quien
  // llame lo contraste con el monto registrado en la BD antes de dar por pagado.
  async handleWebhook(
    payload: unknown,
    _signature: string
  ): Promise<{ event: string; data: Record<string, unknown> } | null> {
    const data = payload as Record<string, unknown>;
    const token = data.token_ws as string;

    if (!token) return null;

    const result = await this.confirmPayment(token);

    // Solo se propagan datos que vienen de Transbank, nunca el body crudo del
    // request: ese body lo controla quien hace el POST.
    return {
      event: result.success ? 'payment.succeeded' : 'payment.failed',
      data: {
        token,
        confirmed: result.success,
        confirmedAmount: result.receipt?.amount,
        transactionId: result.receipt?.transactionId,
        error: result.error,
      },
    };
  }
}

// ─── Cash Provider (no external service) ────────────────────────────

export class CashPaymentProvider implements PaymentProvider {
  async createPaymentIntent(
    amount: number,
    _currency: string = 'clp',
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntent> {
    return {
      id: `cash_${Date.now()}`,
      amount,
      currency: 'clp',
      status: 'pending',
      metadata,
    };
  }

  // El efectivo no lo puede confirmar solo el sistema: alguien tiene que haber
  // recibido la plata. La ruta inyecta operatorConfirmed despues de validar que
  // quien confirma es admin o el prestador asignado; el cliente no puede.
  async confirmPayment(
    paymentId: string,
    payload?: Record<string, unknown>
  ): Promise<PaymentConfirmation> {
    if (!payload?.operatorConfirmed) {
      return {
        success: false,
        error: 'Cash payments must be confirmed by the assigned provider or an admin',
      };
    }

    return {
      success: true,
      paymentId,
      receipt: {
        amount: typeof payload.amount === 'number' ? payload.amount : 0,
        method: 'cash',
        date: new Date().toISOString(),
        transactionId: paymentId,
      },
    };
  }

  async refundPayment(): Promise<RefundResult> {
    return { success: false, error: 'Cash payments cannot be refunded automatically' };
  }

  async handleWebhook(): Promise<null> {
    return null;
  }
}

// ─── Payment Service (Unified) ──────────────────────────────────────

export class PaymentService {
  private providers: Map<PaymentProviderType, PaymentProvider> = new Map();

  constructor() {
    // Register available providers
    if (process.env.STRIPE_SECRET_KEY) {
      this.providers.set('stripe', new StripePaymentProvider(process.env.STRIPE_SECRET_KEY));
      console.log('[Payment] Stripe provider registered');
    }

    if (process.env.WEBPAY_COMMERCE_CODE && process.env.WEBPAY_API_KEY) {
      this.providers.set('webpay', new WebpayPaymentProvider({
        commerceCode: process.env.WEBPAY_COMMERCE_CODE,
        apiKey: process.env.WEBPAY_API_KEY,
        environment: process.env.WEBPAY_ENVIRONMENT,
      }));
      console.log('[Payment] Webpay provider registered');
    }

    // Cash always available
    this.providers.set('cash', new CashPaymentProvider());
  }

  getAvailableProviders(): PaymentProviderType[] {
    return Array.from(this.providers.keys());
  }

  async createPayment(
    shipmentId: string,
    amount: number,
    method: PaymentProviderType,
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntent> {
    const provider = this.providers.get(method);
    if (!provider) {
      throw new Error(`Payment provider '${method}' not available`);
    }

    const intent = await provider.createPaymentIntent(amount, 'clp', {
      shipmentId,
      ...metadata,
    });

    // Store payment record in DB
    const supabase = getSupabaseAdmin();
    await supabase.from('payments').insert({
      shipment_id: shipmentId,
      amount: Math.round(amount),
      method,
      status: 'pending',
      stripe_payment_id: intent.id,
    });

    return intent;
  }

  async confirmPayment(
    paymentIntentId: string,
    method: PaymentProviderType,
    payload?: Record<string, unknown>
  ): Promise<PaymentConfirmation> {
    const provider = this.providers.get(method);
    if (!provider) {
      throw new Error(`Payment provider '${method}' not available`);
    }

    const result = await provider.confirmPayment(paymentIntentId, payload);

    // Update payment status in DB
    if (result.success || result.error) {
      const supabase = getSupabaseAdmin();
      const newStatus = result.success ? 'completed' : 'failed';
      await supabase
        .from('payments')
        .update({ status: newStatus })
        .eq('stripe_payment_id', paymentIntentId);
    }

    return result;
  }

  async refundPayment(
    paymentIntentId: string,
    method: PaymentProviderType,
    amount?: number
  ): Promise<RefundResult> {
    const provider = this.providers.get(method);
    if (!provider) {
      throw new Error(`Payment provider '${method}' not available`);
    }

    const result = await provider.refundPayment(paymentIntentId, amount);

    // Update payment status in DB
    if (result.success) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('stripe_payment_id', paymentIntentId);
    }

    return result;
  }

  async handleWebhook(
    provider: PaymentProviderType,
    payload: unknown,
    signature: string
  ): Promise<{ event: string; data: Record<string, unknown> } | null> {
    const paymentProvider = this.providers.get(provider);
    if (!paymentProvider) return null;

    return paymentProvider.handleWebhook(payload, signature);
  }

  async getPaymentByShipment(shipmentId: string): Promise<Record<string, unknown> | null> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  }
}
