import { cn } from '@/lib/utils';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="w-full max-w-full overflow-x-auto">
      <table className={cn('w-full min-w-max text-sm', className)}>{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead
      className="border-b"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {children}
    </thead>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn('whitespace-nowrap px-3 sm:px-4 py-3 text-left font-medium text-xs tracking-wide uppercase', className)}
      style={{ color: 'var(--color-text-muted)' }}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr
      className={cn('border-b last:border-0 transition-colors', className)}
      style={{ borderColor: 'var(--color-border)' }}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn('whitespace-nowrap px-3 sm:px-4 py-3.5', className)} style={{ color: 'var(--color-text)' }}>
      {children}
    </td>
  );
}
