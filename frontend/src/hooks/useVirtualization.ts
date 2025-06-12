/**
 * useVirtualization - High-performance virtual scrolling hook
 * Handles large lists with dynamic heights and smooth scrolling
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface VirtualizationOptions<T> {
  items: T[];
  containerHeight: number;
  estimatedItemHeight?: number;
  getItemHeight?: (index: number) => number;
  overscan?: number;
  scrollingDelay?: number;
  smoothScrolling?: boolean;
}

interface VirtualItem {
  index: number;
  start: number;
  size: number;
  end: number;
}

interface ScrollToOptions {
  behavior?: 'auto' | 'smooth';
  offset?: number;
  align?: 'start' | 'center' | 'end';
}

export function useVirtualization<T>({
  items,
  containerHeight,
  estimatedItemHeight = 50,
  getItemHeight,
  overscan = 3,
  scrollingDelay = 100,
  smoothScrolling = true
}: VirtualizationOptions<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const measuredHeightsRef = useRef<Map<number, number>>(new Map());
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const targetScrollTopRef = useRef<number | null>(null);

  // Calculate item positions
  const itemPositions = useMemo(() => {
    const positions: Array<{ start: number; size: number }> = [];
    let offset = 0;

    for (let i = 0; i < items.length; i++) {
      const measuredHeight = measuredHeightsRef.current.get(i);
      const height = measuredHeight ?? (getItemHeight?.(i) ?? estimatedItemHeight);
      
      positions.push({
        start: offset,
        size: height
      });
      
      offset += height;
    }

    return positions;
  }, [items.length, estimatedItemHeight, getItemHeight]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    if (itemPositions.length === 0) return 0;
    const lastItem = itemPositions[itemPositions.length - 1];
    return lastItem.start + lastItem.size;
  }, [itemPositions]);

  // Calculate visible range
  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    const rangeStart = scrollTop;
    const rangeEnd = scrollTop + containerHeight;

    let startIndex = 0;
    let endIndex = items.length - 1;

    // Binary search for start index
    let low = 0;
    let high = items.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midStart = itemPositions[mid].start;
      const midEnd = midStart + itemPositions[mid].size;

      if (midEnd < rangeStart) {
        low = mid + 1;
      } else if (midStart > rangeStart) {
        high = mid - 1;
      } else {
        startIndex = mid;
        break;
      }
    }

    // Linear search for end index from start
    for (let i = startIndex; i < items.length; i++) {
      const itemStart = itemPositions[i].start;
      if (itemStart > rangeEnd) {
        endIndex = i - 1;
        break;
      }
    }

    // Apply overscan
    startIndex = Math.max(0, startIndex - overscan);
    endIndex = Math.min(items.length - 1, endIndex + overscan);

    // Create virtual items
    const virtualItems: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const position = itemPositions[i];
      virtualItems.push({
        index: i,
        start: position.start,
        size: position.size,
        end: position.start + position.size
      });
    }

    return { startIndex, endIndex, virtualItems };
  }, [scrollTop, containerHeight, items.length, itemPositions, overscan]);

  // Measure item height
  const measureItem = useCallback((index: number, height: number) => {
    const currentHeight = measuredHeightsRef.current.get(index);
    if (currentHeight !== height) {
      measuredHeightsRef.current.set(index, height);
      // Force recalculation on next render
      setScrollTop(prev => prev);
    }
  }, []);

  // Handle scroll
  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    const newScrollTop = target.scrollTop;
    
    setScrollTop(newScrollTop);
    setIsScrolling(true);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set scrolling to false after delay
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, scrollingDelay);
  }, [scrollingDelay]);

  // Smooth scroll animation
  const animateScroll = useCallback((targetScrollTop: number) => {
    if (!scrollElementRef.current || !smoothScrolling) {
      scrollElementRef.current?.scrollTo(0, targetScrollTop);
      return;
    }

    const startScrollTop = scrollElementRef.current.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    const duration = 300; // ms
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentScrollTop = startScrollTop + distance * easeProgress;
      
      if (scrollElementRef.current) {
        scrollElementRef.current.scrollTop = currentScrollTop;
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        targetScrollTopRef.current = null;
      }
    };

    // Cancel previous animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(step);
  }, [smoothScrolling]);

  // Scroll to index
  const scrollToIndex = useCallback((
    index: number,
    options: ScrollToOptions = {}
  ) => {
    const { behavior = 'auto', offset = 0, align = 'start' } = options;
    
    if (index < 0 || index >= items.length) return;

    const itemPosition = itemPositions[index];
    if (!itemPosition) return;

    let targetScrollTop = itemPosition.start + offset;

    if (align === 'center') {
      targetScrollTop = itemPosition.start - containerHeight / 2 + itemPosition.size / 2;
    } else if (align === 'end') {
      targetScrollTop = itemPosition.start - containerHeight + itemPosition.size;
    }

    targetScrollTop = Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight));
    targetScrollTopRef.current = targetScrollTop;

    if (behavior === 'smooth' && smoothScrolling) {
      animateScroll(targetScrollTop);
    } else if (scrollElementRef.current) {
      scrollElementRef.current.scrollTop = targetScrollTop;
    }
  }, [items.length, itemPositions, containerHeight, totalHeight, smoothScrolling, animateScroll]);

  // Scroll to offset
  const scrollToOffset = useCallback((offset: number, smooth = false) => {
    const targetScrollTop = Math.max(0, Math.min(offset, totalHeight - containerHeight));
    
    if (smooth && smoothScrolling) {
      animateScroll(targetScrollTop);
    } else if (scrollElementRef.current) {
      scrollElementRef.current.scrollTop = targetScrollTop;
    }
  }, [totalHeight, containerHeight, smoothScrolling, animateScroll]);

  // Get scroll progress
  const scrollProgress = useMemo(() => {
    if (totalHeight <= containerHeight) return 0;
    return scrollTop / (totalHeight - containerHeight);
  }, [scrollTop, totalHeight, containerHeight]);

  // Set scroll element
  const setScrollElement = useCallback((element: HTMLElement | null) => {
    // Remove old listener
    if (scrollElementRef.current) {
      scrollElementRef.current.removeEventListener('scroll', handleScroll);
    }

    scrollElementRef.current = element;

    // Add new listener
    if (element) {
      element.addEventListener('scroll', handleScroll, { passive: true });
      setScrollTop(element.scrollTop);
    }
  }, [handleScroll]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (scrollElementRef.current) {
        scrollElementRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  // Recalculate positions when items change
  const recalculatePositions = useCallback(() => {
    setScrollTop(prev => prev); // Force recalculation
  }, []);

  return {
    // Visible items
    virtualItems,
    startIndex,
    endIndex,
    
    // Scroll state
    scrollTop,
    scrollProgress,
    isScrolling,
    totalHeight,
    
    // Measurements
    measureItem,
    itemHeights: measuredHeightsRef.current,
    
    // Scroll actions
    scrollToIndex,
    scrollToOffset,
    setScrollElement,
    recalculatePositions,
    
    // Target scroll position (for animations)
    targetScrollTop: targetScrollTopRef.current,
    
    // Container props
    containerProps: {
      style: {
        height: containerHeight,
        overflow: 'auto' as const,
        position: 'relative' as const
      }
    },
    
    // Inner container props
    innerProps: {
      style: {
        height: totalHeight,
        width: '100%',
        position: 'relative' as const
      }
    }
  };
}