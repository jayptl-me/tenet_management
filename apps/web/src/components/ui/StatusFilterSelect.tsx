'use client';

import { Select } from '@/components/ui/Select';

export interface StatusFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  statuses: string[];
  className?: string;
  allLabel?: string;
}

/**
 * Capitalize the first letter and replace underscores with spaces.
 * e.g. "follow_up" -> "Follow up", "expected" -> "Expected"
 */
function formatStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

/**
 * Reusable Select for filtering list pages by status.
 * Renders an "all" option first, then one option per status string
 * from the model enum. Labels are humanized via formatStatusLabel.
 */
export function StatusFilterSelect({
  value,
  onChange,
  statuses,
  className,
  allLabel = 'All Statuses',
}: StatusFilterSelectProps) {
  const options = [
    { value: '', label: allLabel },
    ...statuses.map((status) => ({
      value: status,
      label: formatStatusLabel(status),
    })),
  ];

  return (
    <Select
      options={options}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}
