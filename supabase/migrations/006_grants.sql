-- Migration 006: GRANTs para los roles de Supabase
--
-- Ninguna de las migraciones 001-003 otorga privilegios sobre las tablas
-- que crea. Verificado contra Postgres real: las 20 tablas de public
-- quedaban con has_table_privilege = false para service_role,
-- authenticated y anon, con owner postgres.
--
-- Efecto: PostgREST respondia 42501 "permission denied for table ..." a
-- toda operacion del backend, incluido el health check. Es decir, la
-- plataforma no podia leer ni escribir nada contra una base real. No se
-- habia detectado porque los 89 tests corren con mocks y el servidor
-- nunca se habia levantado.
--
-- Se otorga solo a service_role, que es el unico rol que usa el backend
-- (getSupabaseAdmin). anon y authenticated quedan sin acceso a proposito:
-- hoy ningun cliente lee las tablas directo, todo pasa por la API.
-- Al exponer tablas al navegador habra que otorgar a authenticated lo
-- justo y apoyarse en las policies RLS, que hoy estan inertes por esto.
--
-- CUIDADO al hacerlo: las 10 tablas del modulo WhatsApp (companies,
-- company_members, conversations, messages, dispatch_orders, company_memory,
-- operator_assignments, webhook_events, crm_interactions, crm_daily_metrics)
-- tienen RLS habilitado pero CERO policies (ver 005). Hoy eso no importa
-- porque sin GRANT nadie llega, pero un GRANT a authenticated sobre ellas las
-- deja legibles para cualquier usuario logueado, de todas las empresas a la
-- vez. Escribir primero las policies filtrando por company_id via
-- company_members, y recien despues otorgar.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Para que las tablas de migraciones futuras no repitan el problema.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
