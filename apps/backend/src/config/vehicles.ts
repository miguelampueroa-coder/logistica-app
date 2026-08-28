// Fuente unica de verdad para los tipos de vehiculo y su capacidad.
//
// Antes esto estaba repetido en cuatro lugares del backend, en la restriccion
// CHECK de la tabla vehicles y en la pantalla del movil, sin nadie que los
// mantuviera sincronizados.
//
// Las capacidades son las que la app ya le promete al prestador en
// VehiclesScreen.tsx, asi que se respetan tal cual: si la pantalla dice que una
// moto lleva hasta 10 kg, el backend no puede aceptarle 200.

import { VehicleType } from '../types/index.js';

export interface VehicleSpec {
  label: string;
  /** Capacidad por defecto cuando el prestador no declaro la suya. */
  defaultCapacityKg: number;
  defaultCapacityM3: number;
  /** Multiplicador de tarifa sobre el precio base por km. */
  priceMultiplier: number;
}

// PENDIENTE DE CONFIRMAR POR MIGUEL: la capacidad y la tarifa de bicicleta y
// barco son propuestas, no datos. El resto viene de lo que ya se le muestra al
// prestador en la app.
export const VEHICLE_SPECS: Record<VehicleType, VehicleSpec> = {
  bicicleta:  { label: 'Bicicleta', defaultCapacityKg: 8,    defaultCapacityM3: 0.06, priceMultiplier: 0.7 },
  moto:       { label: 'Moto',      defaultCapacityKg: 10,   defaultCapacityM3: 0.10, priceMultiplier: 1.0 },
  auto:       { label: 'Auto',      defaultCapacityKg: 50,   defaultCapacityM3: 0.40, priceMultiplier: 1.2 },
  furgoneta:  { label: 'Furgoneta', defaultCapacityKg: 200,  defaultCapacityM3: 3.00, priceMultiplier: 1.5 },
  camioneta:  { label: 'Camioneta', defaultCapacityKg: 500,  defaultCapacityM3: 2.50, priceMultiplier: 1.8 },
  microbus:   { label: 'Microbús',  defaultCapacityKg: 1000, defaultCapacityM3: 6.00, priceMultiplier: 2.2 },
  camion:     { label: 'Camión',    defaultCapacityKg: 5000, defaultCapacityM3: 30.0, priceMultiplier: 2.5 },
  barco:      { label: 'Barco',     defaultCapacityKg: 2000, defaultCapacityM3: 15.0, priceMultiplier: 3.0 },
};

/**
 * Los tipos validos, para los esquemas de validacion. Se deriva de la tabla de
 * arriba, asi que agregar un vehiculo ahi lo habilita en toda la API.
 */
export const VEHICLE_TYPE_VALUES = Object.keys(VEHICLE_SPECS) as [VehicleType, ...VehicleType[]];

/**
 * Capacidad efectiva de un vehiculo: la declarada por el prestador, o la que
 * corresponde a su tipo si no declaro ninguna. Nunca queda sin limite.
 */
export function getEffectiveCapacity(
  type: VehicleType,
  declaredKg?: number | null,
  declaredM3?: number | null
): { capacityKg: number; capacityM3: number } {
  const spec = VEHICLE_SPECS[type];
  return {
    capacityKg: declaredKg && declaredKg > 0 ? declaredKg : spec.defaultCapacityKg,
    capacityM3: declaredM3 && declaredM3 > 0 ? declaredM3 : spec.defaultCapacityM3,
  };
}
