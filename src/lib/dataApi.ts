import { supabase } from './supabase';
import type {
  Product,
  Order,
  OrderItem,
  OrderWithItems,
  PickTask,
  Exception,
  Dispatch,
  StockMovement,
} from './types';

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, product:products(*))')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchOrderItems(): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*, product:products(*)')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function fetchPickTasks(): Promise<PickTask[]> {
  const { data, error } = await supabase
    .from('pick_tasks')
    .select('*, product:products(*), order:orders(*), order_item:order_items(*)')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function fetchExceptions(): Promise<Exception[]> {
  const { data, error } = await supabase
    .from('exceptions')
    .select('*, product:products(*), order:orders(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchDispatches(): Promise<Dispatch[]> {
  const { data, error } = await supabase
    .from('dispatches')
    .select('*, order:orders(*)')
    .order('dispatched_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchStockMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, product:products(*)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

// ---- Mutations ----

export async function allocateOrder(orderId: string): Promise<{ success: boolean; message: string }> {
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*, product:products(*)')
    .eq('order_id', orderId);

  if (itemsError) throw itemsError;
  if (!items || items.length === 0) return { success: false, message: 'No items in order.' };

  let allFulfilled = true;
  const updates: PromiseLike<unknown>[] = [];

  for (const item of items) {
    const product = item.product as Product;
    const available = product.quantity_on_hand - product.quantity_allocated;
    const toAllocate = Math.min(available, item.requested_qty);

    if (toAllocate < item.requested_qty) allFulfilled = false;

    if (toAllocate > 0) {
      updates.push(
        supabase
          .from('order_items')
          .update({ allocated_qty: toAllocate, status: toAllocate === item.requested_qty ? 'allocated' : 'partial' })
          .eq('id', item.id)
          .then()
      );
      updates.push(
        supabase
          .from('products')
          .update({ quantity_allocated: product.quantity_allocated + toAllocate })
          .eq('id', product.id)
          .then()
      );
      updates.push(
        supabase.from('stock_movements').insert({
          product_id: product.id,
          movement_type: 'allocated',
          quantity: toAllocate,
          reference: `Order allocation`,
        }).then()
      );
    }
  }

  await Promise.all(updates);

  const newStatus = allFulfilled ? 'allocated' : 'on_hold';
  await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);

  return {
    success: allFulfilled,
    message: allFulfilled
      ? 'All items fully allocated.'
      : 'Partial allocation — some items could not be fulfilled. Order placed on hold.',
  };
}

export async function startPicking(orderId: string, picker: string): Promise<void> {
  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .eq('status', 'allocated');

  if (!items) return;

  for (const item of items) {
    await supabase.from('pick_tasks').insert({
      order_id: orderId,
      order_item_id: item.id,
      product_id: item.product_id,
      picker,
      status: 'pending',
      picked_qty: 0,
    });
  }

  await supabase.from('orders').update({ status: 'picking' }).eq('id', orderId);
}

export async function completePickTask(taskId: string, pickedQty: number): Promise<void> {
  const { data: task } = await supabase
    .from('pick_tasks')
    .select('*, order_item:order_items(*)')
    .eq('id', taskId)
    .maybeSingle();
  if (!task) return;

  const isShort = pickedQty < task.order_item.allocated_qty;
  await supabase
    .from('pick_tasks')
    .update({
      status: isShort ? 'short' : 'picked',
      picked_qty: pickedQty,
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (isShort) {
    await supabase.from('exceptions').insert({
      order_id: task.order_id,
      order_item_id: task.order_item_id,
      product_id: task.product_id,
      type: 'short_stock',
      description: `Picker reported shortage: picked ${pickedQty} of ${task.order_item.allocated_qty} allocated units.`,
      status: 'open',
    });
  }

  await checkAllPicked(task.order_id);
}

export async function checkAllPicked(orderId: string): Promise<void> {
  const { data: tasks } = await supabase
    .from('pick_tasks')
    .select('status')
    .eq('order_id', orderId);

  if (!tasks || tasks.length === 0) return;

  const allPicked = tasks.every((t) => t.status === 'picked' || t.status === 'short');
  if (allPicked) {
    await supabase.from('orders').update({ status: 'packing' }).eq('id', orderId);
  }
}

export async function moveToStage(orderId: string, stage: string): Promise<void> {
  await supabase.from('orders').update({ status: stage }).eq('id', orderId);

  if (stage === 'dispatched') {
    await supabase.from('dispatches').insert({
      order_id: orderId,
      carrier: 'FedEx',
      tracking_number: 'FDX' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      dispatched_at: new Date().toISOString(),
      status: 'in_transit',
    });

    const { data: items } = await supabase
      .from('order_items')
      .select('*, product:products(*)')
      .eq('order_id', orderId);

    if (items) {
      for (const item of items) {
        const product = item.product as Product;
        await supabase
          .from('products')
          .update({
            quantity_on_hand: product.quantity_on_hand - item.allocated_qty,
            quantity_allocated: product.quantity_allocated - item.allocated_qty,
          })
          .eq('id', product.id);
        await supabase.from('stock_movements').insert({
          product_id: product.id,
          movement_type: 'outbound',
          quantity: item.allocated_qty,
          reference: 'Order dispatch',
        });
      }
    }
  }
}

export async function resolveException(
  exceptionId: string,
  resolution: string
): Promise<void> {
  await supabase
    .from('exceptions')
    .update({
      status: 'resolved',
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', exceptionId);
}

export async function restockProduct(productId: string, qty: number): Promise<void> {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (!product) return;

  await supabase
    .from('products')
    .update({ quantity_on_hand: product.quantity_on_hand + qty })
    .eq('id', productId);

  await supabase.from('stock_movements').insert({
    product_id: productId,
    movement_type: 'inbound',
    quantity: qty,
    reference: 'Manual restock',
  });
}

export async function reportDamage(productId: string, qty: number, orderId?: string): Promise<void> {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (!product) return;

  await supabase
    .from('products')
    .update({ quantity_on_hand: Math.max(0, product.quantity_on_hand - qty) })
    .eq('id', productId);

  await supabase.from('stock_movements').insert({
    product_id: productId,
    movement_type: 'damaged',
    quantity: qty,
    reference: 'Damage report',
  });

  await supabase.from('exceptions').insert({
    product_id: productId,
    order_id: orderId ?? null,
    type: 'damaged',
    description: `${qty} unit(s) of ${product.name} reported as damaged and removed from inventory.`,
    status: 'open',
  });
}

export async function createOrder(
  orderNumber: string,
  customerName: string,
  priority: string,
  requiredBy: string | null,
  notes: string | null,
  items: { sku: string; qty: number }[]
): Promise<void> {
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_name: customerName,
      priority,
      status: 'pending_allocation',
      required_by: requiredBy,
      notes,
    })
    .select()
    .single();
  if (error) throw error;

  for (const item of items) {
    const { data: product } = await supabase
      .from('products')
      .select('id, unit_price')
      .eq('sku', item.sku)
      .maybeSingle();
    if (!product) continue;

    await supabase.from('order_items').insert({
      order_id: order.id,
      product_id: product.id,
      requested_qty: item.qty,
      allocated_qty: 0,
      status: 'pending',
    });
  }
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { data: items } = await supabase
    .from('order_items')
    .select('*, product:products(*)')
    .eq('order_id', orderId);

  if (items) {
    for (const item of items) {
      if (item.allocated_qty > 0) {
        const product = item.product as Product;
        await supabase
          .from('products')
          .update({ quantity_allocated: product.quantity_allocated - item.allocated_qty })
          .eq('id', product.id);
      }
    }
  }

  await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
}
