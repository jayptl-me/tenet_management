'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Standard view / edit / delete action buttons for DataTable rows.
 * Replaces ad-hoc raw `<button>` elements with the proper `Button` component
 * for consistent styling, hover states, and focus rings.
 */

export interface TableAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'glass';
  disabled?: boolean;
}

interface TableActionsProps {
  /** Show "View" action (default true). */
  showView?: boolean;
  onView?: () => void;
  /** Show "Edit" action (default true). */
  showEdit?: boolean;
  onEdit?: () => void;
  /** Show "Delete" action (default true). */
  showDelete?: boolean;
  onDelete?: () => void;
  /** Extra actions rendered after defaults. */
  extra?: TableAction[];
  /** Size of action buttons (default 'icon'). */
  size?: 'sm' | 'icon';
  /** Compact mode — no labels, just icons (default true). */
  compact?: boolean;
}

export function TableActions({
  showView = true,
  onView,
  showEdit = true,
  onEdit,
  showDelete = true,
  onDelete,
  extra,
  size = 'icon',
  compact = true,
}: TableActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {showView && onView && (
        <Button
          variant="ghost"
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          title="View"
          aria-label="View"
        >
          <Eye className="h-3.5 w-3.5" />
          {!compact && <span className="text-xs">View</span>}
        </Button>
      )}
      {showEdit && onEdit && (
        <Button
          variant="ghost"
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Edit"
          aria-label="Edit"
          className="text-[color:var(--color-brand-600)]"
        >
          <Pencil className="h-3.5 w-3.5" />
          {!compact && <span className="text-xs">Edit</span>}
        </Button>
      )}
      {showDelete && onDelete && (
        <Button
          variant="ghost"
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
          aria-label="Delete"
          className="text-[color:var(--color-danger-600)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {!compact && <span className="text-xs">Delete</span>}
        </Button>
      )}
      {extra?.map((action, idx) => (
        <Button
          key={idx}
          variant={action.variant || 'ghost'}
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
          title={action.label}
          aria-label={action.label}
          disabled={action.disabled}
        >
          {action.icon}
          {!compact && <span className="text-xs">{action.label}</span>}
        </Button>
      ))}
    </div>
  );
}
