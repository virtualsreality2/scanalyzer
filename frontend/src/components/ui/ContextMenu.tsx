import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  action?: () => void;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  className?: string;
}

export function ContextMenu({ items, position, onClose, className }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust horizontal position
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled || item.separator) return;
    
    if (item.submenu) {
      setActiveSubmenu(activeSubmenu === item.id ? null : item.id);
    } else {
      item.action?.();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: ContextMenuItem, index: number) => {
    const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
    if (!items) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = Math.min(index + 1, items.length - 1);
        (items[nextIndex] as HTMLElement).focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        (items[prevIndex] as HTMLElement).focus();
        break;
      case 'ArrowRight':
        if (item.submenu) {
          e.preventDefault();
          setActiveSubmenu(item.id);
        }
        break;
      case 'ArrowLeft':
        if (activeSubmenu) {
          e.preventDefault();
          setActiveSubmenu(null);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleItemClick(item);
        break;
    }
  };

  const renderMenuItem = (item: ContextMenuItem, index: number) => {
    if (item.separator) {
      return (
        <div
          key={item.id}
          className="h-px bg-gray-200 dark:bg-gray-700 my-1"
          role="separator"
        />
      );
    }

    return (
      <div
        key={item.id}
        className={clsx(
          'relative px-3 py-2 text-sm rounded cursor-pointer',
          'flex items-center justify-between gap-8',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none',
          item.disabled && 'opacity-50 cursor-not-allowed'
        )}
        role="menuitem"
        tabIndex={item.disabled ? -1 : 0}
        onClick={() => handleItemClick(item)}
        onKeyDown={(e) => handleKeyDown(e, item, index)}
        aria-disabled={item.disabled}
      >
        <div className="flex items-center gap-2">
          {item.icon && <span className="w-4 h-4">{item.icon}</span>}
          <span>{item.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {item.shortcut && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {item.shortcut}
            </span>
          )}
          {item.submenu && <ChevronRight size={14} />}
        </div>
        {item.submenu && activeSubmenu === item.id && (
          <div className="absolute left-full top-0 ml-1">
            <ContextMenu
              items={item.submenu}
              position={{ x: 0, y: 0 }}
              onClose={onClose}
            />
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div
      ref={menuRef}
      className={clsx(
        'fixed z-50 min-w-[200px] py-1',
        'bg-white dark:bg-gray-800',
        'border border-gray-200 dark:border-gray-700',
        'rounded-lg shadow-lg',
        className
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y
      }}
      role="menu"
    >
      {items.map((item, index) => renderMenuItem(item, index))}
    </div>,
    document.body
  );
}