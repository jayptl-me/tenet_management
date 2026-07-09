'use client';

import { clsx } from 'clsx';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { staggerContainer } from '@/lib/animations';
import { Input } from './Input';
import { Button } from './Button';
import { ShimmerBlock } from '@/components/ui/Skeleton';

// ── Types ──────────────────────────────────────────────

export interface DataTableColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  sortable?: boolean;
}

export interface DataTablePagination {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  pagination?: DataTablePagination;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  animate?: boolean;
  /** When provided, on mobile (<768px) render each row as a card instead of a table */
  mobileCardRenderer?: (row: T) => React.ReactNode;
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// ── Skeleton Row ───────────────────────────────────────

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, j) => (
        <td
          key={j}
          className="border-b border-b-[color:var(--border-color)] px-4 py-3"
        >
          <ShimmerBlock className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// ── Component ──────────────────────────────────────────

// ── Mobile Card Skeleton ───────────────────────────────

function MobileCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-[var(--shadow-xs)]">
      <ShimmerBlock className="mb-2 h-4 w-3/4" />
      <ShimmerBlock className="h-3 w-1/2" />
    </div>
  );
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  pagination,
  emptyState,
  onRowClick,
  className,
  animate = true,
  mobileCardRenderer,
}: DataTableProps<T>) {
  const pages = pagination ? Math.ceil(pagination.total / pagination.perPage) : 0;

  const tableContent = (
    <>
      {/* Search */}
      {searchable && onSearchChange && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Mobile Card View (only when mobileCardRenderer is provided) */}
      {mobileCardRenderer && (
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <MobileCardSkeleton key={`mobile-skel-${i}`} />
            ))
          ) : data.length === 0 ? (
            <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-6 py-12 text-center shadow-[var(--shadow-sm)]">
              {emptyState ?? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[15px] font-semibold text-[color:var(--color-text-muted)]">
                    No data found
                  </p>
                  <p className="text-[13px] text-[color:var(--color-text-muted)]">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </div>
          ) : (
            data.map((row) => (
              <div
                key={keyExtractor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  'rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-[var(--shadow-xs)] transition-all duration-[var(--transition-duration)]',
                  onRowClick && 'cursor-pointer hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-sm)] active:scale-[var(--active-press-scale)]',
                )}
              >
                {mobileCardRenderer(row)}
              </div>
            ))
          )}
        </div>
      )}

      {/* Desktop Table (hidden on mobile when card view is active) */}
      <div className={clsx(
        'overflow-x-auto rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-sm)]',
        mobileCardRenderer && 'hidden md:block',
      )}>
        <table className="w-full border-collapse bg-[color:var(--color-card-bg)]">
          <thead>
            <tr className="bg-[color:var(--color-field-bg)]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={clsx(
                    'border-b border-b-[color:var(--border-color)] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={`skel-${i}`} columns={columns.length} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  {emptyState ?? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-[15px] font-semibold text-[color:var(--color-text-muted)]">
                        No data found
                      </p>
                      <p className="text-[13px] text-[color:var(--color-text-muted)]">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    'border-b border-b-[color:var(--border-color)] transition-colors duration-[var(--transition-duration)] last:border-b-0',
                    onRowClick && 'cursor-pointer hover:bg-[color:var(--color-brand-50)]',
                    rowIdx % 2 === 0
                      ? 'bg-[color:var(--color-card-bg)]'
                      : 'bg-[color:var(--color-field-bg)]',
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={clsx(
                        'px-4 py-3 text-[13px] font-medium text-[color:var(--color-text-primary)]',
                        col.className,
                      )}
                    >
                      {typeof col.accessor === 'function'
                        ? col.accessor(row)
                        : String(row[col.accessor] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Rows per page:
            </span>
            <select
              value={pagination.perPage}
              onChange={(e) => pagination.onPerPageChange(Number(e.target.value))}
              className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2.5 py-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Page {pagination.page} of {pages} ({pagination.total} total)
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={pagination.page <= 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={pagination.page >= pages}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (!animate) {
    return <div className={clsx('flex flex-col gap-4', className)}>{tableContent}</div>;
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={clsx('flex flex-col gap-4', className)}
    >
      {tableContent}
    </motion.div>
  );
}
