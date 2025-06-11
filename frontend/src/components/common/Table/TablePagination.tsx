import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../Button';
import clsx from 'clsx';

export interface TablePaginationProps {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showPageNumbers?: boolean;
  showTotalCount?: boolean;
  className?: string;
}

export function TablePagination({
  pageIndex,
  pageSize,
  pageCount,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
  showPageSizeSelector = true,
  showPageNumbers = true,
  showTotalCount = true,
  className,
}: TablePaginationProps) {
  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;
  
  // Calculate the range of items being displayed
  const startItem = pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, total);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 7;
    const halfRange = Math.floor(maxPagesToShow / 2);

    if (pageCount <= maxPagesToShow) {
      // Show all pages if there are few enough
      for (let i = 0; i < pageCount; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);

      if (pageIndex <= halfRange) {
        // Near the beginning
        for (let i = 1; i < maxPagesToShow - 2; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(pageCount - 1);
      } else if (pageIndex >= pageCount - halfRange - 1) {
        // Near the end
        pages.push('...');
        for (let i = pageCount - maxPagesToShow + 2; i < pageCount; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push('...');
        for (let i = pageIndex - halfRange + 1; i <= pageIndex + halfRange - 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(pageCount - 1);
      }
    }

    return pages;
  };

  return (
    <div className={clsx('flex items-center justify-between px-4 py-3 border-t border-border-primary bg-surface-primary', className)}>
      <div className="flex items-center gap-6">
        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-text-secondary">
              Rows per page:
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded border border-border-primary bg-surface-primary px-2 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-opacity-25"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {showTotalCount && (
          <div className="text-sm text-text-secondary">
            {total === 0 ? (
              'No results'
            ) : (
              <>
                Showing {startItem} to {endItem} of {total} results
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(0)}
            disabled={!canPreviousPage}
            aria-label="Go to first page"
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={!canPreviousPage}
            aria-label="Go to previous page"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {showPageNumbers && (
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => {
                if (page === '...') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-text-tertiary">
                      ...
                    </span>
                  );
                }

                const pageNumber = page as number;
                const isActive = pageNumber === pageIndex;

                return (
                  <Button
                    key={pageNumber}
                    variant={isActive ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => onPageChange(pageNumber)}
                    aria-label={`Go to page ${pageNumber + 1}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={clsx(
                      'min-w-[2rem]',
                      !isActive && 'hover:bg-surface-secondary'
                    )}
                  >
                    {pageNumber + 1}
                  </Button>
                );
              })}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canNextPage}
            aria-label="Go to next page"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(pageCount - 1)}
            disabled={!canNextPage}
            aria-label="Go to last page"
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </nav>

        {!showPageNumbers && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>
              Page {pageIndex + 1} of {pageCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}