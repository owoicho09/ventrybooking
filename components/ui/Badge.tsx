import { cn } from '@/lib/utils';

type BadgeVariant = 'green' | 'amber' | 'red' | 'purple' | 'gray' | 'blue';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  green: {
    backgroundColor: '#10b98120',
    color: 'var(--color-green)',
    border: '1px solid #10b98130',
  },
  amber: {
    backgroundColor: '#f59e0b20',
    color: 'var(--color-amber)',
    border: '1px solid #f59e0b30',
  },
  red: {
    backgroundColor: '#ef444420',
    color: 'var(--color-red)',
    border: '1px solid #ef444430',
  },
  purple: {
    backgroundColor: 'var(--color-purple-dim)',
    color: 'var(--color-purple-light)',
    border: '1px solid #7c3aed30',
  },
  gray: {
    backgroundColor: 'var(--color-surface-2)',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
  },
  blue: {
    backgroundColor: '#3b82f620',
    color: '#60a5fa',
    border: '1px solid #3b82f630',
  },
};

export function Badge({ variant = 'gray', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide',
        className
      )}
      style={variantStyles[variant]}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
}
