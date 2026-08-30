-- Migration 009: prueba de entrega
--
-- Hoy un envio se cierra sin ninguna prueba: el conductor toca "Entregar" y
-- queda en delivered. deliverShipment valida el estado y la propiedad, y nada
-- mas. La tabla delivery_evidence existe desde la migracion 003, pero solo la
-- escribe un endpoint de subida separado que nada obliga a usar, asi que en la
-- practica no hay forma de demostrar que un paquete se entrego.
--
-- Decision de Miguel: la prueba es una fotografia del paquete entregado a la
-- persona. No es un retrato del receptor, es el bulto en el momento del
-- traspaso.
--
-- Se agregan cuatro cosas:
--
--   storage_path   -- ruta en el bucket privado. file_url quedaba con una URL
--                     publica permanente, que para una evidencia es un enlace
--                     eterno sin sesion. Ahora se guarda la ruta y se firma al
--                     leerla.
--   evidence_type  -- distingue la foto de retiro de la de entrega. El mismo
--                     envio tiene las dos y hasta ahora se mezclaban.
--   captured_*     -- donde y cuando se tomo la foto. Una prueba de entrega sin
--                     lugar ni hora vale poco ante un reclamo.
--   receiver_name  -- opcional. Miguel no lo pidio; se deja disponible para
--                     cuando quiera exigirlo, sin obligar hoy.
--
-- Todas las columnas son nulables: las filas que ya existen siguen siendo
-- validas. Reversible sin perdida (DROP COLUMN de las cinco).

ALTER TABLE delivery_evidence
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(20) DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS captured_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS captured_lng DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS receiver_name TEXT;

ALTER TABLE delivery_evidence DROP CONSTRAINT IF EXISTS delivery_evidence_type_check;
ALTER TABLE delivery_evidence ADD CONSTRAINT delivery_evidence_type_check
  CHECK (evidence_type IN ('pickup', 'delivery', 'incident'));

-- La consulta que mas se va a repetir: "las evidencias de entrega de este
-- envio", tanto al cerrar como ante un reclamo.
CREATE INDEX IF NOT EXISTS idx_delivery_evidence_shipment_type
  ON delivery_evidence(shipment_id, evidence_type);

COMMENT ON COLUMN delivery_evidence.storage_path IS
  'Ruta en el bucket privado. Se firma al leer; no es una URL publica.';
COMMENT ON COLUMN delivery_evidence.evidence_type IS
  'pickup = foto al retirar. delivery = foto del paquete entregado. incident = problema en ruta.';
COMMENT ON COLUMN delivery_evidence.captured_lat IS
  'Donde se tomo la foto, reportado por el dispositivo del prestador.';
