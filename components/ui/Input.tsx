import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helper, error, icon, className, id, ...props }, ref) => {
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
          {icon && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-dim)' }}
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors outline-none',
              'placeholder:text-[var(--color-text-dim)]',
              'focus:border-[var(--color-purple)] focus:ring-1 focus:ring-[var(--color-purple)]',
              icon ? 'pl-10' : '',
              error ? 'border-[var(--color-red)]' : 'border-[var(--color-border)]',
              className
            )}
            style={{
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-text)',
            }}
            {...props}
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

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helper, error, className, id, ...props }, ref) => {
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
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors outline-none resize-none',
            'placeholder:text-[var(--color-text-dim)]',
            'focus:border-[var(--color-purple)] focus:ring-1 focus:ring-[var(--color-purple)]',
            error ? 'border-[var(--color-red)]' : 'border-[var(--color-border)]',
            className
          )}
          style={{
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text)',
          }}
          rows={4}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
