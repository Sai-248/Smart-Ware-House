/*
# Smart Warehouse Operations Schema

1. Overview
This migration creates a complete warehouse operations platform schema covering inventory, orders, allocation, picking/packing, quality checks, dispatch, exceptions, and stock movements. Single-tenant (no auth) — all data is intentionally shared/public for the warehouse team.

2. New Tables
- `products` — warehouse inventory items with SKU, name, category, stock levels, reorder thresholds, and location (zone/aisle/shelf).
- `orders` — customer orders with priority, status lifecycle, and timestamps.
- `order_items` — line items per order referencing products with requested and allocated quantities.
- `pick_tasks` — picking assignments for warehouse staff linked to order_items, with status and picked qty.
- `exceptions` — operational exceptions (damaged/missing/short stock) with type, status, and resolution.
- `dispatches` — shipment records for dispatched orders with carrier and tracking info.
- `stock_movements` — audit log of all stock changes (inbound, outbound, adjustment, damaged).
- `audit_log` — optional audit trail for key decisions (allocation, exception resolution).

3. Columns
- products: id, sku, name, category, quantity_on_hand, quantity_allocated, reorder_point, reorder_qty, zone, aisle, shelf, unit_price, supplier, status, created_at, updated_at.
- orders: id, order_number, customer_name, priority (low/standard/high/urgent), status (created/pending_allocation/allocated/picking/packing/quality_check/dispatched/cancelled/on_hold), required_by, created_at, updated_at, total_value, notes.
- order_items: id, order_id, product_id, requested_qty, allocated_qty, status, created_at.
- pick_tasks: id, order_id, order_item_id, product_id, picker, status (pending/in_progress/picked/short), picked_qty, created_at, completed_at.
- exceptions: id, order_id, order_item_id, product_id, type (damaged/missing/short_stock/misplaced/quality), description, status (open/investigating/resolved), resolution, created_at, resolved_at.
- dispatches: id, order_id, carrier, tracking_number, dispatched_at, status.
- stock_movements: id, product_id, movement_type (inbound/outbound/adjustment/damaged/allocated/reallocated), quantity, reference, created_at.
- audit_log: id, action, entity_type, entity_id, details (jsonb), created_at.

4. Security
- Single-tenant app, no sign-in. RLS enabled on all tables with anon+authenticated full CRUD (data intentionally shared/public).
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  quantity_on_hand integer NOT NULL DEFAULT 0,
  quantity_allocated integer NOT NULL DEFAULT 0,
  reorder_point integer NOT NULL DEFAULT 10,
  reorder_qty integer NOT NULL DEFAULT 50,
  zone text NOT NULL,
  aisle text NOT NULL,
  shelf text NOT NULL,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  supplier text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  priority text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'created',
  required_by date,
  total_value numeric(12,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty integer NOT NULL,
  allocated_qty integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pick_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  picker text,
  status text NOT NULL DEFAULT 'pending',
  picked_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier text NOT NULL,
  tracking_number text,
  dispatched_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'in_transit'
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  reference text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_pick_tasks_order ON pick_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_pick_tasks_status ON pick_tasks(status);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_exceptions_order ON exceptions(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies: single-tenant, anon+authenticated full CRUD (intentionally shared/public data)
DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_pick_tasks" ON pick_tasks;
CREATE POLICY "anon_select_pick_tasks" ON pick_tasks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pick_tasks" ON pick_tasks;
CREATE POLICY "anon_insert_pick_tasks" ON pick_tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pick_tasks" ON pick_tasks;
CREATE POLICY "anon_update_pick_tasks" ON pick_tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pick_tasks" ON pick_tasks;
CREATE POLICY "anon_delete_pick_tasks" ON pick_tasks FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_exceptions" ON exceptions;
CREATE POLICY "anon_select_exceptions" ON exceptions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_exceptions" ON exceptions;
CREATE POLICY "anon_insert_exceptions" ON exceptions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_exceptions" ON exceptions;
CREATE POLICY "anon_update_exceptions" ON exceptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_exceptions" ON exceptions;
CREATE POLICY "anon_delete_exceptions" ON exceptions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_dispatches" ON dispatches;
CREATE POLICY "anon_select_dispatches" ON dispatches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dispatches" ON dispatches;
CREATE POLICY "anon_insert_dispatches" ON dispatches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dispatches" ON dispatches;
CREATE POLICY "anon_update_dispatches" ON dispatches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dispatches" ON dispatches;
CREATE POLICY "anon_delete_dispatches" ON dispatches FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_stock_movements" ON stock_movements;
CREATE POLICY "anon_select_stock_movements" ON stock_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_stock_movements" ON stock_movements;
CREATE POLICY "anon_insert_stock_movements" ON stock_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_stock_movements" ON stock_movements;
CREATE POLICY "anon_update_stock_movements" ON stock_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_stock_movements" ON stock_movements;
CREATE POLICY "anon_delete_stock_movements" ON stock_movements FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_audit_log" ON audit_log;
CREATE POLICY "anon_select_audit_log" ON audit_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_log" ON audit_log;
CREATE POLICY "anon_insert_audit_log" ON audit_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_log" ON audit_log;
CREATE POLICY "anon_update_audit_log" ON audit_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_log" ON audit_log;
CREATE POLICY "anon_delete_audit_log" ON audit_log FOR DELETE TO anon, authenticated USING (true);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
