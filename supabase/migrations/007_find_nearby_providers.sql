-- Migration 007: RPC find_nearby_providers
--
-- createShipment (order.controller.ts) invoca supabase.rpc('find_nearby_providers',
-- { p_lat, p_lng, p_radius_km }) para avisar a los prestadores cercanos de un
-- envio nuevo. La funcion no existia en ninguna migracion: PostgREST respondia
-- 404 y el aviso a prestadores cercanos nunca funcionaba (solo se logueaba).
--
-- Devuelve los prestadores activos y disponibles con ubicacion reportada dentro
-- del radio, ordenados por distancia. SECURITY DEFINER: corre como el owner
-- (postgres) saltando RLS, igual que el resto del acceso del backend que pasa
-- siempre por service_role.

CREATE OR REPLACE FUNCTION find_nearby_providers(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (provider_id UUID, distance_km DOUBLE PRECISION)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS provider_id,
    (6371 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(p_lat)) * cos(radians(u.location_lat::DOUBLE PRECISION)) *
        cos(radians(u.location_lng::DOUBLE PRECISION) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(u.location_lat::DOUBLE PRECISION))
      ))
    )) AS distance_km
  FROM users u
  WHERE u.role = 'provider'
    AND u.is_active = true
    AND u.is_available = true
    AND u.location_lat IS NOT NULL
    AND u.location_lng IS NOT NULL
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(u.location_lat::DOUBLE PRECISION)) *
          cos(radians(u.location_lng::DOUBLE PRECISION) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(u.location_lat::DOUBLE PRECISION))
        ))
      )
    ) <= p_radius_km
  ORDER BY distance_km ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION find_nearby_providers(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
