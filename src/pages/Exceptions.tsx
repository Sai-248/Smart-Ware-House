import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, Package, Search, Check, Clock, AlertCircle,
  Wrench, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { fetchExceptions, resolveException } from '@/lib/dataApi';
import {
  formatExceptionType, formatExceptionStatus, formatOrderStatus, timeAgo,
} from '@/lib/format';
import type { Exception } from '@/lib/types';

export function Exceptions() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resolveTarget, setResolveTarget] = useState<Exception | null>(null);
  const [resolution, setResolution] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const e = await fetchExceptions();
      setExceptions(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exceptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async () => {
    if (!resolveTarget || !resolution.trim()) return;
    setActionLoading(true);
    try {
      await resolveException(resolveTarget.id, resolution);
      await load();
      setResolveTarget(null);
      setResolution('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading exceptions..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  let filtered = exceptions;
  if (search) {
    filtered = filtered.filter((e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      e.order?.order_number.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (statusFilter !== 'all') filtered = filtered.filter((e) => e.status === statusFilter);

  const openCount = exceptions.filter((e) => e.status === 'open').length;
  const resolvedCount = exceptions.filter((e) => e.status === 'resolved').length;
  const damagedCount = exceptions.filter((e) => e.type === 'damaged').length;
  const shortCount = exceptions.filter((e) => e.type === 'short_stock').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#e8ecf4] mb-1">Exception Management</h1>
        <p className="text-sm text-[#8892a8]">Handle damaged, missing, and short-stock incidents with resolution tracking</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Exceptions" value={openCount} icon={AlertCircle} accentColor="#ef4444" />
        <StatCard label="Resolved" value={resolvedCount} icon={Check} accentColor="#22c55e" />
        <StatCard label="Damaged Items" value={damagedCount} icon={Package} accentColor="#f59e0b" />
        <StatCard label="Short Stock" value={shortCount} icon={AlertTriangle} accentColor="#3b82f6" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a6478]" />
          <input className="input pl-9" placeholder="Search exceptions..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={24} />} title="No exceptions found" description="Everything is running smoothly." />
      ) : (
        <div className="space-y-3">
          {filtered.map((ex) => {
            const typeInfo = formatExceptionType(ex.type);
            const statusInfo = formatExceptionStatus(ex.status);
            return (
              <div key={ex.id} className="card p-5" style={{ borderLeft: `4px solid ${typeInfo.color}` }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${typeInfo.color}15`, color: typeInfo.color }}>
                    {ex.type === 'damaged' ? <Package size={18} /> : ex.type === 'short_stock' ? <AlertTriangle size={18} /> : <AlertCircle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={ex.type === 'damaged' ? 'danger' : ex.type === 'short_stock' ? 'warning' : 'info'}>
                        {typeInfo.label}
                      </Badge>
                      <Badge variant={statusInfo.variant} dot>{statusInfo.label}</Badge>
                      {ex.order && (
                        <span className="text-xs text-[#5a6478] font-mono">{ex.order.order_number}</span>
                      )}
                      <span className="text-xs text-[#5a6478]">{timeAgo(ex.created_at)}</span>
                    </div>
                    <p className="text-sm text-[#e8ecf4]">{ex.description}</p>
                    {ex.product && (
                      <div className="text-xs text-[#8892a8] mt-1">
                        Product: {ex.product.name} ({ex.product.sku})
                      </div>
                    )}
                    {ex.resolution && (
                      <div className="mt-3 p-2.5 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'rgba(34,197,94,0.08)' }}>
                        <Check size={14} className="text-[#22c55e] flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-[#22c55e]">Resolved</div>
                          <div className="text-xs text-[#8892a8] mt-0.5">{ex.resolution}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  {ex.status === 'open' && (
                    <button
                      onClick={() => { setResolveTarget(ex); setResolution(''); }}
                      className="btn btn-primary flex-shrink-0"
                    >
                      <Wrench size={14} /> Resolve
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Modal */}
      <Modal open={!!resolveTarget} onClose={() => setResolveTarget(null)} title="Resolve Exception">
        {resolveTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-sm font-medium text-[#e8ecf4]">{formatExceptionType(resolveTarget.type).label}</div>
              <div className="text-xs text-[#8892a8] mt-1">{resolveTarget.description}</div>
            </div>
            <div>
              <label className="text-sm text-[#8892a8] mb-1.5 block">Resolution details</label>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Describe the action taken to resolve this exception..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setResolveTarget(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleResolve} disabled={!resolution.trim() || actionLoading} className="btn btn-primary">
                {actionLoading ? 'Resolving...' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
