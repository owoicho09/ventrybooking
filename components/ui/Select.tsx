import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helper, error, options, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium"
            style={{ color: 'var(--color-text)' }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              'w-full appearance-none rounded-lg border px-3 py-2.5 text-sm transition-colors outline-none pr-9',
              'focus:border-[var(--color-purple)] focus:ring-1 focus:ring-[var(--color-purple)]',
              error ? 'border-[var(--color-red)]' : 'border-[var(--color-border)]',
              className
            )}
            style={{
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-text)',
            }}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-dim)' }}
          />
        </div>
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-red)' }}>
            {error}
          </p>
        )}
        {helper && !error && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
