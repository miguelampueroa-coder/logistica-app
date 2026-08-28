import { describe, it, expect } from 'vitest';
import { getEffectiveCapacity, VEHICLE_SPECS } from '../../config/vehicles.js';

describe('getEffectiveCapacity', () => {
  describe('cuando el prestador declaro su capacidad', () => {
    it('respeta la capacidad declarada por sobre la del tipo', () => {
      const { capacityKg, capacityM3 } = getEffectiveCapacity('auto', 80, 0.9);
      expect(capacityKg).toBe(80);
      expect(capacityM3).toBe(0.9);
    });

    it('permite declarar menos que el default del tipo', () => {
      const { capacityKg } = getEffectiveCapacity('camion', 1200);
      expect(capacityKg).toBe(1200);
    });
  });

  describe('cuando no declaro capacidad', () => {
    it('usa el default del tipo si viene null', () => {
      const { capacityKg, capacityM3 } = getEffectiveCapacity('moto', null, null);
      expect(capacityKg).toBe(VEHICLE_SPECS.moto.defaultCapacityKg);
      expect(capacityM3).toBe(VEHICLE_SPECS.moto.defaultCapacityM3);
    });

    it('usa el default del tipo si viene undefined', () => {
      expect(getEffectiveCapacity('furgoneta').capacityKg).toBe(200);
    });

    // Un 0 o un negativo no puede interpretarse como "sin limite": eso dejaria
    // que cualquier vehiculo aceptara cualquier peso.
    it('ignora 0 y cae al default', () => {
      expect(getEffectiveCapacity('moto', 0, 0).capacityKg).toBe(10);
    });

    it('ignora negativos y cae al default', () => {
      expect(getEffectiveCapacity('auto', -5).capacityKg).toBe(50);
    });
  });

  describe('la tabla de especificaciones', () => {
    it('no deja ningun tipo sin capacidad ni multiplicador', () => {
      for (const [type, spec] of Object.entries(VEHICLE_SPECS)) {
        expect(spec.defaultCapacityKg, `${type} sin capacidad en kg`).toBeGreaterThan(0);
        expect(spec.defaultCapacityM3, `${type} sin capacidad en m3`).toBeGreaterThan(0);
        expect(spec.priceMultiplier, `${type} sin multiplicador`).toBeGreaterThan(0);
      }
    });

    // Coincide con lo que VehiclesScreen.tsx le promete al prestador. Si esto
    // cambia, hay que cambiar la pantalla tambien.
    it('mantiene las capacidades que la app muestra al prestador', () => {
      expect(VEHICLE_SPECS.moto.defaultCapacityKg).toBe(10);
      expect(VEHICLE_SPECS.auto.defaultCapacityKg).toBe(50);
      expect(VEHICLE_SPECS.furgoneta.defaultCapacityKg).toBe(200);
      expect(VEHICLE_SPECS.camioneta.defaultCapacityKg).toBe(500);
      expect(VEHICLE_SPECS.microbus.defaultCapacityKg).toBe(1000);
      expect(VEHICLE_SPECS.camion.defaultCapacityKg).toBe(5000);
    });
  });
});
