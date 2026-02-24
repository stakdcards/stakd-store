-- Manufacturing workflow schema for Supabase (PostgreSQL)
-- Run this in Supabase SQL Editor or via migrations

-- Orders (extends your existing cart/checkout)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'in_production', 'shipped', 'completed', 'cancelled')),
  total_cents INT,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order items (one per box / logical group)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  box_name TEXT,
  is_mega BOOLEAN DEFAULT false,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cards: one row per design (design_snapshot = full data to regenerate outputs)
CREATE TABLE IF NOT EXISTS order_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  design_snapshot JSONB NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_cards_order_item ON order_cards(order_item_id);

-- Production file outputs (one row per order per file type)
CREATE TABLE IF NOT EXISTS production_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('holo_base', 'hero_sheet', 'cut_file')),
  file_format TEXT NOT NULL CHECK (file_format IN ('pdf', 'svg', 'dxf')),
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'production',
  file_size_bytes BIGINT,
  page_count INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, file_type, file_format)
);

CREATE INDEX IF NOT EXISTS idx_production_files_order ON production_files(order_id);

-- Async job queue for generation
CREATE TABLE IF NOT EXISTS production_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('holo_base', 'hero_sheet', 'cut_file', 'all')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_jobs_order ON production_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_production_jobs_status ON production_jobs(status);

-- RLS (Row Level Security) - enable and add policies per your auth
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_jobs ENABLE ROW LEVEL SECURITY;

-- Example: users can read their own orders and production files
-- CREATE POLICY "Users can read own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can read own production_files" ON production_files FOR SELECT USING (
--   EXISTS (SELECT 1 FROM orders o WHERE o.id = production_files.order_id AND o.user_id = auth.uid())
-- );
