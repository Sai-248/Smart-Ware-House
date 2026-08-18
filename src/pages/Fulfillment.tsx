import { useEffect, useState, useCallback } from 'react';
import {
  Package, ClipboardCheck, Truck, Check, AlertTriangle,
  ArrowRight, User, RefreshCw, Box,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import {
  fetchPickTasks, fetchOrders, completePickTask, moveToStage,
} from '@/lib/dataApi';
import {
  formatPickStatus, formatOrderStatus, formatPriority, timeAgo,
} from '@/lib/format';
import type { PickTask, Order } from '@/lib/types';

export function Fulfillment() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PickTask[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'picking' | 'packing' | 'quality_check'>('picking');
  const [pickTarget, setPickTarget] = useState<PickTask | null>(null);
  const [pickedQty, setPickedQty] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, o] = await Promise.all([fetchPickTasks(), fetchOrders()]);
      setTasks(t);
      setOrders(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCompletePick = async () => {
    if (!pickTarget) return;
    setActionLoading(true);
    try {
      await completePickTask(pickTarget.id, pickedQty);
      await load();
      setPickTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete pick');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvance = async (orderId: string, stage: string) => {
    setActionLoading(true);
    try {
      await moveToStage(orderId, stage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading fulfillment..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const pickingOrders = orders.filter((o) => o.status === 'picking');
  const packingOrders = orders.filter((o) => o.status === 'packing');
  const qcOrders = orders.filter((o) => o.status === 'quality_check');
  const activeTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'pending');

  const tabConfig = [
    { key: 'picking' as const, label: 'Picking', icon: Package, count: pickingOrders.length, orders: pickingOrders },
    { key: 'packing' as const, label: 'Packing', icon: Box, count: packingOrders.length, orders: packingOrders },
    { key: 'quality_check' as const, label: 'Quality Check', icon: ClipboardCheck, count: qcOrders.length, orders: qcOrders },
  ];

  const currentTab = tabConfig.find((t) => t.key === activeTab)!;
  const nextStage = activeTab === 'picking' ? 'packing' : activeTab === 'packing' ? 'quality_check' : 'dispatched';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e8ecf4] mb-1">Fulfillment Operations</h1>
          <p className="text-sm text-[#8892a8]">Manage picking, packing, and quality check workflows</p>
        </div>
        <button onClick={load} className="btn btn-secondary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Pick Tasks" value={activeTasks.length} icon={Package} accentColor="#f59e0b" />
        <StatCard label="In Picking" value={pickingOrders.length} icon={Package} accentColor="#3b82f6" />
        <StatCard label="In Packing" value={packingOrders.length} icon={Box} accentColor="#a855f7" />
        <StatCard label="Quality Check" value={qcOrders.length} icon={ClipboardCheck} accentColor="#22c55e" />
      </div>

      {/* Active pickers */}
      {activeTasks.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-[#f59e0b]" />
            <h2 className="text-base font-semibold text-[#e8ecf4]">Active Pick Assignments</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeTasks.map((task) => {
              const status = formatPickStatus(task.status);
              return (
                <div key={task.id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-[#e8ecf4]">{task.picker ?? 'Unassigned'}</div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="text-xs text-[#8892a8]">{task.product?.name}</div>
                  <div className="text-xs text-[#5a6478] mt-1 font-mono">
                    {task.order?.order_number} • Qty: {task.order_item?.allocated_qty ?? 0}
                  </div>
                  {task.status === 'in_progress' && (
                    <button
                      onClick={() => { setPickTarget(task); setPickedQty(task.order_item?.allocated_qty ?? 0); }}
                      className="btn btn-primary w-full mt-3 !py-1.5 !text-xs"
                    >
                      Complete Pick
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'text-[#00d4aa]' : 'text-[#8892a8] hover:text-[#e8ecf4]'}`}
              style={activeTab === tab.key ? { backgroundColor: 'var(--accent-glow)' } : {}}
            >
              <Icon size={16} /> {tab.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: activeTab === tab.key ? 'var(--accent)' : 'var(--bg-tertiary)', color: activeTab === tab.key ? '#001a14' : 'var(--text-muted)' }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders in current stage */}
      {currentTab.orders.length === 0 ? (
        <EmptyState
          icon={<currentTab.icon size={24} />}
          title={`No orders in ${currentTab.label.toLowerCase()}`}
          description="Orders will appear here when they reach this stage."
        />
      ) : (
        <div className="space-y-3">
          {currentTab.orders.map((order) => {
            const statusInfo = formatOrderStatus(order.status);
            const prio = formatPriority(order.priority);
            const orderTasks = tasks.filter((t) => t.order_id === order.id);
            const pickedTasks = orderTasks.filter((t) => t.status === 'picked').length;
            const totalTasks = orderTasks.length;
            return (
              <div key={order.id} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full" style={{ backgroundColor: prio.color }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#e8ecf4] font-mono">{order.order_number}</span>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        <Badge variant={order.priority === 'urgent' ? 'danger' : order.priority === 'high' ? 'warning' : 'info'}>{prio.label}</Badge>
                      </div>
                      <div className="text-xs text-[#8892a8] mt-0.5">{order.customer_name} • {timeAgo(order.created_at)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdvance(order.id, nextStage)}
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    {nextStage === 'dispatched' ? <><Truck size={14} /> Dispatch</> : <><ArrowRight size={14} /> Advance to {nextStage.replace('_', ' ')}</>}
                  </button>
                </div>

                {/* Pick tasks for this order */}
                {activeTab === 'picking' && orderTasks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {orderTasks.map((task) => {
                      const status = formatPickStatus(task.status);
                      return (
                        <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            {task.status === 'picked' ? <Check size={14} className="text-[#22c55e]" /> : task.status === 'short' ? <AlertTriangle size={14} className="text-[#ef4444]" /> : <Package size={14} className="text-[#8892a8]" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-[#e8ecf4]">{task.product?.name}</div>
                            <div className="text-xs text-[#5a6478]">{task.picker} • {task.product?.zone}-{task.product?.aisle}-{task.product?.shelf}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono text-[#8892a8]">{task.picked_qty}/{task.order_item?.allocated_qty ?? 0}</div>
                          </div>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {task.status === 'in_progress' && (
                            <button
                              onClick={() => { setPickTarget(task); setPickedQty(task.order_item?.allocated_qty ?? 0); }}
                              className="btn btn-secondary !py-1 !px-2.5 !text-xs"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {pickedTasks > 0 && pickedTasks < totalTasks && (
                      <div className="text-xs text-[#f59e0b] flex items-center gap-1 pl-2">
                        <AlertTriangle size={12} /> {totalTasks - pickedTasks} task(s) still pending
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'packing' && (
                  <div className="text-xs text-[#8892a8] mt-2 pl-2">
                    All items picked. Pack items securely and prepare for quality check.
                  </div>
                )}

                {activeTab === 'quality_check' && (
                  <div className="text-xs text-[#8892a8] mt-2 pl-2">
                    Verify package contents match order. Confirm all items are undamaged before dispatch.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pick completion modal */}
      <Modal open={!!pickTarget} onClose={() => setPickTarget(null)} title="Confirm Pick Quantity">
        {pickTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-sm font-medium text-[#e8ecf4]">{pickTarget.product?.name}</div>
              <div className="text-xs text-[#8892a8] mt-1">
                Allocated: {pickTarget.order_item?.allocated_qty} • Picker: {pickTarget.picker}
              </div>
            </div>
            <div>
              <label className="text-sm text-[#8892a8] mb-1.5 block">Picked quantity</label>
              <input
                type="number"
                className="input"
                value={pickedQty}
                onChange={(e) => setPickedQty(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                max={pickTarget.order_item?.allocated_qty ?? 0}
              />
              {pickedQty < (pickTarget.order_item?.allocated_qty ?? 0) && (
                <p className="text-xs text-[#f59e0b] mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> Short pick will create an exception for investigation.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPickTarget(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleCompletePick} disabled={actionLoading} className="btn btn-primary">
                {actionLoading ? 'Processing...' : 'Confirm Pick'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
