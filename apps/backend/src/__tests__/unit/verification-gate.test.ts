import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock('../../config/database.js', () => ({ getSupabaseAdmin }));
vi.mock('../../services/upload.service.js', () => ({
  createUploadService: () => ({
    processMultipleUploads: vi.fn(),
    getEvidenceViewUrl: vi.fn(),
    getMulterMiddleware: vi.fn(),
  }),
}));

import { canProviderAcceptShipments } from '../../services/verification.service.js';

function mockUserStatus(verification_status: string | null) {
  getSupabaseAdmin.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: verification_status === null ? null : { verification_status },
          }),
        }),
      }),
    }),
  });
}

describe('canProviderAcceptShipments', () => {
  const originalFlag = process.env.REQUIRE_PROVIDER_VERIFICATION;

  beforeEach(() => {
    getSupabaseAdmin.mockReset();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.REQUIRE_PROVIDER_VERIFICATION;
    } else {
      process.env.REQUIRE_PROVIDER_VERIFICATION = originalFlag;
    }
  });

  describe('con el bloqueo apagado (por defecto)', () => {
    // Encenderlo antes de tener prestadores verificados deja al marketplace sin
    // oferta, asi que el default tiene que dejar pasar.
    it('deja tomar envios aunque no este verificado', async () => {
      process.env.REQUIRE_PROVIDER_VERIFICATION = 'false';
      const result = await canProviderAcceptShipments('user-1');
      expect(result.allowed).toBe(true);
    });

    it('no consulta la base si el bloqueo esta apagado', async () => {
      process.env.REQUIRE_PROVIDER_VERIFICATION = 'false';
      await canProviderAcceptShipments('user-1');
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
    });

    it('tambien deja pasar si la variable no esta definida', async () => {
      delete process.env.REQUIRE_PROVIDER_VERIFICATION;
      expect((await canProviderAcceptShipments('user-1')).allowed).toBe(true);
    });
  });

  describe('con el bloqueo encendido', () => {
    beforeEach(() => {
      process.env.REQUIRE_PROVIDER_VERIFICATION = 'true';
    });

    it('deja pasar al prestador verificado', async () => {
      mockUserStatus('verified');
      expect((await canProviderAcceptShipments('user-1')).allowed).toBe(true);
    });

    it('bloquea al que nunca subio documento y le dice que hacer', async () => {
      mockUserStatus('unverified');
      const result = await canProviderAcceptShipments('user-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Sube tu documento');
    });

    it('bloquea al que tiene documento en revision', async () => {
      mockUserStatus('pending');
      const result = await canProviderAcceptShipments('user-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('revisión');
    });

    it('bloquea al rechazado y lo manda a corregir', async () => {
      mockUserStatus('rejected');
      const result = await canProviderAcceptShipments('user-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('rechazado');
    });

    // Ante un usuario que no aparece, se bloquea: dejar pasar por defecto seria
    // convertir un fallo de lectura en un permiso.
    it('bloquea si no encuentra al usuario', async () => {
      mockUserStatus(null);
      expect((await canProviderAcceptShipments('fantasma')).allowed).toBe(false);
    });
  });
});
