export type OrderPriority = 'low' | 'standard' | 'high' | 'urgent';
export type OrderStatus =
  | 'created'
  | 'pending_allocation'
  | 'allocated'
  | 'picking'
  | 'packing'
  | 'quality_check'
  | 'dispatched'
  | 'cancelled'
  | 'on_hold';

export type PickTaskStatus = 'pending' | 'in_progress' | 'picked' | 'short';
export type ExceptionType = 'damaged' | 'missing' | 'short_stock' | 'misplaced' | 'quality';
export type ExceptionStatus = 'open' | 'investigating' | 'resolved';
export type ProductStatus = 'active' | 'discontinued';
export type MovementType = 'inbound' | 'outbound' | 'adjustment' | 'damaged' | 'allocated' | 'reallocated';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity_on_hand: number;
  quantity_allocated: number;
  reorder_point: number;
  reorder_qty: number;
  zone: string;
  aisle: string;
  shelf: string;
  unit_price: number;
  supplier: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  priority: OrderPriority;
  status: OrderStatus;
  required_by: string | null;
  total_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  requested_qty: number;
  allocated_qty: number;
  status: string;
  created_at: string;
  product?: Product;
}

export interface OrderWithItems extends Order {
  order_items?: OrderItem[];
}

export interface PickTask {
  id: string;
  order_id: string;
  order_item_id: string;
  product_id: string;
  picker: string | null;
  status: PickTaskStatus;
  picked_qty: number;
  created_at: string;
  completed_at: string | null;
  product?: Product;
  order?: Order;
  order_item?: OrderItem;
}

export interface Exception {
  id: string;
  order_id: string | null;
  order_item_id: string | null;
  product_id: string | null;
  type: ExceptionType;
  description: string;
  status: ExceptionStatus;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  product?: Product;
  order?: Order;
}

export interface Dispatch {
  id: string;
  order_id: string;
  carrier: string;
  tracking_number: string | null;
  dispatched_at: string;
  status: string;
  order?: Order;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  reference: string | null;
  created_at: string;
  product?: Product;
}

export const PRIORITY_WEIGHTS: Record<OrderPriority, number> = {
  urgent: 4,
  high: 3,
  standard: 2,
  low: 1,
};

export const PRIORITY_RANK: OrderPriority[] = ['urgent', 'high', 'standard', 'low'];

export const ORDER_FLOW: OrderStatus[] = [
  'created',
  'pending_allocation',
  'allocated',
  'picking',
  'packing',
  'quality_check',
  'dispatched',
];
