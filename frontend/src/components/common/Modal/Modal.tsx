import React, { forwardRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../Button';
import clsx from 'clsx';
import { useModal } from './useModal';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  
  // Customization
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  title?: string;
  description?: string;
  
  // Behavior
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  preventScroll?: boolean;
  showCloseButton?: boolean;
  
  // Styling
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  
  // Accessibility
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      children,
      size = 'md',
      title,
      description,
      closeOnEscape = true,
      closeOnOutsideClick = true,
      preventScroll = true,
      showCloseButton = true,
      className,
      overlayClassName,
      contentClassName,
      ariaLabel,
      ariaDescribedBy,
    },
    ref
  ) => {
    const { modalRef } = useModal({
      defaultOpen: isOpen,
      onOpenChange: (open) => !open && onClose(),
      preventScroll,
      closeOnEscape,
      closeOnOutsideClick,
    });

    // Merge refs
    React.useImperativeHandle(ref, () => modalRef.current!, [modalRef]);

    if (!isOpen) return null;

    const modalContent = (
      <>
        {/* Overlay */}
        <div
          className={clsx(
            'fixed inset-0 z-50 bg-background-overlay backdrop-blur-sm transition-opacity',
            'animate-in fade-in duration-200',
            overlayClassName
          )}
          aria-hidden="true"
        />

        {/* Modal Container */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || title}
            aria-describedby={ariaDescribedBy || (description ? 'modal-description' : undefined)}
            className={clsx(
              'relative w-full bg-surface-primary rounded-lg shadow-xl',
              'animate-in fade-in zoom-in-95 duration-200',
              sizeClasses[size],
              'max-h-[90vh] flex flex-col',
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between p-6 pb-4">
                <div className="flex-1">
                  {title && (
                    <h2 className="text-xl font-semibold text-text-primary">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id="modal-description" className="mt-1 text-sm text-text-secondary">
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="ml-4 -mr-2 -mt-2"
                    aria-label="Close modal"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Content */}
            <div className={clsx('flex-1 overflow-y-auto', contentClassName)}>
              {children}
            </div>
          </div>
        </div>
      </>
    );

    // Create portal for modal
    if (typeof document !== 'undefined') {
      return createPortal(modalContent, document.body);
    }

    return null;
  }
);

Modal.displayName = 'Modal';

// Modal sub-components
export const ModalHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={clsx('px-6 pt-6 pb-4', className)}>
    {children}
  </div>
);

ModalHeader.displayName = 'ModalHeader';

export const ModalBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={clsx('px-6 py-4', className)}>
    {children}
  </div>
);

ModalBody.displayName = 'ModalBody';

export const ModalFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={clsx('flex items-center justify-end gap-3 px-6 py-4 border-t border-border-primary', className)}>
    {children}
  </div>
);

ModalFooter.displayName = 'ModalFooter';

// Compound component pattern alternative
export const ModalCompound = Object.assign(Modal, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
});