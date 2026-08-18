import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Package, Clock, Truck, AlertTriangle,
  Activity, Layers,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import {
  fetchProducts, fetchOrders, fetchStockMovements, fetchExceptions, fetchDispatches,
} from '@/lib/dataApi';
import { formatCurrency, formatOrderStatus, formatPriority } from '@/lib/format';
import type { Product, Order, StockMovement, Exception, Dispatch } from '@/lib/types';

export function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, o, m, e, d] = await Promise.all([
        fetchProducts(), fetchOrders(), fetchStockMovements(), fetchExceptions(), fetchDispatches(),
      ]);
      setProducts(p);
      setOrders(o);
      setMovements(m);
      setExceptions(e);
      setDispatches(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState label="Loading analytics..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  // Category breakdown
  const categoryMap: Record<string, { count: number; value: number; stock: number }> = {};
  products.forEach((p) => {
    if (!categoryMap[p.category]) categoryMap[p.category] = { count: 0, value: 0, stock: 0 };
    categoryMap[p.category].count++;
    categoryMap[p.category].value += p.quantity_on_hand * p.unit_price;
    categoryMap[p.category].stock += p.quantity_on_hand;
  });
  const categories = Object.entries(categoryMap).sort((a, b) => b[1].value - a[1].value);
  const maxCategoryValue = Math.max(...categories.map(([, v]) => v.value));

  // Order status distribution
  const statusMap: Record<string, number> = {};
  orders.forEach((o) => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
  const statusEntries = Object.entries(statusMap).sort((a, b) => b[1] - a[1]);
  const maxStatusCount = Math.max(...statusEntries.map(([, c]) => c), 1);

  // Priority distribution
  const priorityMap: Record<string, number> = {};
  orders.forEach((o) => { priorityMap[o.priority] = (priorityMap[o.priority] || 0) + 1; });

  // Movement type breakdown
  const movementMap: Record<string, number> = {};
  movements.forEach((m) => { movementMap[m.movement_type] = (movementMap[m.movement_type] || 0) + 1; });
  const movementEntries = Object.entries(movementMap);
  const maxMovement = Math.max(...movementEntries.map(([, c]) => c), 1);

  // Top valued products
  const topProducts = [...products]
    .sort((a, b) => b.quantity_on_hand * b.unit_price - a.quantity_on_hand * a.unit_price)
    .slice(0, 8);
  const maxProductValue = Math.max(...topProducts.map((p) => p.quantity_on_hand * p.unit_price), 1);

  // Exception type breakdown
  const exceptionMap: Record<string, number> = {};
  exceptions.forEach((e) => { exceptionMap[e.type] = (exceptionMap[e.type] || 0) + 1; });

  // Fulfillment rate
  const fulfilled = orders.filter((o) => o.status === 'dispatched').length;
  const fulfillmentRate = orders.length > 0 ? (fulfilled / orders.length) * 100 : 0;

  // Avg order value
  const avgOrderValue = orders.length > 0
    ? orders.reduce((s, o) => s + (o.total_value || 0), 0) / orders.length
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#e8ecf4] mb-1">Operational Analytics</h1>
        <p className="text-sm text-[#8892a8]">Insights into warehouse performance and bottlenecks</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Fulfillment Rate" value={`${fulfillmentRate.toFixed(0)}%`} icon={Truck} accentColor="#22c55e" sublabel={`${fulfilled} of ${orders.length} orders`} />
        <StatCard label="Avg Order Value" value={formatCurrency(avgOrderValue)} icon={BarChart3} accentColor="#3b82f6" />
        <StatCard label="Stock Movements" value={movements.length} icon={Activity} accentColor="#00d4aa" sublabel="Total logged" />
        <StatCard label="Exception Rate" value={orders.length > 0 ? `${((exceptions.length / orders.length) * 100).toFixed(0)}%` : '0%'} icon={AlertTriangle} accentColor="#f59e0b" sublabel={`${exceptions.length} incidents`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory by Category */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} className="text-[#00d4aa]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Inventory Value by Category</h2>
          </div>
          <div className="space-y-3">
            {categories.map(([cat, data]) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[#e8ecf4]">{cat}</span>
                  <span className="text-sm font-mono text-[#8892a8]">{formatCurrency(data.value)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(data.value / maxCategoryValue) * 100}%`, backgroundColor: 'var(--accent)' }} />
                </div>
                <div className="text-xs text-[#5a6478] mt-1">{data.count} SKUs • {data.stock} units</div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-[#3b82f6]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Order Status Distribution</h2>
          </div>
          <div className="space-y-3">
            {statusEntries.map(([status, count]) => {
              const info = formatOrderStatus(status as never);
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-[#e8ecf4] truncate">{info.label}</div>
                  <div className="flex-1 progress-bar">
                    <div className="progress-fill" style={{ width: `${(count / maxStatusCount) * 100}%`, backgroundColor: 'var(--info)' }} />
                  </div>
                  <div className="w-8 text-right text-sm font-mono text-[#8892a8]">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stock Movements */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-[#f59e0b]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Stock Movement Activity</h2>
          </div>
          <div className="space-y-3">
            {movementEntries.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <div className="w-28 text-sm text-[#e8ecf4] capitalize">{type}</div>
                <div className="flex-1 progress-bar">
                  <div className="progress-fill" style={{ width: `${(count / maxMovement) * 100}%`, backgroundColor: type === 'inbound' ? 'var(--success)' : type === 'outbound' ? 'var(--info)' : type === 'damaged' ? 'var(--danger)' : 'var(--accent)' }} />
                </div>
                <div className="w-8 text-right text-sm font-mono text-[#8892a8]">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products by Value */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-[#00d4aa]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Top Products by Stock Value</h2>
          </div>
          <div className="space-y-3">
            {topProducts.map((p) => {
              const value = p.quantity_on_hand * p.unit_price;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#e8ecf4] truncate">{p.name}</div>
                    <div className="text-xs text-[#5a6478] font-mono">{p.sku}</div>
                  </div>
                  <div className="w-24 progress-bar">
                    <div className="progress-fill" style={{ width: `${(value / maxProductValue) * 100}%`, backgroundColor: 'var(--accent)' }} />
                  </div>
                  <div className="w-20 text-right text-sm font-mono text-[#8892a8]">{formatCurrency(value)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Priority & Exception Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-[#8892a8]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Order Priority Breakdown</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['urgent', 'high', 'standard', 'low'] as const).map((prio) => {
              const info = formatPriority(prio);
              const count = priorityMap[prio] || 0;
              return (
                <div key={prio} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                    <span className="text-sm text-[#e8ecf4]">{info.label}</span>
                  </div>
                  <div className="text-2xl font-bold font-mono" style={{ color: info.color }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-[#ef4444]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Exception Summary</h2>
          </div>
          {Object.keys(exceptionMap).length === 0 ? (
            <p className="text-sm text-[#8892a8] py-4 text-center">No exceptions recorded.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(exceptionMap).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <Badge variant={type === 'damaged' ? 'danger' : type === 'short_stock' ? 'warning' : 'info'}>
                      {type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Badge>
                  </div>
                  <span className="text-sm font-mono text-[#e8ecf4]">{count} incident(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Dispatches */}
      {dispatches.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={18} className="text-[#22c55e]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Recent Dispatches</h2>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#5a6478] uppercase tracking-wider">
                  <th className="text-left font-medium pb-3">Order</th>
                  <th className="text-left font-medium pb-3">Customer</th>
                  <th className="text-left font-medium pb-3">Carrier</th>
                  <th className="text-left font-medium pb-3">Tracking</th>
                  <th className="text-left font-medium pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d) => (
                  <tr key={d.id} className="table-row border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-3 text-sm font-mono text-[#e8ecf4]">{d.order?.order_number}</td>
                    <td className="py-3 text-sm text-[#8892a8]">{d.order?.customer_name}</td>
                    <td className="py-3 text-sm text-[#8892a8]">{d.carrier}</td>
                    <td className="py-3 text-xs font-mono text-[#00d4aa]">{d.tracking_number}</td>
                    <td className="py-3"><Badge variant="success" dot>In Transit</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
