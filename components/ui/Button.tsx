import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth, className, style, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-purple)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]';

    const sizes = {
      sm: 'px-3 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3.5 text-base gap-2',
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--color-purple)',
        color: '#fff',
      },
      outline: {
        backgroundColor: 'transparent',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--color-text-muted)',
      },
      danger: {
        backgroundColor: 'var(--color-red)',
        color: '#fff',
      },
      success: {
        backgroundColor: 'var(--color-green)',
        color: '#fff',
      },
    };

    return (
      <button
        ref={ref}
        className={cn(base, sizes[size], fullWidth ? 'w-full' : '', className)}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
