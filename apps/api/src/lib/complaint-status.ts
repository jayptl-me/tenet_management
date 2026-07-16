/**
 * Shared complaint status → resolvedAt patch.
 * Used by both PUT /complaints/:id/status (kanban) and PUT /complaints/:id
 * so reopen cannot leave a sticky resolvedAt on one path only.
 */

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

/**
 * Returns fields to $set for a status transition.
 * - resolved -> resolvedAt = now
 * - any other status -> resolvedAt = null (clear sticky timestamp)
 */
export function complaintStatusPatch(status: ComplaintStatus): {
  status: ComplaintStatus;
  resolvedAt: Date | null;
} {
  if (status === 'resolved') {
    return { status, resolvedAt: new Date() };
  }
  return { status, resolvedAt: null };
}
