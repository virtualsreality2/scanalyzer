import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-interactive-primary text-white hover:bg-interactive-primaryHover active:bg-interactive-primaryActive focus-visible:ring-interactive-primary',
        secondary:
          'bg-interactive-secondary text-text-primary hover:bg-interactive-secondaryHover active:bg-interactive-secondaryActive focus-visible:ring-border-focus',
        danger:
          'bg-semantic-error text-white hover:bg-semantic-errorLight active:bg-semantic-error focus-visible:ring-semantic-error',
        ghost:
          'bg-transparent hover:bg-surface-secondary active:bg-surface-tertiary focus-visible:ring-border-focus',
        link:
          'bg-transparent underline-offset-4 hover:underline text-text-link hover:text-text-linkHover focus-visible:ring-border-focus',
      },
      size: {
        sm: 'h-8 px-3 text-sm gap-1.5',
        md: 'h-10 px-4 text-base gap-2',
        lg: 'h-12 px-5 text-lg gap-2.5',
        icon: 'h-10 w-10',
      },
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        full: 'rounded-full',
      },
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      rounded: 'md',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Icon to display before the button text */
  leftIcon?: React.ReactNode;
  /** Icon to display after the button text */
  rightIcon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Button component with multiple variants and states
 * 
 * @example
 * <Button variant="primary" size="md">
 *   Click me
 * </Button>
 * 
 * @example
 * <Button variant="secondary" leftIcon={<Icon />} loading>
 *   Processing...
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      fullWidth,
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={clsx(
          buttonVariants({ variant, size, rounded, fullWidth }),
          className
        )}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <Loader2
            className={clsx(
              'animate-spin',
              size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
            )}
            aria-hidden="true"
          />
        )}
        {!loading && leftIcon && (
          <span className="inline-flex" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && (
          <span className="inline-flex" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Export button variants for use in other components
export { buttonVariants };