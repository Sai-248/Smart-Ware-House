import { useEffect, useState, useCallback } from 'react';
import { Search, Package, AlertTriangle, TrendingDown, Plus, Minus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { fetchProducts, restockProduct, reportDamage } from '@/lib/dataApi';
import { getStockStatus, getAvailableStock, getReorderRecommendations } from '@/lib/decisionEngine';
import { formatCurrency } from '@/lib/format';
import type { Product } from '@/lib/types';

export function Inventory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState(50);
  const [damageTarget, setDamageTarget] = useState<Product | null>(null);
  const [damageQty, setDamageQty] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchProducts();
      setProducts(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRestock = async () => {
    if (!restockTarget) return;
    setActionLoading(true);
    try {
      await restockProduct(restockTarget.id, restockQty);
      await load();
      setRestockTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restock failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDamage = async () => {
    if (!damageTarget) return;
    setActionLoading(true);
    try {
      await reportDamage(damageTarget.id, damageQty);
      await load();
      setDamageTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Damage report failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading inventory..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];
  const reorderAlerts = getReorderRecommendations(products);

  let filtered = products;
  if (search) {
    filtered = filtered.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (categoryFilter !== 'all') {
    filtered = filtered.filter((p) => p.category === categoryFilter);
  }
  if (stockFilter !== 'all') {
    filtered = filtered.filter((p) => getStockStatus(p) === stockFilter);
  }

  const totalValue = products.reduce((s, p) => s + p.quantity_on_hand * p.unit_price, 0);
  const outCount = products.filter((p) => p.quantity_on_hand === 0).length;
  const lowCount = products.filter((p) => p.quantity_on_hand > 0 && p.quantity_on_hand <= p.reorder_point).length;
  const allocatedCount = products.reduce((s, p) => s + p.quantity_allocated, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e8ecf4] mb-1">Inventory Management</h1>
          <p className="text-sm text-[#8892a8]">Monitor stock levels, restock, and report damaged goods</p>
        </div>
        <button onClick={load} className="btn btn-secondary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total SKUs" value={products.length} icon={Package} accentColor="#00d4aa" />
        <StatCard label="Inventory Value" value={formatCurrency(totalValue)} icon={TrendingDown} accentColor="#3b82f6" />
        <StatCard label="Out of Stock" value={outCount} icon={AlertTriangle} accentColor="#ef4444" />
        <StatCard label="Allocated Units" value={allocatedCount} icon={Package} accentColor="#f59e0b" />
      </div>

      {reorderAlerts.length > 0 && (
        <div className="card p-4 border-l-4" style={{ borderLeftColor: 'var(--warning)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-[#f59e0b]" />
            <span className="font-semibold text-[#e8ecf4] text-sm">{reorderAlerts.length} products need restocking</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {reorderAlerts.slice(0, 5).map((r) => (
              <button
                key={r.product.id}
                onClick={() => { setRestockTarget(r.product); setRestockQty(r.recommendedQty); }}
                className="badge bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 cursor-pointer hover:bg-[#f59e0b]/20"
              >
                {r.product.name} ({r.currentStock} left)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a6478]" />
          <input
            className="input pl-9"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input sm:w-40" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
        <select className="input sm:w-40" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
          <option value="all">All Stock</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="critical">Critical</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Package size={24} />} title="No products found" description="Try adjusting your search or filters." />
      ) : (
        <div className="card overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[#5a6478] uppercase tracking-wider">
                <th className="text-left font-medium px-4 py-3">Product</th>
                <th className="text-left font-medium px-4 py-3">SKU</th>
                <th className="text-left font-medium px-4 py-3">Location</th>
                <th className="text-right font-medium px-4 py-3">On Hand</th>
                <th className="text-right font-medium px-4 py-3">Allocated</th>
                <th className="text-right font-medium px-4 py-3">Available</th>
                <th className="text-right font-medium px-4 py-3">Price</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const status = getStockStatus(p);
                const available = getAvailableStock(p);
                return (
                  <tr key={p.id} className="table-row border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-[#e8ecf4]">{p.name}</div>
                      <div className="text-xs text-[#5a6478]">{p.category} • {p.supplier}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-[#8892a8]">{p.sku}</td>
                    <td className="px-4 py-3 text-xs text-[#8892a8] font-mono">{p.zone}-{p.aisle}-{p.shelf}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-[#e8ecf4]">{p.quantity_on_hand}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-[#f59e0b]">{p.quantity_allocated}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-[#00d4aa]">{available}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-[#8892a8]">{formatCurrency(p.unit_price)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={status === 'out' ? 'danger' : status === 'critical' ? 'danger' : status === 'low' ? 'warning' : 'success'} dot>
                        {status === 'out' ? 'Out' : status === 'critical' ? 'Critical' : status === 'low' ? 'Low' : 'OK'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setRestockTarget(p); setRestockQty(p.reorder_qty); }}
                          className="btn btn-ghost !p-1.5"
                          title="Restock"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => { setDamageTarget(p); setDamageQty(1); }}
                          className="btn btn-ghost !p-1.5"
                          title="Report damage"
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Restock Modal */}
      <Modal open={!!restockTarget} onClose={() => setRestockTarget(null)} title="Restock Product">
        {restockTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-sm font-medium text-[#e8ecf4]">{restockTarget.name}</div>
              <div className="text-xs text-[#8892a8] mt-1">
                Current: {restockTarget.quantity_on_hand} on hand • Reorder point: {restockTarget.reorder_point}
              </div>
            </div>
            <div>
              <label className="text-sm text-[#8892a8] mb-1.5 block">Quantity to add</label>
              <input
                type="number"
                className="input"
                value={restockQty}
                onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRestockTarget(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleRestock} disabled={actionLoading} className="btn btn-primary">
                {actionLoading ? 'Processing...' : 'Confirm Restock'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Damage Modal */}
      <Modal open={!!damageTarget} onClose={() => setDamageTarget(null)} title="Report Damaged Stock">
        {damageTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg border-l-4" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderLeftColor: 'var(--danger)' }}>
              <div className="text-sm font-medium text-[#e8ecf4]">{damageTarget.name}</div>
              <div className="text-xs text-[#f0a0a0] mt-1">
                Damaged units will be removed from inventory and an exception will be logged.
              </div>
            </div>
            <div>
              <label className="text-sm text-[#8892a8] mb-1.5 block">Damaged quantity</label>
              <input
                type="number"
                className="input"
                value={damageQty}
                onChange={(e) => setDamageQty(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={damageTarget.quantity_on_hand}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDamageTarget(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleDamage} disabled={actionLoading} className="btn btn-danger">
                {actionLoading ? 'Processing...' : 'Report Damage'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
