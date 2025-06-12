import React, { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  'rounded-lg bg-white dark:bg-gray-800 transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-white dark:bg-gray-800',
        elevated: 'shadow-lg hover:shadow-xl',
        bordered: 'border border-gray-200 dark:border-gray-700'
      },
      interactive: {
        true: 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
      }
    },
    defaultVariants: {
      variant: 'default',
      interactive: false
    }
  }
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, header, footer, children, onClick, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick?.(e as any);
      }
      onKeyDown?.(e);
    };

    return (
      <div
        ref={ref}
        className={clsx(cardVariants({ variant, interactive }), className)}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'button' : undefined}
        {...props}
      >
        {header && (
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            {header}
          </div>
        )}
        <div className="p-6">{children}</div>
        {footer && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';