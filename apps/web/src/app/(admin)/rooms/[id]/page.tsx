'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Building,
  Bed,
  Pencil,
  UserPlus,
  ArrowRightLeft,
  TriangleAlert,
  FileText,
  Wrench,
  Search,
  Power,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { FormPage } from '@/components/ui/FormPage';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Input } from '@/components/ui/Input';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /rooms/:id          apps/api/src/routes/rooms.ts:368-415
//   GET /tenants?roomId=    apps/api/src/routes/tenants.ts:391-483
//   PUT /rooms/:id          apps/api/src/routes/rooms.ts:474-648
//   DELETE /rooms/:id       apps/api/src/routes/rooms.ts:651-693
//   PUT /tenants/:id        apps/api/src/routes/tenants.ts:503-730

interface RoomBed {
  bedId: string;
  isOccupied: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
}

interface RoomDetail {
  _id: string;
  roomNumber: string;
  floor?: { _id?: string; label?: string; floorNumber?: number };
  sharingType: number;
  monthlyRent: number;
  description?: string;
  isActive: boolean;
  photos?: string[];
  beds?: RoomBed[];
  roomAmenities?: Array<{ amenityKey: string; status: string }>;
  createdAt: string;
}

/** One resident, as the server holds them. */
interface TenantRow {
  _id: string;
  user?: { name?: string; phone?: string };
  room?: { _id?: string; roomNumber?: string };
  bedId?: string;
  monthlyRent?: number;
  moveInDate?: string;
  isActive?: boolean;
}

/** One entry of the write trail of a room. */
interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { name?: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** The bed letters the server uses, in the order it uses them. */
const BED_IDS = ['A', 'B', 'C', 'D'] as const;

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return 'not reported';
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return 'unknown';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The repack the server performs when the sharing type of a room changes.
 *
 * The rule is the server's own (apps/api/src/routes/rooms.ts:84-123): the
 * occupied beds are sorted by their letter and packed into the first slots of
 * the new sharing type. A resident in bed C of a 3-sharing room therefore
 * moves to bed B of a 2-sharing room, and the server writes the new bed onto
 * that resident's record (apps/api/src/routes/rooms.ts:544-553). It sends no
 * message: the resident finds out from the portal.
 */
function repackPreview(
  beds: RoomBed[],
  newSharingType: number,
): {
  refused: boolean;
  moves: Array<{ from: string; to: string; tenantName: string | null }>;
  occupied: number;
} {
  const occupied = beds
    .filter((bed) => bed.isOccupied)
    .sort((left, right) => left.bedId.localeCompare(right.bedId));
  if (occupied.length > newSharingType) {
    return { refused: true, moves: [], occupied: occupied.length };
  }
  const slots = BED_IDS.slice(0, newSharingType);
  const moves: Array<{ from: string; to: string; tenantName: string | null }> = [];
  occupied.forEach((bed, index) => {
    const slot = slots[index];
    if (slot !== undefined && slot !== bed.bedId) {
      moves.push({ from: bed.bedId, to: slot, tenantName: bed.tenantName ?? null });
    }
  });
  return { refused: false, moves, occupied: occupied.length };
}

const ROOM_KEY = (id: string) => ['rooms', id] as const;
const ROOM_RESIDENTS_KEY = (id: string) => ['rooms', id, 'residents'] as const;
const ROOM_AUDIT_KEY = (id: string) => ['rooms', id, 'audit'] as const;

/** A stable empty bed list, so the memos that read it do not churn. */
const EMPTY_BEDS: RoomBed[] = [];

/**
 * One line of the write trail of a room.
 *
 * The audit entry is the proof of what the office did, and the details the
 * server wrote with it are what the office is told.
 */
function auditSummary(entry: AuditEntry): string {
  const details = entry.details ?? {};
  if (entry.action === 'create') {
    const sharing = typeof details.sharingType === 'number' ? details.sharingType : null;
    const rent = typeof details.monthlyRent === 'number' ? details.monthlyRent : null;
    return `The room was created${sharing !== null ? ` as a ${sharing} sharing room` : ''}${
      rent !== null ? ` with a rent of ${fmtMoney(rent)}` : ''
    }.`;
  }
  if (entry.action === 'delete') {
    return 'The room was taken out of service. The record stays.';
  }
  if (entry.action === 'reconcile') {
    const fixed = typeof details.fixedRooms === 'number' ? details.fixedRooms : 0;
    const freed = typeof details.freedBeds === 'number' ? details.freedBeds : 0;
    return `The bed map of the building was rebuilt: ${fixed} room(s) repaired and ${freed} stale bed(s) freed.`;
  }
  if (typeof details.oldSharingType === 'number' && typeof details.newSharingType === 'number') {
    const remaps = typeof details.remapsCount === 'number' ? details.remapsCount : 0;
    return `The sharing type moved from ${details.oldSharingType} to ${details.newSharingType}, and ${remaps} resident(s) changed bed.`;
  }
  if (Array.isArray(details.updatedFields)) {
    const fields = details.updatedFields.filter(
      (field): field is string => typeof field === 'string',
    );
    return fields.length > 0
      ? `The fields that moved: ${fields.join(', ')}.`
      : 'The record was written.';
  }
  return 'The record was written.';
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [assignBed, setAssignBed] = useState<string | null>(null);
  const [assignTenantId, setAssignTenantId] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [actionError, setActionError] = useState('');
  const [writeResult, setWriteResult] = useState('');

  const [sharingChoice, setSharingChoice] = useState('');
  const [sharingBusy, setSharingBusy] = useState(false);

  const [outOfServiceOpen, setOutOfServiceOpen] = useState(false);
  const [outOfServiceBusy, setOutOfServiceBusy] = useState(false);

  const {
    data: rawRoom,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<RoomDetail>(ROOM_KEY(id), `rooms/${id}`, { enabled: Boolean(id) });
  const queryErrorMessage = errorMessage(queryError);

  // The server answers with one room object. Anything else is not a room, and
  // the page says so instead of rendering an empty record.
  const room = rawRoom && !Array.isArray(rawRoom) ? rawRoom : null;

  /**
   * The residents of this room.
   *
   * The bed of the room carries the resident's name, but not their stay and
   * not the rent on their record, so the room reads the residents it holds
   * from the resident list of the room.
   */
  const { data: residents } = useApiQuery<TenantRow[]>(
    ROOM_RESIDENTS_KEY(id),
    `tenants?roomId=${id}&limit=100`,
    { enabled: Boolean(id) },
  );

  const residentsById = useMemo(() => {
    const map = new Map<string, TenantRow>();
    for (const resident of residents ?? []) {
      map.set(resident._id, resident);
    }
    return map;
  }, [residents]);

  /**
   * The active residents a bed can be given to.
   *
   * The server serves at most 100 residents in one page, so this is the first
   * hundred and the picker says so.
   */
  const { data: candidates } = useApiQuery<TenantRow[]>(
    ['rooms', id, 'candidates'],
    'tenants?isActive=true&limit=100',
    { enabled: Boolean(id) && assignBed !== null },
  );

  const filteredCandidates = useMemo(() => {
    const list = candidates ?? [];
    const needle = assignSearch.trim().toLowerCase();
    if (needle === '') return list;
    return list.filter((candidate) => (candidate.user?.name ?? '').toLowerCase().includes(needle));
  }, [candidates, assignSearch]);

  const beds = room?.beds ?? EMPTY_BEDS;
  const occupiedBeds = beds.filter((bed) => bed.isOccupied);
  const freeBeds = beds.filter((bed) => !bed.isOccupied);

  /**
   * The write trail of this room.
   *
   * The audit route filters by the record, so this is the trail of this room
   * and not of every room (apps/api/src/routes/audit.ts:13-52). The server
   * keeps the entries for 90 days.
   */
  const { data: auditTrail } = useApiQuery<AuditEntry[]>(
    ROOM_AUDIT_KEY(id),
    `audit-logs?resource=room&resourceId=${id}&limit=20`,
    { enabled: Boolean(id) },
  );

  const selectedCandidate = useMemo(
    () => (candidates ?? []).find((candidate) => candidate._id === assignTenantId) ?? null,
    [candidates, assignTenantId],
  );

  const sharingPreview = useMemo(
    () => (room ? repackPreview(beds, Number(sharingChoice || room.sharingType)) : null),
    [room, beds, sharingChoice],
  );

  /**
   * The bed move, in one sentence: who moves, where they go and where they come
   * from. The office must see the resident and the room they leave before the
   * write, not after it.
   */
  const moveSummary = selectedCandidate
    ? `${selectedCandidate.user?.name ?? 'This resident'} moves to Room ${room?.roomNumber ?? ''} · Bed ${assignBed}${
        selectedCandidate.room?.roomNumber
          ? `, leaving Room ${selectedCandidate.room.roomNumber} · Bed ${selectedCandidate.bedId ?? 'unknown'}.`
          : ', and holds no bed today.'
      }`
    : '';

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ROOM_KEY(id) });
    queryClient.invalidateQueries({ queryKey: ROOM_RESIDENTS_KEY(id) });
    queryClient.invalidateQueries({ queryKey: ROOM_AUDIT_KEY(id) });
    queryClient.invalidateQueries({ queryKey: ['rooms', 'list'] });
  };

  /**
   * Give a free bed of this room to a resident.
   *
   * The server moves the resident: it frees the bed they hold, takes this
   * one, writes a tenant_transfer entry in the audit log and leaves their rent
   * where it is. It sends no message.
   */
  const handleAssign = async () => {
    if (!assignBed || !assignTenantId || !room) return;
    setAssigning(true);
    setActionError('');
    try {
      await api
        .put(`tenants/${assignTenantId}`, {
          json: { roomId: room._id, bedId: assignBed },
        })
        .json();
      const name = selectedCandidate?.user?.name ?? 'The resident';
      const from = selectedCandidate?.room?.roomNumber
        ? `Room ${selectedCandidate.room.roomNumber} · Bed ${selectedCandidate.bedId ?? 'unknown'}`
        : 'a bed with no room';
      setWriteResult(
        `${name} now sleeps in Room ${room.roomNumber} · Bed ${assignBed}. The server freed the old bed (${from}), took this one, wrote a tenant_transfer entry in the audit log and left the rent on their record where it was. No message was sent: the resident sees it the next time they open the app.`,
      );
      setAssignBed(null);
      setAssignTenantId('');
      setAssignSearch('');
      refresh();
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setAssigning(false);
    }
  };

  /**
   * Change the sharing type of the room.
   *
   * The server rebuilds the beds and moves the residents the repack touches.
   * The office sees who moves before the write.
   */
  const handleSharingChange = async () => {
    if (!room || !sharingChoice) return;
    const next = Number(sharingChoice);
    if (next === room.sharingType) return;
    setSharingBusy(true);
    setWriteResult('');
    try {
      await api
        .put(`rooms/${room._id}`, {
          json: { sharingType: next },
        })
        .json();
      setWriteResult(
        sharingPreview && sharingPreview.moves.length > 0
          ? `The room is a ${next}-sharing room now. ${sharingPreview.moves
              .map(
                (move) =>
                  `${move.tenantName ?? 'A resident'} moved from bed ${move.from} to bed ${move.to}`,
              )
              .join(
                ', ',
              )}. The server wrote the new bed onto each resident's record and told nobody: they see it in the portal.`
          : `The room is a ${next}-sharing room now. The server rebuilt the beds and no resident moved.`,
      );
      setSharingChoice('');
      refresh();
    } catch (err) {
      setWriteResult('');
      setActionError((await parseApiError(err)).message);
    } finally {
      setSharingBusy(false);
    }
  };

  /**
   * Take the room out of service.
   *
   * The server refuses while a resident still occupies it, and it tells the
   * residents of the room nothing.
   */
  const handleOutOfService = async () => {
    if (!room) return;
    setOutOfServiceBusy(true);
    try {
      await api.delete(`rooms/${room._id}`).json();
      setOutOfServiceOpen(false);
      setWriteResult(
        `Room ${room.roomNumber} is out of service. The server kept the record, set the active flag to false, recounted the rooms on ${room.floor?.label ?? 'its floor'} and wrote a delete entry in the audit log. The residents of the room were not told.`,
      );
      refresh();
    } catch (err) {
      setOutOfServiceOpen(false);
      setActionError((await parseApiError(err)).message);
    } finally {
      setOutOfServiceBusy(false);
    }
  };

  if (!isLoading && (queryErrorMessage || !room)) {
    return (
      <FormPage
        title="Room"
        description="The bed map of one room"
        backHref="/rooms"
        error={queryErrorMessage || 'The server reports no room for this id.'}
        maxWidth="full"
      />
    );
  }

  const floorId = room?.floor?._id;
  const roomIsInService = room?.isActive ?? false;

  return (
    <FormPage
      title={room ? `Room ${room.roomNumber}` : 'Room'}
      description={
        room
          ? `${room.floor?.label ?? 'No floor'} · ${room.sharingType} Sharing · ${occupiedBeds.length} of ${beds.length} beds taken`
          : 'The bed map of one room'
      }
      backHref="/rooms"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        room ? (
          <StatusBadge
            variant={statusToVariant(room.isActive ? 'active' : 'inactive')}
            label={room.isActive ? 'In service' : 'Out of service'}
          />
        ) : undefined
      }
      actions={
        room ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!roomIsInService || freeBeds.length === 0}
              title={
                !roomIsInService
                  ? 'The room is out of service, so no resident can be moved into it.'
                  : freeBeds.length === 0
                    ? 'Every bed of this room holds a resident.'
                    : 'Give a free bed of this room to a resident'
              }
              onClick={() => {
                setAssignBed(freeBeds[0]?.bedId ?? null);
                setAssignTenantId('');
                setActionError('');
              }}
            >
              <UserPlus className="h-4 w-4" />
              Assign a resident
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push(`/rooms/${id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      {room && (
        <ContentFrame
          rail={
            <>
              {/* The room itself: the numbers the server holds for it. */}
              <DetailCard title="The room" icon={<Building />}>
                <DetailList>
                  <DetailRow
                    label="Floor"
                    value={
                      floorId ? (
                        <Link
                          href={`/floors/${floorId}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {room.floor?.label ?? 'Floor'}
                        </Link>
                      ) : (
                        (room.floor?.label ?? 'No floor')
                      )
                    }
                  />
                  <DetailRow label="Sharing type" value={`${room.sharingType} sharing`} />
                  <DetailRow label="Rent of the room" value={`${fmtMoney(room.monthlyRent)}/mo`} />
                  <DetailRow
                    label="Beds taken"
                    value={`${occupiedBeds.length} of ${beds.length}`}
                  />
                  <DetailRow label="Beds free" value={String(freeBeds.length)} />
                  <DetailRow
                    label="In-room services"
                    value={
                      (room.roomAmenities ?? []).length === 0 ? (
                        'not tracked'
                      ) : (
                        <Link
                          href={`/rooms/${room._id}/edit`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {room.roomAmenities?.length} amenit
                          {(room.roomAmenities?.length ?? 0) === 1 ? 'y' : 'ies'}
                        </Link>
                      )
                    }
                  />
                  <DetailRow label="Added" value={formatDate(room.createdAt)} />
                </DetailList>
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  The rent of the room is the number the office starts from when a resident is
                  checked in. What a resident owes is raised from the rent on their own record.
                </p>
              </DetailCard>

              {/* The office actions of this module, on the page of the room
                  they act on, with the rule the server applies to each. */}
              <DetailCard title="The office can act here" icon={<Wrench />}>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Give a bed to a resident
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server moves the resident: it frees the bed they hold, takes the free bed
                      of this room, writes a tenant_transfer entry in the audit log and leaves their
                      rent where it is. It sends no message, so the resident finds out from the
                      portal.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Change the sharing type
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server rebuilds the beds and packs the occupied ones into the first
                      letters of the new sharing type. A resident whose bed letter changes is moved
                      and the new bed is written onto their record. Nobody is told.
                    </p>
                    <div className="mt-2">
                      <Select
                        aria-label="Change the sharing type of this room"
                        size="compact"
                        options={[
                          { value: '', label: `Now: ${room.sharingType} sharing` },
                          { value: '2', label: '2 sharing' },
                          { value: '3', label: '3 sharing' },
                          { value: '4', label: '4 sharing' },
                        ]}
                        value={sharingChoice}
                        onChange={(e) => setSharingChoice(e.target.value)}
                      />
                    </div>
                    {sharingPreview &&
                      sharingChoice &&
                      Number(sharingChoice) !== room.sharingType && (
                        <div className="mt-2 space-y-2">
                          {sharingPreview.refused ? (
                            <p className="text-2xs flex items-start gap-1.5 font-semibold text-(--color-danger-700)">
                              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              The server refuses: {sharingPreview.occupied} bed(s) are taken and a{' '}
                              {sharingChoice} sharing room has {sharingChoice} beds. Move or check
                              out a resident first.
                            </p>
                          ) : sharingPreview.moves.length === 0 ? (
                            <p className="text-2xs font-medium text-(--color-text-secondary)">
                              No resident moves: the {sharingPreview.occupied} taken bed(s) are
                              already in the first letters of a {sharingChoice} sharing room.
                            </p>
                          ) : (
                            <p className="text-2xs font-medium text-(--color-text-secondary)">
                              {sharingPreview.moves.map((move) => (
                                <span key={move.from} className="block">
                                  {move.tenantName ?? 'A resident'} moves from bed {move.from} to
                                  bed {move.to}. The server writes the new bed onto their record and
                                  sends no message.
                                </span>
                              ))}
                            </p>
                          )}
                          <Button
                            size="sm"
                            onClick={() => void handleSharingChange()}
                            disabled={sharingPreview.refused || sharingBusy}
                            loading={sharingBusy}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                            Make it a {sharingChoice} sharing room
                          </Button>
                        </div>
                      )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Take the room out of service
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server keeps the record and sets its active flag to false, so the room
                      leaves the lists a new resident is picked from. It recounts the rooms on the
                      floor and writes a delete entry in the audit log. It refuses while a resident
                      still occupies the room, and it tells the residents nothing.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setOutOfServiceOpen(true)}
                      disabled={!roomIsInService}
                    >
                      <Power className="h-4 w-4" />
                      Take it out of service
                    </Button>
                  </div>
                </div>
              </DetailCard>
            </>
          }
        >
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
              {writeResult}
            </div>
          )}

          {(actionError || errorMessage(queryError)) && (
            <ErrorBanner message={actionError || errorMessage(queryError)} />
          )}

          {/* The protagonist of this module: the shape of the room, one tile
              per bed, and who holds each bed. */}
          <DetailCard
            title="The beds of this room"
            icon={<Bed />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                {occupiedBeds.length} taken · {freeBeds.length} free
              </span>
            }
          >
            {beds.length === 0 ? (
              <p className="text-sm font-semibold text-(--color-text-muted)">
                The server holds no bed slot for this room. The reconcile on the rooms list rebuilds
                them from the resident records.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {beds.map((bed) => {
                  const resident = bed.tenantId
                    ? residentsById.get(String(bed.tenantId))
                    : undefined;
                  const isTarget = assignBed === bed.bedId;
                  return (
                    <div
                      key={bed.bedId}
                      className={clsx(
                        'rounded-(--radius-lg) border p-4 transition-colors duration-(--transition-duration)',
                        bed.isOccupied
                          ? 'border-(--border-color) bg-(--color-field-bg) shadow-(--shadow-sm)'
                          : 'border-dashed border-(--color-success-300) bg-(--color-success-50)',
                        isTarget && 'ring-2 ring-(--color-brand-500)',
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-(--color-text-primary)">
                          Bed {bed.bedId}
                        </span>
                        <StatusBadge
                          variant={bed.isOccupied ? 'warning' : 'success'}
                          label={bed.isOccupied ? 'Taken' : 'Free'}
                        />
                      </div>

                      {bed.isOccupied ? (
                        <div className="space-y-1">
                          {bed.tenantId ? (
                            <Link
                              href={`/tenants/${bed.tenantId}`}
                              className="block truncate text-xs font-semibold text-(--color-brand-600) underline-offset-2 hover:underline"
                            >
                              {bed.tenantName ?? 'View the resident'}
                            </Link>
                          ) : (
                            <p className="truncate text-xs font-semibold text-(--color-text-secondary)">
                              {bed.tenantName ?? 'Taken'}
                            </p>
                          )}
                          <p className="text-2xs font-medium text-(--color-text-muted)">
                            {resident
                              ? `In this room since ${formatDate(resident.moveInDate)} · the rent on their record is ${fmtMoney(resident.monthlyRent)}/mo`
                              : 'The resident record was not found for this bed. The reconcile on the rooms list reports that as an orphan.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-(--color-text-secondary)">
                            No resident in this bed.
                          </p>
                          <button
                            type="button"
                            disabled={!roomIsInService}
                            onClick={() => {
                              setAssignBed(isTarget ? null : bed.bedId);
                              setAssignTenantId('');
                              setActionError('');
                            }}
                            className="text-2xs inline-flex items-center gap-1 font-bold text-(--color-brand-600) underline-offset-2 hover:underline disabled:opacity-50"
                          >
                            <UserPlus className="h-3 w-3" />
                            {isTarget ? 'Close the picker' : 'Give this bed to a resident'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DetailCard>

          {/* The bed move. The resident who is affected and the room they are
              leaving are named before the write, and the server's answer is
              reported after it. */}
          {assignBed && (
            <DetailCard
              title={`Give bed ${assignBed} to a resident`}
              icon={<UserPlus />}
              variant="info"
              action={
                <button
                  type="button"
                  aria-label="Close the bed picker"
                  onClick={() => {
                    setAssignBed(null);
                    setAssignTenantId('');
                  }}
                  className="rounded-(--radius-md) p-1 text-(--color-text-muted) hover:bg-(--color-field-bg)"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            >
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The target is Room {room.roomNumber} · Bed {assignBed}. The server moves the
                resident: it frees the bed they hold, takes this one, writes a tenant_transfer entry
                in the audit log and leaves their rent where it is. It sends no message, so the
                resident finds out the next time they open the app.
              </p>

              <div className="mt-3 max-w-sm">
                <Input
                  placeholder="Search the resident by name..."
                  aria-label="Search the resident by name"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>

              {candidates === undefined ? (
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  Reading the active residents...
                </p>
              ) : filteredCandidates.length === 0 ? (
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  The server reports no active resident with that name. It serves at most 100 active
                  residents in one page, so a resident further down the list is not here.
                </p>
              ) : (
                <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
                  {filteredCandidates.map((candidate) => {
                    const isChosen = candidate._id === assignTenantId;
                    return (
                      <button
                        key={candidate._id}
                        type="button"
                        onClick={() => setAssignTenantId(candidate._id)}
                        className={`flex w-full flex-col gap-0.5 rounded-(--radius-md) border px-3 py-2 text-left transition-colors ${
                          isChosen
                            ? 'border-(--color-brand-400) bg-(--color-brand-50)'
                            : 'border-(--border-color) bg-(--color-card-bg) hover:bg-(--color-field-bg)'
                        }`}
                      >
                        <span className="text-xs font-semibold text-(--color-text-primary)">
                          {candidate.user?.name ?? 'Unnamed resident'}
                        </span>
                        <span className="text-2xs font-medium text-(--color-text-muted)">
                          {candidate.room?.roomNumber
                            ? `leaving Room ${candidate.room.roomNumber} · Bed ${candidate.bedId ?? 'unknown'}`
                            : 'holds no bed of a room'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedCandidate && (
                <p className="text-2xs mt-3 font-semibold text-(--color-text-primary)">
                  {moveSummary}
                </p>
              )}

              <div className="mt-3 flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => void handleAssign()}
                  disabled={!assignTenantId || assigning}
                  loading={assigning}
                >
                  <UserPlus className="h-4 w-4" />
                  Move the resident into bed {assignBed}
                </Button>
              </div>
            </DetailCard>
          )}

          {/* The services this room depends on: the ones the office tracks
              for the room itself, and the ones the floor carries. */}
          <DetailCard title="The services this room depends on" icon={<Wrench />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="tracking-label text-2xs font-bold text-(--color-text-muted) uppercase">
                  In this room
                </p>
                {(room.roomAmenities ?? []).length === 0 ? (
                  <p className="text-2xs mt-2 font-medium text-(--color-text-secondary)">
                    No in-room amenity is tracked for this room. The office can list them on the
                    edit page; the server then tells the residents of this room when one of them
                    breaks.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {room.roomAmenities?.map((amenity) => (
                      <li
                        key={amenity.amenityKey}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-semibold text-(--color-text-primary) capitalize">
                          {amenity.amenityKey.replace(/_/g, ' ')}
                        </span>
                        <StatusBadge
                          variant={statusToVariant(amenity.status)}
                          label={amenity.status.charAt(0).toUpperCase() + amenity.status.slice(1)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  A status that moves to degraded or down is pushed to the residents of this room as
                  a service update. The office changes them on the{' '}
                  <Link
                    href={`/rooms/${room._id}/edit`}
                    className="font-semibold text-(--color-brand-600) hover:underline"
                  >
                    edit page
                  </Link>
                  .
                </p>
              </div>

              <div>
                <p className="tracking-label text-2xs font-bold text-(--color-text-muted) uppercase">
                  On the floor
                </p>
                {floorId ? (
                  <div className="mt-2">
                    <FloorServiceGrid
                      floorId={floorId}
                      floorLabel={room.floor?.label ?? 'the floor'}
                      onReportIssue={(serviceType) => {
                        router.push(
                          `/complaints/new?category=${encodeURIComponent(serviceType)}&roomId=${encodeURIComponent(room._id)}`,
                        );
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-2xs mt-2 font-medium text-(--color-text-secondary)">
                    This room is on no floor, so it depends on no floor service.
                  </p>
                )}
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  These are the services of {room.floor?.label ?? 'the floor'} (water, geyser, wifi,
                  lift), not of this room. The floor carries them; a room inherits them.
                </p>
              </div>
            </div>
          </DetailCard>

          {room.description && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="text-sm font-medium text-(--color-text-secondary)">
                {room.description}
              </p>
            </DetailCard>
          )}

          {/* The write trail of this room: the proof of what the office did to
              it, and the only place a change that reached nobody shows up. */}
          <DetailCard
            title="What the office did to this room"
            icon={<FileText />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                the newest {auditTrail?.length ?? 0} entries
              </span>
            }
          >
            {!auditTrail || auditTrail.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The server holds no write entry for this room in the entries it keeps (the entries
                expire after 90 days).
              </p>
            ) : (
              <ul className="space-y-2">
                {auditTrail.map((entry) => (
                  <li
                    key={entry._id}
                    className="flex flex-col gap-0.5 border-b border-(--border-color) pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        variant={
                          entry.action === 'delete'
                            ? 'danger'
                            : entry.action === 'create'
                              ? 'success'
                              : 'neutral'
                        }
                        label={entry.action.replace(/_/g, ' ')}
                      />
                      <span className="text-2xs font-semibold text-(--color-text-primary)">
                        {entry.userId?.name ?? 'The office'}
                      </span>
                      <span className="text-2xs font-medium text-(--color-text-muted)">
                        {entry.timestamp
                          ? new Date(entry.timestamp).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'no timestamp'}
                      </span>
                    </div>
                    <p className="text-2xs font-medium text-(--color-text-secondary)">
                      {auditSummary(entry)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DetailCard>

          {room.photos && room.photos.length > 0 && (
            <DetailCard title="Photos" icon={<Building />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {room.photos.map((photo, index) => (
                  <a
                    key={index}
                    href={photo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square overflow-hidden rounded-(--radius-lg) border border-(--border-color) shadow-(--shadow-sm) transition-all duration-(--transition-duration)"
                  >
                    <Image
                      src={photo}
                      alt={`Room ${room.roomNumber} photo ${index + 1}`}
                      width={600}
                      height={600}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </DetailCard>
          )}

          {/* The floor of the room, for the office that thinks in floors. */}
          <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
            <Building className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The whole floor is one click away:{' '}
            {floorId ? (
              <Link
                href={`/rooms?floorId=${floorId}`}
                className="font-semibold text-(--color-brand-600) hover:underline"
              >
                every room of {room.floor?.label ?? 'this floor'}
              </Link>
            ) : (
              <span>this room has no floor</span>
            )}
            , filtered on that floor in the address bar.
          </p>
        </ContentFrame>
      )}

      <ConfirmModal
        open={outOfServiceOpen}
        title="Take the room out of service"
        message={`The server keeps the record of Room ${room?.roomNumber ?? ''} and sets its active flag to false, so it leaves the lists a new resident is picked from. It recounts the rooms on the floor and writes a delete entry in the audit log. ${
          occupiedBeds.length > 0
            ? `It will refuse: ${occupiedBeds.length} bed(s) of this room still hold a resident. Move or check them out first.`
            : 'It sends no message: the residents of the room are not told.'
        }`}
        confirmLabel="Take it out of service"
        loading={outOfServiceBusy}
        onConfirm={() => void handleOutOfService()}
        onCancel={() => setOutOfServiceOpen(false)}
      />
    </FormPage>
  );
}
