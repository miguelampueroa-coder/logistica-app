-- Migration 005: Habilita RLS en las 10 tablas del modulo WhatsApp
--
-- La migracion 002 creo sus 10 tablas sin ENABLE ROW LEVEL SECURITY y sin
-- una sola policy (001 protege 6 tablas con 16 policies; 003, 4 con 7).
-- Sin RLS, la anon key -- que es publica por diseno y viaja en el frontend --
-- da lectura y escritura libre sobre el contenido completo de las
-- conversaciones (messages), las direcciones y telefonos guardados
-- (company_memory), los pedidos por chat (dispatch_orders) y los ingresos
-- diarios por empresa (crm_daily_metrics), de todas las empresas a la vez.
--
-- No se agregan policies a proposito: el modulo WhatsApp accede unicamente
-- con service role (getSupabaseAdmin), que salta RLS. Ningun cliente lee
-- estas tablas directo. Mismo patron que usa el proyecto de Cafe Puerto
-- Varas para las tablas de pedidos.
--
-- Al agregar acceso desde el navegador, escribir policies filtrando por
-- company_id via company_members. No aflojar esto sin esa policy.

ALTER TABLE companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_daily_metrics    ENABLE ROW LEVEL SECURITY;
