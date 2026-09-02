-- Migration 010: verificacion de identidad de los prestadores
--
-- Hoy cualquiera se registra como prestador y puede tomar encomiendas ajenas de
-- inmediato: no se le pide documento, ni licencia, ni nada. En una plataforma
-- abierta donde el que lleva el paquete es un desconocido, eso es la exposicion
-- legal mas grande del producto.
--
-- Decision de Miguel: se valida con documento de identidad -- cedula, pasaporte
-- o licencia de conducir.
--
-- El documento se guarda en el bucket PRIVADO (storage_path, nunca URL
-- publica): es el dato mas sensible que maneja la plataforma. La foto se ve
-- solo firmandola al momento de revisarla.
--
-- Reversible: DROP TABLE provider_documents y DROP COLUMN en users. No toca
-- ninguna fila existente.

CREATE TABLE IF NOT EXISTS provider_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  document_type VARCHAR(20) NOT NULL
    CHECK (document_type IN ('cedula', 'pasaporte', 'licencia_conducir')),
  document_number VARCHAR(50) NOT NULL,

  -- Ruta en el bucket privado. Nunca una URL publica: es un documento de
  -- identidad, no una foto de producto.
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Quien reviso y por que rechazo. Sin esto una decision sobre la identidad de
  -- una persona no queda trazable.
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Un mismo documento no puede usarse en dos cuentas: es la defensa contra que
-- un prestador expulsado vuelva con otro correo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_documents_unico
  ON provider_documents(document_type, document_number)
  WHERE status = 'approved';

-- La cola de revision del admin: los pendientes, mas antiguos primero.
CREATE INDEX IF NOT EXISTS idx_provider_documents_pendientes
  ON provider_documents(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_provider_documents_user
  ON provider_documents(user_id);

-- Estado consolidado en users, para no consultar la tabla de documentos en cada
-- intento de tomar un envio.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_verification_status_check;
ALTER TABLE users ADD CONSTRAINT users_verification_status_check
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_users_verificacion
  ON users(role, verification_status)
  WHERE role = 'provider';

ALTER TABLE provider_documents ENABLE ROW LEVEL SECURITY;

-- Sin policies a proposito, igual que las tablas de WhatsApp: el acceso pasa
-- siempre por el backend con service_role. Un documento de identidad no debe
-- ser legible desde el navegador bajo ninguna circunstancia. Ver 006_grants.
COMMENT ON TABLE provider_documents IS
  'Documentos de identidad de prestadores. Solo service_role. La foto vive en bucket privado y se firma al revisarla.';
COMMENT ON COLUMN users.verification_status IS
  'unverified = sin documento. pending = subido, sin revisar. verified = aprobado. rejected = rechazado.';
