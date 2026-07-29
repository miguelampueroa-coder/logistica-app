import { describe, it, expect } from 'vitest';
import { EntityExtractor } from '../../modules/whatsapp/engine/entity.extractor.js';

describe('EntityExtractor', () => {
  const extractor = new EntityExtractor();

  describe('address extraction', () => {
    it('extracts a valid address', () => {
      const result = extractor.extractAddress('Av. Principal 123, Puerto Montt');
      expect(result).toBeDefined();
      expect(result?.address).toContain('Av. Principal');
    });

    it('returns undefined for too-short text', () => {
      const result = extractor.extractAddress('casa');
      expect(result).toBeUndefined();
    });

    it('returns undefined for text without numbers', () => {
      const result = extractor.extractAddress('mi casa bonita');
      expect(result).toBeUndefined();
    });
  });

  describe('phone extraction via recipient', () => {
    it('extracts Chilean phone from recipient text', () => {
      const result = extractor.extract('para Juan al +56912345678');
      expect(result.recipient).toBeDefined();
      expect(result.recipient?.phone).toBeDefined();
      expect(result.recipient?.phone).toContain('912345678');
    });
  });

  describe('recipient extraction', () => {
    it('extracts recipient name with "para"', () => {
      const result = extractor.extract('para Juan Pérez');
      expect(result.recipient).toBeDefined();
      expect(result.recipient?.name).toContain('Juan');
    });

    it('extracts recipient with "enviar a"', () => {
      const result = extractor.extract('enviar a María González');
      expect(result.recipient).toBeDefined();
      expect(result.recipient?.name).toContain('María');
    });

    it('extracts recipient with phone', () => {
      const result = extractor.extract('recibe Pedro +56987654321');
      expect(result.recipient).toBeDefined();
      expect(result.recipient?.phone).toContain('987654321');
    });
  });

  describe('package extraction', () => {
    it('extracts weight in kg', () => {
      const result = extractor.extract('pesa 5 kg');
      expect(result.package).toBeDefined();
      expect(result.package?.weightKg).toBe(5);
    });

    it('extracts weight in kilos', () => {
      const result = extractor.extract('peso 10 kilos');
      expect(result.package).toBeDefined();
      expect(result.package?.weightKg).toBe(10);
    });

    it('extracts weight with decimal', () => {
      const result = extractor.extract('pesa 2,5 kg');
      expect(result.package).toBeDefined();
      expect(result.package?.weightKg).toBe(2.5);
    });

    it('extracts dimensions with weight', () => {
      const result = extractor.extract('mide 30x20x15 cm y pesa 2 kg');
      expect(result.package).toBeDefined();
      expect(result.package?.lengthCm).toBe(30);
      expect(result.package?.widthCm).toBe(20);
      expect(result.package?.heightCm).toBe(15);
    });

    it('extracts dimensions with X', () => {
      const result = extractor.extract('una caja 40X30X20 de 5 kg');
      expect(result.package).toBeDefined();
      expect(result.package?.lengthCm).toBe(40);
    });

    it('recognizes "caja" size keyword', () => {
      const result = extractor.extract('una caja');
      expect(result.package).toBeDefined();
      expect(result.package?.lengthCm).toBe(40);
      expect(result.package?.widthCm).toBe(30);
      expect(result.package?.heightCm).toBe(30);
    });

    it('recognizes "sobre" size keyword', () => {
      const result = extractor.extract('un sobre');
      expect(result.package).toBeDefined();
      expect(result.package?.lengthCm).toBe(30);
      expect(result.package?.heightCm).toBe(2);
    });

    it('recognizes "documento" keyword', () => {
      const result = extractor.extract('un documento');
      expect(result.package).toBeDefined();
      expect(result.package?.description).toBe('documento');
    });
  });

  describe('urgency detection', () => {
    it('detects "urgente"', () => {
      const result = extractor.extract('es urgente');
      expect(result.urgency).toBe(true);
    });

    it('detects "ahora"', () => {
      const result = extractor.extract('necesito ahora');
      expect(result.urgency).toBe(true);
    });

    it('detects "express"', () => {
      const result = extractor.extract('envío express');
      expect(result.urgency).toBe(true);
    });

    it('no urgency for normal text', () => {
      const result = extractor.extract('quiero enviar algo');
      expect(result.urgency).toBe(false);
    });
  });

  describe('location sharing', () => {
    it('extracts location from shared coordinates', () => {
      const location = { lat: -41.47, lng: -72.94, name: 'Puerto Montt' };
      const result = extractor.extractLocationFromShared(location);
      expect(result.lat).toBe(-41.47);
      expect(result.lng).toBe(-72.94);
    });

    it('uses address if provided', () => {
      const location = { lat: -41.47, lng: -72.94, address: 'Av. Principal 123' };
      const result = extractor.extractLocationFromShared(location);
      expect(result.address).toBe('Av. Principal 123');
    });
  });

  describe('contact sharing', () => {
    it('extracts contact from shared data', () => {
      const contact = { name: 'María González', phone: '+56912345678' };
      const result = extractor.extractContactFromShared(contact);
      expect(result.name).toBe('María González');
      expect(result.phone).toContain('912345678');
    });
  });
});
