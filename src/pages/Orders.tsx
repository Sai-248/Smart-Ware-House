import { useEffect, useState, useCallback } from 'react';
import {
  Search, ShoppingCart, ArrowRight, ArrowLeft, Zap, Check, X,
  Package, Truck, ClipboardCheck, AlertCircle, Clock, Lightbulb,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import {
  fetchOrders, fetchOrderItems, fetchOrderWithItems, allocateOrder,
  startPicking, moveToStage, cancelOrder,
} from '@/lib/dataApi';
import {
  computeAllocation, suggestReallocation, getOrderProgress, prioritizeOrders,
} from '@/lib/decisionEngine';
import {
  formatPriority, formatOrderStatus, formatCurrency, formatDate, timeAgo, daysUntil,
} from '@/lib/format';
import type { Order, OrderItem, Product } from '@/lib/types';

export function Orders() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allItems, setAllItems] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<Order & { order_items?: OrderItem[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [allocationResults, setAllocationResults] = useState<ReturnType<typeof computeAllocation>[]>([]);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [pickerName, setPickerName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, items] = await Promise.all([fetchOrders(), fetchOrderItems()]);
      setOrders(o);
      setAllItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (orderId: string) => {
    setDetailLoading(true);
    try {
      const detail = await fetchOrderWithItems(orderId);
      setOrderDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrder) loadDetail(selectedOrder);
  }, [selectedOrder, loadDetail]);

  const handleAllocate = async (orderId: string) => {
    const detail = await fetchOrderWithItems(orderId);
    if (!detail?.order_items) return;
    const results = detail.order_items.map((item) =>
      computeAllocation(item.product as Product, item.requested_qty)
    );
    setAllocationResults(results);
    setShowAllocationModal(true);
  };

  const confirmAllocation = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      await allocateOrder(selectedOrder);
      await loadDetail(selectedOrder);
      await load();
      setShowAllocationModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Allocation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartPicking = async () => {
    if (!selectedOrder || !pickerName.trim()) return;
    setActionLoading(true);
    try {
      await startPicking(selectedOrder, pickerName.trim());
      await loadDetail(selectedOrder);
      await load();
      setPickerName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start picking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvance = async (stage: string) => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      await moveToStage(selectedOrder, stage);
      await loadDetail(selectedOrder);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      await cancelOrder(selectedOrder);
      await loadDetail(selectedOrder);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading orders..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  // Detail view
  if (selectedOrder && orderDetail) {
    const order = orderDetail;
    const statusInfo = formatOrderStatus(order.status);
    const prio = formatPriority(order.priority);
    const progress = getOrderProgress(order.status);
    const due = daysUntil(order.required_by);
    const items = order.order_items ?? [];

    const flowSteps = [
      { key: 'pending_allocation', label: 'Allocation', icon: ClipboardCheck },
      { key: 'allocated', label: 'Allocated', icon: Check },
      { key: 'picking', label: 'Picking', icon: Package },
      { key: 'packing', label: 'Packing', icon: Package },
      { key: 'quality_check', label: 'QC', icon: ClipboardCheck },
      { key: 'dispatched', label: 'Dispatched', icon: Truck },
    ];
    const currentStepIdx = flowSteps.findIndex((s) => s.key === order.status);

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedOrder(null)} className="btn btn-ghost !p-2">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#e8ecf4] font-mono">{order.order_number}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              <Badge variant={order.priority === 'urgent' ? 'danger' : order.priority === 'high' ? 'warning' : 'info'}>
                {prio.label}
              </Badge>
            </div>
            <p className="text-sm text-[#8892a8] mt-1">{order.customer_name} • Created {timeAgo(order.created_at)}</p>
          </div>
        </div>

        {/* Progress tracker */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#e8ecf4]">Fulfillment Progress</span>
            <span className="text-xs text-[#8892a8]">{Math.round(progress)}% complete</span>
          </div>
          <ProgressBar value={progress} />
          <div className="flex items-center justify-between mt-4 overflow-x-auto scrollbar-thin">
            {flowSteps.map((step, idx) => {
              const Icon = step.icon;
              const isComplete = currentStepIdx > idx;
              const isCurrent = currentStepIdx === idx;
              return (
                <div key={step.key} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: isComplete ? 'var(--accent)' : isCurrent ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                        color: isComplete ? '#001a14' : isCurrent ? 'var(--accent)' : 'var(--text-muted)',
                        border: isCurrent ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: isCurrent || isComplete ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {step.label}
                    </span>
                  </div>
                  {idx < flowSteps.length - 1 && (
                    <div className="w-8 sm:w-16 h-0.5 mx-1" style={{ backgroundColor: isComplete ? 'var(--accent)' : 'var(--border-color)' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Order info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold text-[#e8ecf4] mb-3">Order Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8892a8]">Customer</span>
                <span className="text-[#e8ecf4] font-medium">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8892a8]">Required by</span>
                <span className="text-[#e8ecf4] font-medium">{formatDate(order.required_by)}</span>
              </div>
              {due !== null && !['dispatched', 'cancelled'].includes(order.status) && (
                <div className="flex justify-between">
                  <span className="text-[#8892a8]">Time left</span>
                  <span className="font-medium" style={{ color: due <= 1 ? 'var(--danger)' : due <= 3 ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {due <= 0 ? 'Overdue' : `${due} days`}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#8892a8]">Total value</span>
                <span className="text-[#e8ecf4] font-mono font-medium">{formatCurrency(order.total_value || items.reduce((s, i) => s + (i.product?.unit_price ?? 0) * i.requested_qty, 0))}</span>
              </div>
              {order.notes && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="text-[#8892a8] text-xs">Notes</span>
                  <p className="text-[#e8ecf4] text-sm mt-1">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-[#e8ecf4] mb-3">Line Items</h3>
            <div className="space-y-3">
              {items.map((item) => {
                const product = item.product as Product;
                const alloc = computeAllocation(product, item.requested_qty);
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                      <Package size={18} className="text-[#8892a8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#e8ecf4]">{product.name}</div>
                      <div className="text-xs text-[#5a6478] font-mono">{product.sku} • {product.zone}-{product.aisle}-{product.shelf}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-[#e8ecf4]">
                        <span className="text-[#8892a8]">Req: </span>{item.requested_qty}
                        <span className="text-[#5a6478] mx-1">|</span>
                        <span className="text-[#00d4aa]">Alloc: </span>{item.allocated_qty}
                      </div>
                      <div className="text-xs mt-0.5">
                        {item.allocated_qty === item.requested_qty ? (
                          <span className="text-[#22c55e]">Fully allocated</span>
                        ) : item.allocated_qty > 0 ? (
                          <span className="text-[#f59e0b]">Partial ({item.allocated_qty}/{item.requested_qty})</span>
                        ) : (
                          <span className="text-[#ef4444]">Unallocated</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action panel */}
        {!['dispatched', 'cancelled'].includes(order.status) && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-[#e8ecf4] mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {order.status === 'pending_allocation' && (
                <button onClick={() => handleAllocate(order.id)} className="btn btn-primary">
                  <Zap size={14} /> Run Allocation
                </button>
              )}
              {order.status === 'allocated' && (
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-xs text-[#8892a8] mb-1 block">Picker name</label>
                    <input className="input" value={pickerName} onChange={(e) => setPickerName(e.target.value)} placeholder="e.g. Alice Chen" />
                  </div>
                  <button onClick={handleStartPicking} disabled={!pickerName.trim() || actionLoading} className="btn btn-primary">
                    <Package size={14} /> Start Picking
                  </button>
                </div>
              )}
              {order.status === 'picking' && (
                <button onClick={() => handleAdvance('packing')} disabled={actionLoading} className="btn btn-primary">
                  <ArrowRight size={14} /> Move to Packing
                </button>
              )}
              {order.status === 'packing' && (
                <button onClick={() => handleAdvance('quality_check')} disabled={actionLoading} className="btn btn-primary">
                  <ClipboardCheck size={14} /> Quality Check
                </button>
              )}
              {order.status === 'quality_check' && (
                <button onClick={() => handleAdvance('dispatched')} disabled={actionLoading} className="btn btn-primary">
                  <Truck size={14} /> Dispatch Order
                </button>
              )}
              <button onClick={handleCancel} disabled={actionLoading} className="btn btn-danger ml-auto">
                <X size={14} /> Cancel Order
              </button>
            </div>
          </div>
        )}

        {/* Allocation Modal */}
        <Modal open={showAllocationModal} onClose={() => setShowAllocationModal(false)} title="Allocation Decision Review" maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="p-3 rounded-lg flex items-start gap-3" style={{ backgroundColor: 'rgba(0,212,170,0.08)' }}>
              <Lightbulb size={18} className="text-[#00d4aa] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-[#e8ecf4]">Smart Allocation Preview</div>
                <div className="text-xs text-[#8892a8] mt-1">
                  Review stock availability and recommendations before confirming allocation.
                </div>
              </div>
            </div>
            {allocationResults.map((r) => {
              const item = items.find((i) => i.product_id === r.productId);
              const product = item?.product as Product | undefined;
              return (
                <div key={r.productId} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-[#e8ecf4]">{product?.name ?? 'Unknown'}</div>
                    <Badge variant={r.canFulfill ? 'success' : r.allocated > 0 ? 'warning' : 'danger'}>
                      {r.canFulfill ? 'Can Fulfill' : r.allocated > 0 ? 'Partial' : 'No Stock'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                    <div><span className="text-[#5a6478]">Requested: </span><span className="text-[#e8ecf4] font-mono">{r.requested}</span></div>
                    <div><span className="text-[#5a6478]">Available: </span><span className="text-[#e8ecf4] font-mono">{r.available}</span></div>
                    <div><span className="text-[#5a6478]">Allocating: </span><span className="text-[#00d4aa] font-mono">{r.allocated}</span></div>
                    <div><span className="text-[#5a6478]">Shortfall: </span><span className="text-[#ef4444] font-mono">{r.shortfall}</span></div>
                  </div>
                  <div className="text-xs text-[#8892a8]">{r.recommendation}</div>
                  {!r.canFulfill && r.shortfall > 0 && (() => {
                    const suggestions = suggestReallocation(
                      order, r.productId, r.shortfall,
                      orders, allItems
                    );
                    if (suggestions.length === 0) return null;
                    return (
                      <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: 'rgba(59,130,246,0.08)' }}>
                        <div className="text-xs font-semibold text-[#3b82f6] mb-1">Reallocation Suggestions:</div>
                        {suggestions.map((s, idx) => (
                          <div key={idx} className="text-xs text-[#8892a8]">{s.reason}</div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAllocationModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={confirmAllocation} disabled={actionLoading} className="btn btn-primary">
                {actionLoading ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // List view
  let filtered = orders;
  if (search) {
    filtered = filtered.filter((o) =>
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (statusFilter !== 'all') filtered = filtered.filter((o) => o.status === statusFilter);
  if (priorityFilter !== 'all') filtered = filtered.filter((o) => o.priority === priorityFilter);

  const prioritized = prioritizeOrders(filtered);
  const activeCount = orders.filter((o) => !['dispatched', 'cancelled'].includes(o.status)).length;
  const urgentCount = orders.filter((o) => o.priority === 'urgent' && !['dispatched', 'cancelled'].includes(o.status)).length;
  const onHoldCount = orders.filter((o) => o.status === 'on_hold').length;
  const dispatchedCount = orders.filter((o) => o.status === 'dispatched').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#e8ecf4] mb-1">Order Management</h1>
        <p className="text-sm text-[#8892a8]">Manage orders through the fulfillment lifecycle with smart allocation</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active" value={activeCount} icon={ShoppingCart} accentColor="#3b82f6" />
        <StatCard label="Urgent" value={urgentCount} icon={Zap} accentColor="#ef4444" />
        <StatCard label="On Hold" value={onHoldCount} icon={AlertCircle} accentColor="#f59e0b" />
        <StatCard label="Dispatched" value={dispatchedCount} icon={Truck} accentColor="#22c55e" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a6478]" />
          <input className="input pl-9" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="pending_allocation">Pending Allocation</option>
          <option value="allocated">Allocated</option>
          <option value="picking">Picking</option>
          <option value="packing">Packing</option>
          <option value="quality_check">Quality Check</option>
          <option value="dispatched">Dispatched</option>
          <option value="on_hold">On Hold</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input sm:w-36" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="standard">Standard</option>
          <option value="low">Low</option>
        </select>
      </div>

      {prioritized.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={24} />} title="No orders found" description="Try adjusting your filters." />
      ) : (
        <div className="space-y-2">
          {prioritized.map(({ order, reason }) => {
            const statusInfo = formatOrderStatus(order.status);
            const prio = formatPriority(order.priority);
            const due = daysUntil(order.required_by);
            const progress = getOrderProgress(order.status);
            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order.id)}
                className="card card-hover p-4 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: prio.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-[#e8ecf4] font-mono">{order.order_number}</span>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      <Badge variant={order.priority === 'urgent' ? 'danger' : order.priority === 'high' ? 'warning' : 'info'}>
                        {prio.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-[#8892a8] mt-1">{order.customer_name} • {reason}</div>
                  </div>
                  <div className="hidden sm:block w-32">
                    <ProgressBar value={progress} />
                  </div>
                  {due !== null && !['dispatched', 'cancelled'].includes(order.status) && (
                    <div className="text-right">
                      <div className="text-xs text-[#5a6478]">Due</div>
                      <div className="text-sm font-medium" style={{ color: due <= 1 ? 'var(--danger)' : due <= 3 ? 'var(--warning)' : 'var(--text-primary)' }}>
                        {due <= 0 ? 'Overdue' : formatDate(order.required_by)}
                      </div>
                    </div>
                  )}
                  <ArrowRight size={16} className="text-[#5a6478]" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
