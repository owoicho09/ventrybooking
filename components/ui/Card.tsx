import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  elevated?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, style, elevated, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border',
        onClick ? 'cursor-pointer transition-colors' : '',
        className
      )}
      style={{
        backgroundColor: elevated ? 'var(--color-surface-2)' : 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('px-6 py-4 border-b', className)}
      style={{ borderColor: 'var(--color-border)' }}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('px-6 py-4 border-t', className)}
      style={{ borderColor: 'var(--color-border)' }}
    >
      {children}
    </div>
  );
}
