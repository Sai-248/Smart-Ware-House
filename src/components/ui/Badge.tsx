import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';
  dot?: boolean;
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[#1a2235] text-[#8892a8] border border-[#1e2a42]',
  success: 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20',
  warning: 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20',
  danger: 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20',
  info: 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20',
  accent: 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20',
  neutral: 'bg-[#2a3a5c]/20 text-[#8892a8] border border-[#2a3a5c]/30',
};

export function Badge({ children, variant = 'default', dot = false }: BadgeProps) {
  return (
    <span className={`badge ${variantStyles[variant]}`}>
      {dot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
}
