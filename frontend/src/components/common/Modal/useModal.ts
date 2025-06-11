import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseModalOptions {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  preventScroll?: boolean;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
}

export interface UseModalReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  modalRef: React.RefObject<HTMLDivElement>;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

export function useModal({
  defaultOpen = false,
  onOpenChange,
  preventScroll = true,
  closeOnEscape = true,
  closeOnOutsideClick = true,
}: UseModalOptions = {}): UseModalReturn {
  const [isOpen, setIsOpenState] = useState(defaultOpen);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const setOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    onOpenChange?.(open);
  }, [onOpenChange]);

  const open = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    setOpen(true);
  }, [setOpen]);

  const close = useCallback(() => {
    setOpen(false);
    // Restore focus to the trigger element
    if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [setOpen]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close, closeOnEscape]);

  // Handle outside clicks
  useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (modalRef.current && !modalRef.current.contains(target)) {
        close();
      }
    };

    // Use capture phase to catch clicks before they bubble
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen, close, closeOnOutsideClick]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!preventScroll) return;

    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const previousOverflow = document.body.style.overflow;
      const previousPaddingRight = document.body.style.paddingRight;

      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      return () => {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPaddingRight;
      };
    }
  }, [isOpen, preventScroll]);

  // Focus management
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus the first focusable element
    const timer = setTimeout(() => {
      firstElement?.focus();
    }, 0);

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modalRef.current.addEventListener('keydown', handleTabKey);
    
    return () => {
      clearTimeout(timer);
      modalRef.current?.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen]);

  return {
    isOpen,
    open,
    close,
    toggle,
    setOpen,
    modalRef,
    triggerRef,
  };
}