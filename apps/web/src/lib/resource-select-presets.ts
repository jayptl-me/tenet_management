/**
 * Shared ResourceSelect label helpers so tenant/floor/room pickers never show bare IDs.
 */

export function tenantLabel(item: {
  user?: { name?: string };
  userId?: { name?: string };
  room?: { roomNumber?: string };
  roomId?: { roomNumber?: string };
}): string {
  const name = item.user?.name ?? item.userId?.name ?? 'Unknown';
  const room = item.room?.roomNumber ?? item.roomId?.roomNumber ?? '?';
  return `${name} — Room ${room}`;
}

export function tenantSublabel(item: { monthlyRent?: number }): string {
  return item.monthlyRent != null ? `₹${item.monthlyRent}/mo` : '';
}

export function floorLabel(item: {
  label?: string;
  floorNumber?: number;
}): string {
  if (item.label) return item.label;
  if (item.floorNumber != null) return `Floor ${item.floorNumber}`;
  return 'Floor';
}

export function roomLabel(item: {
  roomNumber?: string;
  sharingType?: number;
  monthlyRent?: number;
}): string {
  const num = item.roomNumber ?? '?';
  const share = item.sharingType != null ? `${item.sharingType}-share` : '';
  return share ? `${num} (${share})` : num;
}

export function roomSublabel(item: { monthlyRent?: number; floor?: { label?: string } }): string {
  const parts: string[] = [];
  if (item.floor?.label) parts.push(item.floor.label);
  if (item.monthlyRent != null) parts.push(`₹${item.monthlyRent}/mo`);
  return parts.join(' · ');
}
