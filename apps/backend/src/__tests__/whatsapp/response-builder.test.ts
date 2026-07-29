import { describe, it, expect } from 'vitest';
import { ResponseBuilder } from '../../modules/whatsapp/engine/response.builder.js';

describe('ResponseBuilder', () => {
  const builder = new ResponseBuilder();

  describe('greetings', () => {
    it('returns a greeting message', () => {
      const msg = builder.greeting();
      expect(msg).toBeTruthy();
      expect(typeof msg).toBe('string');
    });

    it('returns returning customer greeting', () => {
      const msg = builder.returningCustomerGreeting();
      expect(msg).toBeTruthy();
    });
  });

  describe('order flow', () => {
    it('asks for origin', () => {
      const msg = builder.askOrigin();
      expect(msg).toBeTruthy();
      expect(msg.length).toBeGreaterThan(5);
    });

    it('asks for destination', () => {
      const msg = builder.askDestination();
      expect(msg).toBeTruthy();
    });

    it('asks for recipient', () => {
      const msg = builder.askRecipient();
      expect(msg).toBeTruthy();
    });

    it('asks for package info', () => {
      const msg = builder.askPackage();
      expect(msg).toBeTruthy();
    });

    it('confirms origin and asks destination', () => {
      const msg = builder.confirmOriginAndAskDestination('Av. Principal 123');
      expect(msg).toContain('Av. Principal 123');
      expect(msg.toLowerCase()).toContain('entregamos');
    });

    it('confirms destination and asks recipient', () => {
      const msg = builder.confirmDestinationAndAskRecipient('Calle Falsa 456');
      expect(msg).toContain('Calle Falsa 456');
      expect(msg.toLowerCase()).toContain('recibe');
    });

    it('confirms recipient and asks package', () => {
      const msg = builder.confirmRecipientAndAskPackage('Juan', '+56912345678');
      expect(msg).toContain('Juan');
      expect(msg).toContain('56912345678');
    });
  });

  describe('order summary', () => {
    it('includes draft and full quote info', () => {
      const draft = {
        originAddress: 'Av. Principal',
        destAddress: 'Calle Falsa',
        destContactName: 'Juan',
        destContactPhone: '+56912345678',
        packageDescription: 'Documento',
        packageWeightKg: 1,
      };
      const quote = {
        totalPrice: 5000,
        basePrice: 3000,
        weightFee: 1000,
        volumeFee: 500,
        urgencyFee: 500,
        vehicleMultiplier: 1,
      };

      const msg = builder.orderSummary(draft, quote);
      expect(msg).toContain('$5.000');
      expect(msg).toContain('Juan');
      expect(msg).toContain('Av. Principal');
      expect(msg).toContain('Calle Falsa');
    });

    it('handles missing optional fields', () => {
      const draft = {};
      const quote = { totalPrice: 3000, basePrice: 2000, weightFee: 500, volumeFee: 500, urgencyFee: 0, vehicleMultiplier: 1 };
      const msg = builder.orderSummary(draft, quote);
      expect(msg).toContain('$3.000');
      expect(msg).toContain('No definido');
    });
  });

  describe('order status', () => {
    it('order created message contains short code', () => {
      const msg = builder.orderCreated('abc12345-1234');
      expect(msg).toContain('ABC12345');
    });

    it('order error message is not empty', () => {
      const msg = builder.orderError('Test error');
      expect(msg).toContain('Test error');
    });

    it('order cancelled message', () => {
      const msg = builder.orderCancelled();
      expect(msg).toBeTruthy();
    });

    it('order cancelled start message', () => {
      const msg = builder.orderCancelledStart();
      expect(msg).toBeTruthy();
    });
  });

  describe('ambiguous address', () => {
    it('lists multiple options', () => {
      const options = ['Puerto Montt Centro', 'Puerto Montt Norte', 'Puerto Montt Sur'];
      const msg = builder.ambiguousAddress(options);
      expect(msg).toContain('Puerto Montt Centro');
      expect(msg).toContain('Puerto Montt Norte');
      expect(msg).toContain('Puerto Montt Sur');
      expect(msg).toContain('1.');
      expect(msg).toContain('2.');
      expect(msg).toContain('3.');
    });

    it('handles empty options', () => {
      const msg = builder.ambiguousAddress([]);
      expect(msg).toContain('No encontré');
    });
  });

  describe('help and goodbye', () => {
    it('returns help text with options', () => {
      const msg = builder.help();
      expect(msg).toContain('despacho');
      expect(msg.toLowerCase()).toContain('cotizar');
    });

    it('returns goodbye text', () => {
      const msg = builder.goodbye();
      expect(msg).toBeTruthy();
    });

    it('returns human handoff text', () => {
      const msg = builder.humanHandoff();
      expect(msg).toContain('operador');
    });

    it('returns fallback text', () => {
      const msg = builder.fallback();
      expect(msg).toBeTruthy();
    });
  });

  describe('tracking info', () => {
    it('formats tracking info with status', () => {
      const msg = builder.trackingInfo({
        status: 'in_transit',
        origin_address: 'Av. Principal',
        dest_address: 'Calle Falsa',
        total_price: 5000,
      });
      expect(msg).toContain('En camino');
      expect(msg).toContain('Av. Principal');
      expect(msg).toContain('$5.000');
    });

    it('handles delivered status', () => {
      const msg = builder.trackingInfo({
        status: 'delivered',
        delivered_at: '2024-01-15T14:30:00Z',
      });
      expect(msg).toContain('Entregado');
    });
  });
});
