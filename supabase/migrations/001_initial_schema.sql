-- ============================================
-- Migración inicial: Schema de Base de Datos
-- App de Logística de Envíos
-- ============================================

-- Habilitar extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  phone VARCHAR,
  avatar_url TEXT,
  role VARCHAR CHECK (role IN ('client', 'provider', 'admin')) DEFAULT 'client',
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: vehicles
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR CHECK (type IN ('moto', 'auto', 'furgoneta', 'camioneta', 'microbus', 'camion')) NOT NULL,
  brand VARCHAR,
  model VARCHAR,
  year INTEGER,
  plate VARCHAR,
  capacity_kg DECIMAL(10, 2),
  capacity_m3 DECIMAL(10, 3),
  photos TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: packages
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  weight_kg DECIMAL(10, 2) NOT NULL,
  length_cm DECIMAL(10, 2) NOT NULL,
  width_cm DECIMAL(10, 2) NOT NULL,
  height_cm DECIMAL(10, 2) NOT NULL,
  declared_value INTEGER,
  photos TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: shipments (envíos/pedidos)
-- ============================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- Origen
  origin_address TEXT NOT NULL,
  origin_lat DECIMAL(10, 8) NOT NULL,
  origin_lng DECIMAL(11, 8) NOT NULL,
  origin_contact_name VARCHAR,
  origin_contact_phone VARCHAR,
  
  -- Destino
  dest_address TEXT NOT NULL,
  dest_lat DECIMAL(10, 8) NOT NULL,
  dest_lng DECIMAL(11, 8) NOT NULL,
  dest_contact_name VARCHAR,
  dest_contact_phone VARCHAR,
  
  -- Tarifa
  distance_km DECIMAL(10, 2),
  base_price INTEGER,
  urgency_fee INTEGER DEFAULT 0,
  total_price INTEGER,
  
  -- Estado
  status VARCHAR CHECK (status IN (
    'pending',      -- Esperando prestador
    'accepted',     -- Prestador aceptó
    'in_transit',   -- En camino
    'delivered',    -- Entregado
    'cancelled'     -- Cancelado
  )) DEFAULT 'pending',
  
  -- Metadatos
  urgency BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: payments
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method VARCHAR CHECK (method IN ('cash', 'card', 'transfer')) NOT NULL,
  status VARCHAR CHECK (status IN ('pending', 'completed', 'refunded')) DEFAULT 'pending',
  stripe_payment_id VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: ratings
-- ============================================
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER CHECK (score BETWEEN 1 AND 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Un usuario solo puede calificar una vez por envío
  UNIQUE(shipment_id, from_user_id)
);

-- ============================================
-- ÍNDICES para performance
-- ============================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_type ON vehicles(type);
CREATE INDEX idx_packages_user_id ON packages(user_id);
CREATE INDEX idx_shipments_user_id ON shipments(user_id);
CREATE INDEX idx_shipments_provider_id ON shipments(provider_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_created_at ON shipments(created_at DESC);
CREATE INDEX idx_payments_shipment_id ON payments(shipment_id);
CREATE INDEX idx_ratings_shipment_id ON ratings(shipment_id);
CREATE INDEX idx_ratings_to_user_id ON ratings(to_user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Políticas para users
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Políticas para vehicles
CREATE POLICY "Providers can view own vehicles" ON vehicles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Providers can insert own vehicles" ON vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Providers can update own vehicles" ON vehicles
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para packages
CREATE POLICY "Clients can view own packages" ON packages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Clients can insert own packages" ON packages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para shipments
CREATE POLICY "Clients can view own shipments" ON shipments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Providers can view pending shipments" ON shipments
  FOR SELECT USING (status = 'pending' AND provider_id IS NULL);

CREATE POLICY "Providers can view accepted shipments" ON shipments
  FOR SELECT USING (auth.uid() = provider_id);

CREATE POLICY "Clients can insert shipments" ON shipments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Providers can update shipments" ON shipments
  FOR UPDATE USING (auth.uid() = provider_id);

-- Políticas para payments
CREATE POLICY "Users can view payments for own shipments" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shipments 
      WHERE shipments.id = payments.shipment_id 
      AND (shipments.user_id = auth.uid() OR shipments.provider_id = auth.uid())
    )
  );

CREATE POLICY "System can insert payments" ON payments
  FOR INSERT WITH CHECK (true);

-- Políticas para ratings
CREATE POLICY "Users can view ratings for own shipments" ON ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shipments 
      WHERE shipments.id = ratings.shipment_id 
      AND (shipments.user_id = auth.uid() OR shipments.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert ratings" ON ratings
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- ============================================
-- FUNCIONES TRIGGER
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMENTARIOS EN TABLAS
-- ============================================
COMMENT ON TABLE users IS ' Usuarios de la plataforma (clientes y prestadores)';
COMMENT ON TABLE vehicles IS 'Vehículos registrados por los prestadores';
COMMENT ON TABLE packages IS 'Paquetes a enviar con dimensiones y peso';
COMMENT ON TABLE shipments IS 'Envíos realizados en la plataforma';
COMMENT ON TABLE payments IS 'Pagos asociados a envíos';
COMMENT ON TABLE ratings IS 'Calificaciones entre usuarios';
