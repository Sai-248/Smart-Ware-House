import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  accentColor?: string;
  sublabel?: string;
}

export function StatCard({ label, value, icon: Icon, trend, accentColor = 'var(--accent)', sublabel }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm text-[#8892a8] font-medium">{label}</div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
        >
          <Icon size={18} />
        </div>
      </div>
      <div className="text-3xl font-bold text-[#e8ecf4] font-mono tracking-tight">{value}</div>
      {(trend || sublabel) && (
        <div className="mt-2 text-xs text-[#5a6478]">
          {trend && <span style={{ color: accentColor }}>{trend}</span>}
          {sublabel && <span className={trend ? ' ml-1' : ''}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>{children}</div>;
}
