-- ============================================================
-- WhatsApp Logistics AI — Migración 002
-- Aditiva solamente. No modifica tablas existentes.
-- ============================================================

-- ============================================
-- TABLA: companies (multi-tenancy)
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLA: company_members
-- ============================================
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'operator')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- ============================================
-- TABLA: conversations
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'telegram', 'rcs', 'web', 'sms')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending_human', 'closed')),
  context JSONB DEFAULT '{}',
  memory JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_company_phone
  ON conversations(company_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_status
  ON conversations(company_id, status);

-- ============================================
-- TABLA: messages
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio', 'location', 'contact', 'document', 'sticker', 'video')),
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  provider_message_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_provider_id
  ON messages(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ============================================
-- TABLA: dispatch_orders (órdenes desde chat)
-- ============================================
CREATE TABLE IF NOT EXISTS dispatch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  shipment_id UUID REFERENCES shipments(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'collecting_data', 'ready', 'submitted',
    'in_progress', 'delivered', 'cancelled'
  )),
  extracted_data JSONB DEFAULT '{}',
  missing_fields TEXT[] DEFAULT '{}',
  notes TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source_channel TEXT DEFAULT 'whatsapp',
  operator_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_orders_company
  ON dispatch_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_customer
  ON dispatch_orders(customer_phone);

-- ============================================
-- TABLA: company_memory (memoria por empresa)
-- ============================================
CREATE TABLE IF NOT EXISTS company_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'frequent_address', 'frequent_recipient', 'preference',
    'alias', 'instruction'
  )),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_memory_lookup
  ON company_memory(company_id, customer_phone, memory_type);

-- ============================================
-- TABLA: operator_assignments
-- ============================================
CREATE TABLE IF NOT EXISTS operator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'transferred')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notes TEXT
);

-- ============================================
-- TABLA: webhook_events (log de auditoría)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_message_id TEXT,
  payload JSONB NOT NULL,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed', 'duplicate'
  )),
  error TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_idempotency
  ON webhook_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
  ON webhook_events(processing_status, created_at)
  WHERE processing_status = 'pending';

-- ============================================
-- TABLA: crm_interactions
-- ============================================
CREATE TABLE IF NOT EXISTS crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  dispatch_order_id UUID REFERENCES dispatch_orders(id),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'message_received', 'message_sent', 'order_created', 'order_updated',
    'order_submitted', 'order_delivered', 'order_cancelled',
    'human_takeover', 'ai_handled', 'escalated'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_interactions_company
  ON crm_interactions(company_id, created_at);

-- ============================================
-- TABLA: crm_daily_metrics
-- ============================================
CREATE TABLE IF NOT EXISTS crm_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  ai_handled INTEGER DEFAULT 0,
  human_handled INTEGER DEFAULT 0,
  orders_created INTEGER DEFAULT 0,
  orders_delivered INTEGER DEFAULT 0,
  orders_cancelled INTEGER DEFAULT 0,
  total_revenue_clp INTEGER DEFAULT 0,
  unique_customers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, date)
);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_companies_updated_at();

CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_conversations_updated_at();

CREATE OR REPLACE FUNCTION update_dispatch_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dispatch_orders_updated_at
  BEFORE UPDATE ON dispatch_orders
  FOR EACH ROW EXECUTE FUNCTION update_dispatch_orders_updated_at();
