import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({
  getSupabaseAdmin: vi.fn(),
  withRetry: vi.fn(),
}));
vi.mock('../../services/upload.service.js', () => ({
  createUploadService: () => ({ getMulterMiddleware: vi.fn(), saveDeliveryEvidence: vi.fn() }),
}));
vi.mock('../../services/payment.service.js', () => ({
  // function, no arrow: se instancia con new y las flechas no son constructores
  PaymentService: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

import { createShipmentSchema } from '../../controllers/order.controller.js';

const envioBase = {
  package_description: 'Caja de repuestos',
  package_weight_kg: 3,
  package_length_cm: 30,
  package_width_cm: 20,
  package_height_cm: 15,
  origin_address: 'Puerto Montt',
  origin_lat: -41.4693,
  origin_lng: -72.9424,
  dest_address: 'Puerto Varas',
  dest_lat: -41.3195,
  dest_lng: -72.9854,
};

describe('métodos de pago aceptados', () => {
  // Enviazo no acepta efectivo: si la plata pasa de mano en mano, la plataforma
  // no la ve y no puede descontar su comision ni garantizarle el cobro al
  // prestador.
  it('rechaza un envío en efectivo', () => {
    const result = createShipmentSchema.safeParse({ ...envioBase, payment_method: 'cash' });
    expect(result.success).toBe(false);
  });

  it.each(['card', 'qr', 'transfer'])('acepta el pago virtual "%s"', (metodo) => {
    const result = createShipmentSchema.safeParse({ ...envioBase, payment_method: metodo });
    expect(result.success).toBe(true);
  });

  // El default no puede ser efectivo ni quedar vacio: un envio sin metodo
  // definido termina sin pago vinculado.
  it('usa tarjeta cuando no se especifica método', () => {
    const result = createShipmentSchema.safeParse(envioBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payment_method).toBe('card');
    }
  });

  it('rechaza un método inventado', () => {
    const result = createShipmentSchema.safeParse({ ...envioBase, payment_method: 'bitcoin' });
    expect(result.success).toBe(false);
  });
});
