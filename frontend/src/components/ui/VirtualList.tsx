import React, { useRef, useEffect, ReactNode } from 'react';
import { useVirtualization } from '../../hooks/useVirtualization';
import { clsx } from 'clsx';

export interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight?: number;
  estimatedItemHeight?: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  emptyState?: ReactNode;
  loadingState?: ReactNode;
  isLoading?: boolean;
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  estimatedItemHeight = 50,
  renderItem,
  overscan = 5,
  className,
  onScroll,
  emptyState,
  loadingState,
  isLoading = false
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const {
    virtualItems,
    totalHeight,
    scrollTop,
    setScrollTop,
    updateItemHeight
  } = useVirtualization({
    items,
    containerHeight: height,
    itemHeight: itemHeight || estimatedItemHeight,
    overscan
  });

  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const newScrollTop = scrollElement.scrollTop;
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop);
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [setScrollTop, onScroll]);

  // Measure dynamic heights
  useEffect(() => {
    if (itemHeight || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        const index = parseInt(element.dataset.index || '0');
        const height = entry.contentRect.height;
        
        if (height > 0) {
          updateItemHeight(index, height);
        }
      }
    });

    const elements = containerRef.current.querySelectorAll('[data-index]');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [virtualItems, itemHeight, updateItemHeight]);

  if (isLoading && loadingState) {
    return (
      <div className={clsx('flex items-center justify-center', className)} style={{ height }}>
        {loadingState}
      </div>
    );
  }

  if (items.length === 0 && emptyState) {
    return (
      <div className={clsx('flex items-center justify-center', className)} style={{ height }}>
        {emptyState}
      </div>
    );
  }

  return (
    <div
      ref={scrollElementRef}
      className={clsx('overflow-auto relative', className)}
      style={{ height }}
      role="list"
    >
      <div
        style={{
          height: totalHeight,
          width: '100%',
          position: 'relative'
        }}
      >
        <div ref={containerRef}>
          {virtualItems.map(({ index, start, height: itemH }) => {
            const item = items[index];
            return (
              <div
                key={index}
                data-index={index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${start}px)`,
                  height: itemHeight ? itemH : undefined
                }}
                role="listitem"
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}