import type { OrderPriority, OrderStatus, PickTaskStatus, ExceptionType, ExceptionStatus } from '@/lib/types';

export function formatPriority(priority: OrderPriority): { label: string; color: string } {
  switch (priority) {
    case 'urgent': return { label: 'Urgent', color: '#ef4444' };
    case 'high': return { label: 'High', color: '#f59e0b' };
    case 'standard': return { label: 'Standard', color: '#3b82f6' };
    case 'low': return { label: 'Low', color: '#8892a8' };
  }
}

export function formatOrderStatus(status: OrderStatus): { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent' } {
  switch (status) {
    case 'created': return { label: 'Created', variant: 'default' };
    case 'pending_allocation': return { label: 'Pending Allocation', variant: 'info' };
    case 'allocated': return { label: 'Allocated', variant: 'accent' };
    case 'picking': return { label: 'Picking', variant: 'warning' };
    case 'packing': return { label: 'Packing', variant: 'warning' };
    case 'quality_check': return { label: 'Quality Check', variant: 'info' };
    case 'dispatched': return { label: 'Dispatched', variant: 'success' };
    case 'cancelled': return { label: 'Cancelled', variant: 'danger' };
    case 'on_hold': return { label: 'On Hold', variant: 'danger' };
  }
}

export function formatPickStatus(status: PickTaskStatus): { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' } {
  switch (status) {
    case 'pending': return { label: 'Pending', variant: 'default' };
    case 'in_progress': return { label: 'In Progress', variant: 'warning' };
    case 'picked': return { label: 'Picked', variant: 'success' };
    case 'short': return { label: 'Short', variant: 'danger' };
  }
}

export function formatExceptionType(type: ExceptionType): { label: string; color: string } {
  switch (type) {
    case 'damaged': return { label: 'Damaged', color: '#ef4444' };
    case 'missing': return { label: 'Missing', color: '#f59e0b' };
    case 'short_stock': return { label: 'Short Stock', color: '#f59e0b' };
    case 'misplaced': return { label: 'Misplaced', color: '#3b82f6' };
    case 'quality': return { label: 'Quality', color: '#a855f7' };
  }
}

export function formatExceptionStatus(status: ExceptionStatus): { label: string; variant: 'default' | 'warning' | 'success' } {
  switch (status) {
    case 'open': return { label: 'Open', variant: 'warning' };
    case 'investigating': return { label: 'Investigating', variant: 'default' };
    case 'resolved': return { label: 'Resolved', variant: 'success' };
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
