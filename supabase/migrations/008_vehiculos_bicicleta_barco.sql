-- Migration 008: agrega bicicleta y barco a los tipos de vehiculo
--
-- Enviazo es una plataforma abierta: cualquiera que pueda llevar el envio puede
-- tomarlo. La restriccion original solo admitia vehiculos motorizados de
-- carretera ('moto','auto','furgoneta','camioneta','microbus','camion'), lo que
-- dejaba fuera dos casos reales de la zona:
--
--   bicicleta -- reparto urbano corto, el mas barato por km
--   barco     -- en Chiloe y Palena hay destinos sin conexion por carretera;
--                sin este tipo esos envios simplemente no se pueden ofrecer
--
-- Solo amplia el conjunto permitido: ninguna fila existente deja de ser valida,
-- asi que no hay riesgo de datos rechazados al aplicarla.
--
-- Reversible: volver a la restriccion anterior, pero solo si no se registro
-- ningun vehiculo de los dos tipos nuevos. Conviene verificarlo antes:
--   SELECT type, COUNT(*) FROM vehicles
--   WHERE type IN ('bicicleta','barco') GROUP BY type;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_type_check;

ALTER TABLE vehicles ADD CONSTRAINT vehicles_type_check CHECK (
  type IN (
    'bicicleta',
    'moto',
    'auto',
    'furgoneta',
    'camioneta',
    'microbus',
    'camion',
    'barco'
  )
);

COMMENT ON COLUMN vehicles.type IS
  'Medio de transporte. La capacidad y la tarifa de cada tipo viven en apps/backend/src/config/vehicles.ts';
