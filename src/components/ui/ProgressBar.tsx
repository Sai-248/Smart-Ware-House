interface ProgressBarProps {
  value: number;
  color?: string;
}

export function ProgressBar({ value, color = 'var(--accent)' }: ProgressBarProps) {
  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}
