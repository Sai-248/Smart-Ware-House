import type { Product, Order, OrderItem, OrderPriority } from './types';
import { PRIORITY_WEIGHTS } from './types';

export interface AllocationResult {
  productId: string;
  requested: number;
  available: number;
  allocated: number;
  canFulfill: boolean;
  shortfall: number;
  recommendation: string;
}

export function getAvailableStock(product: Product): number {
  return product.quantity_on_hand - product.quantity_allocated;
}

export function computeAllocation(
  product: Product,
  requestedQty: number
): AllocationResult {
  const available = getAvailableStock(product);
  const allocated = Math.min(available, requestedQty);
  const shortfall = requestedQty - allocated;
  const canFulfill = shortfall === 0;

  let recommendation = '';
  if (canFulfill) {
    recommendation = `Allocate ${allocated} units from Zone ${product.zone} / Aisle ${product.aisle} / Shelf ${product.shelf}.`;
  } else if (allocated > 0) {
    recommendation = `Partial allocation: ${allocated} of ${requestedQty} units available. ${shortfall} unit(s) short — consider reallocating from lower-priority orders or expediting restock (reorder qty: ${product.reorder_qty}).`;
  } else {
    recommendation = `No stock available. ${shortfall} unit(s) short. Expedite reorder of ${product.reorder_qty} units from ${product.supplier ?? 'supplier'}, or reallocate from lower-priority orders.`;
  }

  return {
    productId: product.id,
    requested: requestedQty,
    available,
    allocated,
    canFulfill,
    shortfall,
    recommendation,
  };
}

export interface PrioritizedOrder {
  order: Order;
  score: number;
  reason: string;
}

export function prioritizeOrders(orders: Order[]): PrioritizedOrder[] {
  const now = new Date();
  return orders
    .map((order) => {
      let score = PRIORITY_WEIGHTS[order.priority] * 100;
      const reasons: string[] = [];

      if (order.priority === 'urgent') {
        reasons.push('Urgent priority');
      } else if (order.priority === 'high') {
        reasons.push('High priority');
      }

      if (order.required_by) {
        const daysUntilDue = Math.ceil(
          (new Date(order.required_by).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilDue <= 1) {
          score += 50;
          reasons.push('Due within 24 hours');
        } else if (daysUntilDue <= 2) {
          score += 25;
          reasons.push('Due within 2 days');
        } else if (daysUntilDue <= 3) {
          score += 10;
          reasons.push('Due within 3 days');
        }
      }

      const ageHours = (now.getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
      if (ageHours > 4) {
        score += 5;
        reasons.push('Aging order');
      }

      return {
        order,
        score,
        reason: reasons.join(' • ') || 'Standard fulfillment',
      };
    })
    .sort((a, b) => b.score - a.score);
}

export interface ReorderRecommendation {
  product: Product;
  currentStock: number;
  availableStock: number;
  reorderPoint: number;
  recommendedQty: number;
  urgency: 'critical' | 'low' | 'ok';
  reason: string;
}

export function getReorderRecommendations(products: Product[]): ReorderRecommendation[] {
  return products
    .map((product) => {
      const available = getAvailableStock(product);
      const recommendedQty = product.reorder_qty;

      let urgency: ReorderRecommendation['urgency'] = 'ok';
      let reason = 'Stock levels healthy.';

      if (product.quantity_on_hand === 0) {
        urgency = 'critical';
        reason = 'Out of stock — immediate reorder required.';
      } else if (available <= 0) {
        urgency = 'critical';
        reason = 'All stock allocated — reorder to fulfill pending orders.';
      } else if (product.quantity_on_hand <= product.reorder_point) {
        urgency = 'low';
        reason = `Below reorder point (${product.reorder_point}). Reorder recommended.`;
      } else if (available <= product.reorder_point) {
        urgency = 'low';
        reason = 'Available stock approaching reorder threshold after allocations.';
      }

      return {
        product,
        currentStock: product.quantity_on_hand,
        availableStock: available,
        reorderPoint: product.reorder_point,
        recommendedQty,
        urgency,
        reason,
      };
    })
    .filter((r) => r.urgency !== 'ok')
    .sort((a, b) => {
      const order = { critical: 0, low: 1, ok: 2 };
      return order[a.urgency] - order[b.urgency];
    });
}

export interface ReallocationSuggestion {
  fromOrderId: string;
  fromOrderNumber: string;
  fromPriority: OrderPriority;
  productId: string;
  productName: string;
  reclaimableQty: number;
  toOrderNumber: string;
  reason: string;
}

export function suggestReallocation(
  shortOrder: Order,
  shortProductId: string,
  shortfall: number,
  allOrders: Order[],
  allItems: OrderItem[]
): ReallocationSuggestion[] {
  const suggestions: ReallocationSuggestion[] = [];
  const shortPriority = PRIORITY_WEIGHTS[shortOrder.priority];

  for (const order of allOrders) {
    if (order.id === shortOrder.id) continue;
    if (PRIORITY_WEIGHTS[order.priority] >= shortPriority) continue;

    const items = allItems.filter(
      (item) => item.order_id === order.id && item.product_id === shortProductId && item.allocated_qty > 0
    );

    for (const item of items) {
      const reclaimable = Math.min(item.allocated_qty, shortfall);
      if (reclaimable > 0) {
        suggestions.push({
          fromOrderId: order.id,
          fromOrderNumber: order.order_number,
          fromPriority: order.priority,
          productId: shortProductId,
          productName: item.product?.name ?? 'Unknown',
          reclaimableQty: reclaimable,
          toOrderNumber: shortOrder.order_number,
          reason: `Reclaim ${reclaimable} unit(s) from ${order.order_number} (${order.priority} priority) to fulfill ${shortOrder.order_number} (${shortOrder.priority} priority).`,
        });
      }
    }
  }

  return suggestions.sort(
    (a, b) => PRIORITY_WEIGHTS[a.fromPriority] - PRIORITY_WEIGHTS[b.fromPriority]
  );
}

export function getStockStatus(product: Product): 'out' | 'critical' | 'low' | 'ok' {
  const available = getAvailableStock(product);
  if (product.quantity_on_hand === 0) return 'out';
  if (available <= 0) return 'critical';
  if (product.quantity_on_hand <= product.reorder_point) return 'low';
  if (available <= product.reorder_point) return 'low';
  return 'ok';
}

export function getOrderProgress(status: string): number {
  const flow = ['created', 'pending_allocation', 'allocated', 'picking', 'packing', 'quality_check', 'dispatched'];
  const idx = flow.indexOf(status);
  if (idx === -1) return 0;
  return ((idx + 1) / flow.length) * 100;
}
