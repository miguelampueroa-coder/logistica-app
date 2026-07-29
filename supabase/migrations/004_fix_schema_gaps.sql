-- Migration 004: Corrige desajustes entre el codigo y el esquema
-- Detectados al auditar los 56 insert/update del backend contra las
-- migraciones 001-003, antes de conectar Supabase real.

-- ============================================
-- 1. shipments.payment_id
-- ============================================
-- order.controller.ts:153 hace .update({ payment_id }) tras crear el
-- intento de pago, y order.controller.ts:444 lo lee al entregar para
-- capturar el cobro. La columna nunca existio: el update fallaba en
-- silencio (supabase-js devuelve error, no lanza, y ahi no se revisa)
-- y la captura del pago al entregar nunca se disparaba.
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS payment_id VARCHAR;

-- ============================================
-- 2. users.is_active
-- ============================================
-- admin.routes.ts:88 y :119 hacen .select(...is_active...) sobre users.
-- users solo tenia is_available, que es otra cosa: disponibilidad del
-- prestador para tomar envios, no si la cuenta esta habilitada.
-- Sin esta columna, GET /api/admin/users devuelve error.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- 3. Cierra el insert abierto en payments
-- ============================================
-- 001 creo "System can insert payments" FOR INSERT WITH CHECK (true),
-- que habilita a cualquier rol -- incluido anon, cuya key es publica por
-- diseno -- a insertar filas arbitrarias en payments: montos libres,
-- status 'completed' y cualquier shipment_id. Contamina el reporte
-- financiero de /api/admin/finance/summary.
-- Ningun cliente escribe directo a Supabase: el backend inserta pagos
-- con service role, que salta RLS. Quitar la policy no rompe nada.
DROP POLICY IF EXISTS "System can insert payments" ON payments;

COMMENT ON COLUMN shipments.payment_id IS 'ID del intento de pago en la pasarela (Stripe/Webpay)';
COMMENT ON COLUMN users.is_active IS 'Cuenta habilitada. Distinto de is_available (prestador disponible)';
