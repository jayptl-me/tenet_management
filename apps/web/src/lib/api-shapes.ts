/**
 * Adapters for API response shapes where population uses FK field names
 * (tenantId.userId) rather than virtual names (tenant.user).
 */

export interface PopulatedUser {
  name?: string;
  email?: string;
  phone?: string;
}

export interface PopulatedRoom {
  roomNumber?: string;
  floorId?: string;
  _id?: string;
  id?: string;
}

export interface PopulatedTenantRef {
  _id?: string;
  id?: string;
  userId?: PopulatedUser;
  user?: PopulatedUser;
  roomId?: PopulatedRoom;
  room?: PopulatedRoom;
}

export function tenantDisplayName(tenant: PopulatedTenantRef | string | null | undefined): string {
  if (!tenant || typeof tenant === 'string') return 'N/A';
  return tenant.userId?.name ?? tenant.user?.name ?? 'N/A';
}

export function tenantRoomNumber(tenant: PopulatedTenantRef | string | null | undefined): string {
  if (!tenant || typeof tenant === 'string') return 'N/A';
  return tenant.roomId?.roomNumber ?? tenant.room?.roomNumber ?? 'N/A';
}

export function tenantIdOf(tenant: PopulatedTenantRef | string | null | undefined): string {
  if (!tenant) return '';
  if (typeof tenant === 'string') return tenant;
  return String(tenant._id ?? tenant.id ?? '');
}

export function invoiceIdOf(
  invoice: { _id?: string; id?: string } | string | null | undefined,
): string {
  if (!invoice) return '';
  if (typeof invoice === 'string') return invoice;
  return String(invoice._id ?? invoice.id ?? '');
}

/** Extract HH:mm from ISO datetime or pass through if already HH:mm. */
export function toTimeInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const s = String(value);
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}
