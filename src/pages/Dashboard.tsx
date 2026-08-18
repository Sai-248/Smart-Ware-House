import { useEffect, useState, useCallback } from 'react';
import {
  Package, ShoppingCart, AlertTriangle, Truck, TrendingUp, Clock,
  ArrowRight, Zap, Activity, Layers,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingState, ErrorState } from '@/components/ui/States';
import {
  fetchProducts, fetchOrders, fetchExceptions, fetchPickTasks,
} from '@/lib/dataApi';
import { getReorderRecommendations, prioritizeOrders, getOrderProgress } from '@/lib/decisionEngine';
import { formatPriority, formatOrderStatus, formatCurrency, timeAgo, daysUntil } from '@/lib/format';
import type { Product, Order, Exception, PickTask } from '@/lib/types';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [pickTasks, setPickTasks] = useState<PickTask[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, o, e, t] = await Promise.all([
        fetchProducts(),
        fetchOrders(),
        fetchExceptions(),
        fetchPickTasks(),
      ]);
      setProducts(p);
      setOrders(o);
      setExceptions(e);
      setPickTasks(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState label="Loading warehouse data..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const reorderAlerts = getReorderRecommendations(products);
  const openExceptions = exceptions.filter((e) => e.status === 'open');
  const activeOrders = orders.filter((o) => !['dispatched', 'cancelled'].includes(o.status));
  const prioritized = prioritizeOrders(activeOrders).slice(0, 5);
  const totalStockValue = products.reduce((sum, p) => sum + p.quantity_on_hand * p.unit_price, 0);
  const outOfStock = products.filter((p) => p.quantity_on_hand === 0);
  const lowStock = products.filter((p) => p.quantity_on_hand > 0 && p.quantity_on_hand <= p.reorder_point);

  const stageCounts: Record<string, number> = {};
  orders.forEach((o) => {
    if (!['dispatched', 'cancelled'].includes(o.status)) {
      stageCounts[o.status] = (stageCounts[o.status] || 0) + 1;
    }
  });
  const stages = ['pending_allocation', 'allocated', 'picking', 'packing', 'quality_check'];
  const bottleneckStage = stages.reduce((max, s) => (stageCounts[s] > max.count ? { stage: s, count: stageCounts[s] } : max), { stage: '', count: 0 });

  const urgentOrders = orders.filter((o) => o.priority === 'urgent' && !['dispatched', 'cancelled'].includes(o.status));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#e8ecf4] mb-1">Operations Dashboard</h1>
        <p className="text-sm text-[#8892a8]">Real-time warehouse overview and decision intelligence</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Orders" value={activeOrders.length} icon={ShoppingCart} accentColor="#3b82f6" sublabel={`${urgentOrders.length} urgent`} />
        <StatCard label="Inventory Value" value={formatCurrency(totalStockValue)} icon={Layers} accentColor="#00d4aa" sublabel={`${products.length} SKUs tracked`} />
        <StatCard label="Open Exceptions" value={openExceptions.length} icon={AlertTriangle} accentColor="#ef4444" sublabel="Requires attention" />
        <StatCard label="Stock Alerts" value={reorderAlerts.length} icon={TrendingUp} accentColor="#f59e0b" sublabel={`${outOfStock.length} out, ${lowStock.length} low`} />
      </div>

      {/* Alerts Banner */}
      {(openExceptions.length > 0 || outOfStock.length > 0) && (
        <div className="card p-4 border-l-4" style={{ borderLeftColor: 'var(--danger)' }}>
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle size={18} className="text-[#ef4444]" />
            <span className="font-semibold text-[#e8ecf4]">Critical Alerts</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {outOfStock.length > 0 && (
              <button onClick={() => onNavigate('inventory')} className="badge bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 cursor-pointer hover:bg-[#ef4444]/20">
                {outOfStock.length} out of stock
              </button>
            )}
            {lowStock.length > 0 && (
              <button onClick={() => onNavigate('inventory')} className="badge bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 cursor-pointer hover:bg-[#f59e0b]/20">
                {lowStock.length} below reorder point
              </button>
            )}
            {openExceptions.length > 0 && (
              <button onClick={() => onNavigate('exceptions')} className="badge bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 cursor-pointer hover:bg-[#3b82f6]/20">
                {openExceptions.length} open exceptions
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Queue */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-[#00d4aa]" />
              <h2 className="text-base font-semibold text-[#e8ecf4]">Priority Queue</h2>
            </div>
            <button onClick={() => onNavigate('orders')} className="text-xs text-[#8892a8] hover:text-[#00d4aa] flex items-center gap-1 transition-colors">
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {prioritized.map(({ order, reason }) => {
              const prio = formatPriority(order.priority);
              const due = daysUntil(order.required_by);
              return (
                <div key={order.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="w-1 h-10 rounded-full" style={{ backgroundColor: prio.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#e8ecf4] font-mono">{order.order_number}</span>
                      <span className="text-xs text-[#8892a8] truncate">{order.customer_name}</span>
                    </div>
                    <div className="text-xs text-[#5a6478] mt-0.5">{reason}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={order.priority === 'urgent' ? 'danger' : order.priority === 'high' ? 'warning' : 'info'}>
                      {prio.label}
                    </Badge>
                    {due !== null && due <= 2 && (
                      <span className="text-xs text-[#f59e0b]">{due <= 0 ? 'Overdue' : `${due}d left`}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fulfillment Pipeline */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-[#3b82f6]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Fulfillment Pipeline</h2>
          </div>
          <div className="space-y-4">
            {stages.map((stage) => {
              const count = stageCounts[stage] || 0;
              const pct = activeOrders.length > 0 ? (count / activeOrders.length) * 100 : 0;
              const isBottleneck = stage === bottleneckStage.stage && count > 0;
              const statusInfo = formatOrderStatus(stage as never);
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#e8ecf4]">{statusInfo.label}</span>
                      {isBottleneck && (
                        <Badge variant="danger" dot>Bottleneck</Badge>
                      )}
                    </div>
                    <span className="text-sm font-mono text-[#8892a8]">{count}</span>
                  </div>
                  <ProgressBar value={pct} color={isBottleneck ? 'var(--danger)' : 'var(--accent)'} />
                </div>
              );
            })}
          </div>
          {bottleneckStage.count > 0 && (
            <div className="mt-4 p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#f0a0a0' }}>
              <strong>Bottleneck detected:</strong> {formatOrderStatus(bottleneckStage.stage as never).label} has {bottleneckStage.count} orders stuck. Consider reallocating staff to this stage.
            </div>
          )}
        </div>
      </div>

      {/* Reorder Recommendations */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#f59e0b]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Reorder Recommendations</h2>
          </div>
          <button onClick={() => onNavigate('inventory')} className="text-xs text-[#8892a8] hover:text-[#00d4aa] flex items-center gap-1 transition-colors">
            Manage inventory <ArrowRight size={12} />
          </button>
        </div>
        {reorderAlerts.length === 0 ? (
          <p className="text-sm text-[#8892a8] py-4 text-center">All stock levels are healthy.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#5a6478] uppercase tracking-wider">
                  <th className="text-left font-medium pb-3 pl-2">Product</th>
                  <th className="text-left font-medium pb-3">SKU</th>
                  <th className="text-right font-medium pb-3">On Hand</th>
                  <th className="text-right font-medium pb-3">Available</th>
                  <th className="text-right font-medium pb-3">Reorder Qty</th>
                  <th className="text-left font-medium pb-3">Urgency</th>
                </tr>
              </thead>
              <tbody>
                {reorderAlerts.map((rec) => (
                  <tr key={rec.product.id} className="table-row border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-3 pl-2">
                      <div className="text-sm font-medium text-[#e8ecf4]">{rec.product.name}</div>
                      <div className="text-xs text-[#5a6478]">{rec.product.category}</div>
                    </td>
                    <td className="py-3 text-xs font-mono text-[#8892a8]">{rec.product.sku}</td>
                    <td className="py-3 text-right text-sm font-mono text-[#e8ecf4]">{rec.currentStock}</td>
                    <td className="py-3 text-right text-sm font-mono text-[#8892a8]">{rec.availableStock}</td>
                    <td className="py-3 text-right text-sm font-mono text-[#00d4aa]">{rec.recommendedQty}</td>
                    <td className="py-3">
                      <Badge variant={rec.urgency === 'critical' ? 'danger' : 'warning'} dot>
                        {rec.urgency === 'critical' ? 'Critical' : 'Low'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-[#8892a8]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Recent Orders</h2>
          </div>
          <div className="space-y-2">
            {orders.slice(0, 5).map((order) => {
              const statusInfo = formatOrderStatus(order.status);
              return (
                <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <div className="text-sm font-medium text-[#e8ecf4] font-mono">{order.order_number}</div>
                    <div className="text-xs text-[#5a6478]">{order.customer_name} • {timeAgo(order.created_at)}</div>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={18} className="text-[#8892a8]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Active Pickers</h2>
          </div>
          <div className="space-y-2">
            {pickTasks.filter((t) => t.status === 'in_progress' || t.status === 'pending').slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <div className="text-sm font-medium text-[#e8ecf4]">{task.picker ?? 'Unassigned'}</div>
                  <div className="text-xs text-[#5a6478]">
                    {task.product?.name} • {task.order?.order_number}
                  </div>
                </div>
                <Badge variant={task.status === 'in_progress' ? 'warning' : 'default'}>
                  {task.status === 'in_progress' ? 'Picking' : 'Queued'}
                </Badge>
              </div>
            ))}
            {pickTasks.filter((t) => t.status === 'in_progress' || t.status === 'pending').length === 0 && (
              <p className="text-sm text-[#8892a8] py-4 text-center">No active picking tasks.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
