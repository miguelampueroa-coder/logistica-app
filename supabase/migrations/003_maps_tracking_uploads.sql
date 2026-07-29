-- Migration 003: Maps, Tracking, Uploads, Background Jobs
-- Adds tables for real-time tracking, file uploads, and FCM tokens

-- Location history for tracking
CREATE TABLE IF NOT EXISTS location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES users(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_location_history_shipment_id ON location_history(shipment_id);
CREATE INDEX idx_location_history_timestamp ON location_history(timestamp);
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can insert own locations" ON location_history
  FOR INSERT WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Users can view shipment locations" ON location_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = location_history.shipment_id
      AND (shipments.user_id = auth.uid() OR shipments.provider_id = auth.uid())
    )
  );

-- Add tracking columns to shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Delivery evidence photos
CREATE TABLE IF NOT EXISTS delivery_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  original_name TEXT,
  mime_type VARCHAR(100),
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  description TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_delivery_evidence_shipment_id ON delivery_evidence(shipment_id);
ALTER TABLE delivery_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence for own shipments" ON delivery_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = delivery_evidence.shipment_id
      AND (shipments.user_id = auth.uid() OR shipments.provider_id = auth.uid() OR auth.uid() IN (
        SELECT id FROM users WHERE role = 'admin'
      ))
    )
  );

CREATE POLICY "Providers can upload evidence" ON delivery_evidence
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = delivery_evidence.shipment_id
      AND shipments.provider_id = auth.uid()
    )
  );

-- Package photos
CREATE TABLE IF NOT EXISTS package_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  original_name TEXT,
  mime_type VARCHAR(100),
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_package_photos_package_id ON package_photos(package_id);
ALTER TABLE package_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view photos for own packages" ON package_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM packages
      WHERE packages.id = package_photos.package_id
      AND packages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload photos for own packages" ON package_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM packages
      WHERE packages.id = package_photos.package_id
      AND packages.user_id = auth.uid()
    )
  );

-- FCM tokens for push notifications
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE UNIQUE INDEX idx_fcm_tokens_unique_token ON fcm_tokens(token);
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own FCM tokens" ON fcm_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Payments table enhancement (if not exists)
-- The payments table already exists from migration 001
-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Add payment status to shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
