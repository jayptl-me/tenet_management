'use client';

import { clsx } from 'clsx';
import { Search } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';

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
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

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
}: DataTableProps<T>) {
  const pages = pagination ? Math.ceil(pagination.total / pagination.perPage) : 0;

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      {searchable && onSearchChange && (
        <div className="relative max-w-sm">
          <Search className="text-surface-400 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)]">
        <table className="font-[family:var(--font-body)] w-full border-collapse bg-[color:var(--color-surface-100)]">
          <thead>
            <tr className="bg-surface-100">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={clsx(
                    'font-display text-surface-800 border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)] px-4 py-3 text-left text-sm font-bold uppercase tracking-wider',
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
                <tr key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <td
                      key={j}
                      className="border-b-[length:var(--bw-default)] border-b-[color:var(--color-surface-200)] px-4 py-3"
                    >
                      <div className="h-4 w-3/4 animate-pulse rounded bg-[color:var(--color-surface-200)]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  {emptyState ?? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-display text-surface-500 text-lg font-semibold">
                        No data found
                      </p>
                      <p className="text-surface-400 text-sm">
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
                    'border-b-[length:var(--bw-default)] border-b-[color:var(--color-surface-200)] transition-colors duration-[var(--transition-duration)] last:border-b-0',
                    onRowClick && 'hover:bg-brand-50 cursor-pointer',
                    rowIdx % 2 === 0 ? 'bg-[color:var(--color-surface-100)]' : 'bg-surface-50',
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={clsx('text-surface-700 px-4 py-3 text-sm', col.className)}
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

      {pagination && pages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-surface-500 text-sm">Rows per page:</span>
            <select
              value={pagination.perPage}
              onChange={(e) => pagination.onPerPageChange(Number(e.target.value))}
              className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-2 py-1 text-sm font-semibold"
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-surface-500 text-sm">
              Page {pagination.page} of {pages} ({pagination.total} total)
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pages}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
