import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  accent?: boolean;
}

export function StatsCard({ label, value, icon: Icon, trend, accent }: StatsCardProps) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3"
      style={{
        backgroundColor: accent ? 'var(--color-purple-dim)' : 'var(--color-surface)',
        borderColor: accent ? '#7c3aed40' : 'var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: accent ? '#7c3aed30' : 'var(--color-surface-2)',
            color: accent ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
          }}
        >
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p
          className="text-2xl font-bold"
          style={{
            color: accent ? 'var(--color-purple-light)' : 'var(--color-text)',
            fontFamily: 'var(--font-syne), sans-serif',
          }}
        >
          {value}
        </p>
        {trend && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
