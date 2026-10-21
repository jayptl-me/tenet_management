'use client';

import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  CalendarClock,
  FileText,
  History,
  MapPin,
  Package,
  Pencil,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DatePicker } from '@/components/ui/DatePicker';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FormPage } from '@/components/ui/FormPage';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { floorLabel, roomLabel, roomSublabel } from '@/lib/resource-select-presets';
import {
  AssetCategoryIcon,
  AssetServiceTimeline,
  AssetStockMeter,
  assetCategoryLabel,
  formatShortDate,
  isLowStock,
} from '@/components/ui/AssetVisuals';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /assets/:id        apps/api/src/routes/assets.ts:239-250
//   GET /assets            apps/api/src/routes/assets.ts:158-209
//   PUT  /assets/:id       apps/api/src/routes/assets.ts:293-354
//   DELETE /assets/:id     apps/api/src/routes/assets.ts:357-384
//   GET /audit-logs        apps/api/src/routes/audit.ts:13-52

interface PopulatedRef {
  _id?: string;
  label?: string;
  floorNumber?: number;
  roomNumber?: string;
}

interface AssetDetail {
  _id: string;
  name: string;
  category: string;
  location?: string;
  floorId?: PopulatedRef | string | null;
  roomId?: PopulatedRef | string | null;
  quantity?: number;
  lowStockThreshold?: number;
  status: string;
  purchasedDate?: string | null;
  lastServicedDate?: string | null;
  nextServiceDate?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AssetRow {
  _id: string;
  name: string;
  category: string;
  status: string;
  quantity?: number;
  location?: string;
  floorId?: PopulatedRef | string | null;
  roomId?: PopulatedRef | string | null;
}

interface AssetsListBody {
  success: boolean;
  data: AssetRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** One entry of the write trail of an asset. */
interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { name?: string } | null;
}

// ── Vocabulary ─────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In use' },
  { value: 'under_maintenance', label: 'Under maintenance' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

const ASSET_KEY = (id: string | undefined) => ['assets', id] as const;
const ASSET_AUDIT_KEY = (id: string | undefined) => ['assets', id, 'audit'] as const;
// The assets list, the band and this record all live under the same
// `['assets']` prefix, so one invalidation re-reads every asset view.
const ASSETS_PREFIX = ['assets'] as const;

/** The page size the API allows (parsePagination clamps the limit to 100). */
const REGISTER_PAGE_SIZE = 100;

// ── Helpers ────────────────────────────────────────────────────────────

/** The id of a floor or a room reference, populated or not. */
function refId(value: PopulatedRef | string | null | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : (value._id ?? '');
}

/** The floor of a record, when the server resolved it. */
function floorOf(record: AssetDetail | AssetRow): PopulatedRef | null {
  return record.floorId && typeof record.floorId === 'object' ? record.floorId : null;
}

/** The room of a record, when the server resolved it. */
function roomOf(record: AssetDetail | AssetRow): PopulatedRef | null {
  return record.roomId && typeof record.roomId === 'object' ? record.roomId : null;
}

/** The name of the floor, as the server holds it. */
function floorText(record: AssetDetail | AssetRow): string | null {
  const floor = floorOf(record);
  if (!floor) return null;
  return floor.label ?? (floor.floorNumber != null ? `Floor ${floor.floorNumber}` : null);
}

/**
 * The date a DatePicker hands over.
 *
 * The picker calls its onChange with the value it picked: a change event whose
 * target carries the date (apps/web/src/components/ui/DatePicker.tsx:203-221).
 * Both shapes are accepted, so a date is never lost.
 */
function pickedDate(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const target = (value as { target?: { value?: unknown } }).target;
    if (target && typeof target.value === 'string') return target.value;
  }
  return '';
}

/** The date the server holds, as the picker shows it (yyyy-mm-dd). */
function dateInput(value?: string | null): string {
  return value ? String(value).slice(0, 10) : '';
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'unknown';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'unknown';
  }
}

/**
 * The service clock of an asset.
 *
 * The date is the server's; the comparison is a date and not a money number.
 * A retired asset has no service clock: the server leaves it out of the
 * service-due set.
 */
function serviceHealth(
  status: string,
  nextServiceDate?: string | null,
): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (status === 'retired') return { label: 'Closed', variant: 'neutral' };
  if (!nextServiceDate) return { label: 'Unscheduled', variant: 'neutral' };
  if (new Date(nextServiceDate).getTime() < Date.now()) {
    return { label: 'Overdue', variant: 'danger' };
  }
  return { label: formatShortDate(nextServiceDate), variant: 'success' };
}

/**
 * One line of the write trail of an asset.
 *
 * The audit entry is the proof of what the office did, and the details the
 * server wrote with it are what the office is told.
 */
function auditSummary(entry: AuditEntry): string {
  const details: Record<string, unknown> = entry.details ?? {};
  if (entry.action === 'create') {
    const name = typeof details.name === 'string' ? details.name : null;
    const quantity = typeof details.quantity === 'number' ? details.quantity : null;
    const held = name ? ` as "${name}"` : '';
    const count = quantity !== null ? ` with a count of ${quantity}` : '';
    return `The asset was registered${held}${count}.`;
  }
  if (details.retired === true) {
    return 'The asset was retired. The record stays and the service schedule closes.';
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

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const id = params?.id;

  const [actionError, setActionError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [busy, setBusy] = useState('');

  const [stateChoice, setStateChoice] = useState('');
  const [floorChoice, setFloorChoice] = useState('');
  const [roomChoice, setRoomChoice] = useState('');
  const [servicedOn, setServicedOn] = useState('');
  const [nextServiceOn, setNextServiceOn] = useState('');
  const [countChoice, setCountChoice] = useState('');
  const [thresholdChoice, setThresholdChoice] = useState('');

  const [retireOpen, setRetireOpen] = useState(false);
  const [retiring, setRetiring] = useState(false);

  const {
    data: asset = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<AssetDetail>(ASSET_KEY(id), `assets/${id}`, { enabled: Boolean(id) });
  const queryErrorMessage = errorMessage(queryError);

  /**
   * The write trail of this asset.
   *
   * The audit route filters by the record, so this is the trail of this asset
   * and not of every asset (apps/api/src/routes/audit.ts:13-52). The server
   * keeps the entries for 90 days.
   */
  const { data: auditTrail } = useApiQuery<AuditEntry[]>(
    ASSET_AUDIT_KEY(id),
    `audit-logs?resource=asset&resourceId=${id}&limit=20`,
    { enabled: Boolean(id) },
  );

  /**
   * The register, to show what lives where this asset lives.
   *
   * The list route is the only read that resolves the floor and the room of a
   * row, and it serves at most 100 rows in one page, so this is the first
   * hundred assets of the register, narrowed to this room or this floor. The
   * card says so.
   */
  const { data: registerBody } = useApiBodyQuery<AssetsListBody>(
    ['assets', id, 'register'],
    `assets?limit=${REGISTER_PAGE_SIZE}`,
    { enabled: Boolean(id) },
  );

  const assetRoom = asset ? roomOf(asset) : null;
  const assetFloor = asset ? floorOf(asset) : null;

  const neighbours = useMemo(() => {
    const room = assetRoom;
    const floor = assetFloor;
    if (!room?._id && !floor?._id) return [];
    const rows = registerBody?.data ?? [];
    return rows.filter((row) => {
      if (row._id === id) return false;
      if (room?._id) return refId(row.roomId) === room._id;
      return refId(row.floorId) === floor?._id;
    });
  }, [registerBody, assetRoom, assetFloor, id]);

  /**
   * The office action fields are seeded from the record.
   *
   * They are adjusted during the render that sees a new record, React's
   * documented way to adjust state when something changes, so the operator
   * sees the values the server holds and an untouched field keeps them.
   */
  const seedKey = asset
    ? [
        asset._id,
        asset.status,
        refId(asset.floorId),
        refId(asset.roomId),
        asset.quantity,
        asset.lowStockThreshold,
        asset.lastServicedDate,
        asset.nextServiceDate,
      ].join('|')
    : null;
  const [seedSeen, setSeedSeen] = useState<string | null>(null);
  if (asset && seedKey !== null && seedSeen !== seedKey) {
    setSeedSeen(seedKey);
    setStateChoice('');
    setFloorChoice(refId(asset.floorId));
    setRoomChoice(refId(asset.roomId));
    setServicedOn(dateInput(asset.lastServicedDate));
    setNextServiceOn(dateInput(asset.nextServiceDate));
    setCountChoice(String(asset.quantity ?? 0));
    setThresholdChoice(String(asset.lowStockThreshold ?? 0));
  }

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ASSETS_PREFIX });
  }, [queryClient]);

  /**
   * One office write.
   *
   * The server answers with the record it wrote, and the page re-reads it, so
   * what is on screen afterwards is the server's state and not a local claim.
   */
  const runWrite = async (
    action: string,
    patch: Record<string, unknown>,
    message: string,
  ): Promise<void> => {
    if (!asset) return;
    setBusy(action);
    setActionError('');
    setWriteResult('');
    try {
      await api.put(`assets/${asset._id}`, { json: patch }).json();
      await refresh();
      setWriteResult(message);
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setBusy('');
    }
  };

  const handleStateChange = () => {
    if (!asset || stateChoice === '') return;
    const next = stateChoice;
    const nextLabel = next.replace(/_/g, ' ');
    const moves = next !== asset.status;
    const goesOutOfService = next === 'under_maintenance' || next === 'damaged';
    const floorName = floorText(asset) ?? 'the floor';
    const place = assetRoom?.roomNumber ? `Room ${assetRoom.roomNumber}` : floorName;
    const tail = goesOutOfService
      ? `It pushed a service_update to the active residents of ${place}. The API does not say whether the push arrived, so check the portal if it matters.`
      : 'It sent no message: the residents of this asset are not told that it is back in service.';
    const message = moves
      ? `The server now reports "${asset.name}" as ${nextLabel} and wrote an update entry in the audit log. ${tail}`
      : `The server reports "${asset.name}" as ${nextLabel}. Nothing moved, so nothing was sent to anybody.`;
    void runWrite('state', { status: next }, message);
  };

  const handlePlacementChange = () => {
    if (!asset) return;
    const message = `The server now holds "${asset.name}" on the floor and the room you picked. The move itself is not announced: the residents of the new room hear about this asset only the next time it goes out of service.`;
    void runWrite('placement', { floorId: floorChoice, roomId: roomChoice }, message);
  };

  const handleServiceChange = () => {
    if (!asset) return;
    const last = servicedOn ? `${servicedOn}T00:00:00.000Z` : '';
    const next = nextServiceOn ? `${nextServiceOn}T00:00:00.000Z` : '';
    const message = `The server now holds the last service of "${asset.name}" on ${servicedOn || 'no date'} and the next service on ${nextServiceOn || 'no date'}. Nobody was told: a service date is between the office and the register.`;
    void runWrite('service', { lastServicedDate: last, nextServiceDate: next }, message);
  };

  const handleCountChange = () => {
    if (!asset) return;
    const quantity = Number(countChoice);
    const threshold = Number(thresholdChoice);
    if (
      countChoice === '' ||
      thresholdChoice === '' ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      !Number.isInteger(threshold) ||
      threshold < 0
    ) {
      setActionError('The count and the threshold must be whole numbers of zero or more.');
      return;
    }
    const tail =
      threshold > 0 && quantity <= threshold
        ? 'The asset is now on the low stock list of the register.'
        : 'The asset is not on the low stock list.';
    const message = `The server now holds a count of ${quantity} for "${asset.name}" with a threshold of ${threshold}. ${tail} Nobody was told.`;
    void runWrite('count', { quantity, lowStockThreshold: threshold }, message);
  };

  const handleServicedChange = (value: string) => {
    setServicedOn(pickedDate(value));
  };

  const handleNextServiceChange = (value: string) => {
    setNextServiceOn(pickedDate(value));
  };

  /**
   * The retirement.
   *
   * The server keeps the record and sets its state to retired. It writes an
   * update entry in the audit log and sends no message.
   */
  const handleRetire = async () => {
    if (!asset) return;
    setRetiring(true);
    setActionError('');
    try {
      await api.delete(`assets/${asset._id}`).json();
      setRetireOpen(false);
      await refresh();
      setWriteResult(
        `The server now reports "${asset.name}" as retired. The record is kept, an update entry was written in the audit log and the asset left the service due list. No resident was told.`,
      );
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setRetiring(false);
    }
  };

  if (!isLoading && (queryErrorMessage || !asset)) {
    return (
      <FormPage
        title="Asset"
        description="One item of the register"
        backHref="/assets"
        error={queryErrorMessage || 'The server reports no asset for this id.'}
        maxWidth="full"
      />
    );
  }

  const health = asset ? serviceHealth(asset.status, asset.nextServiceDate) : null;
  const low = asset ? isLowStock(asset.quantity, asset.lowStockThreshold) : false;
  const floor = assetFloor;
  const room = assetRoom;
  const retireMessage = `The server keeps the record of "${asset?.name ?? ''}" and sets its state to retired, so it leaves the service due list. It writes an update entry in the audit log and sends no message: nobody is told that the item left the register.`;

  return (
    <FormPage
      title={asset?.name ?? 'Asset'}
      description={
        asset
          ? `${assetCategoryLabel(asset.category)} · ${asset.location ?? 'No location'}`
          : 'One item of the register'
      }
      backHref="/assets"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        asset ? (
          <StatusBadge
            variant={statusToVariant(asset.status)}
            label={asset.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
      actions={
        asset ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/assets/${asset._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            {asset.status !== 'retired' && (
              <Button variant="danger" size="sm" onClick={() => setRetireOpen(true)}>
                <Wrench className="h-4 w-4" />
                Retire
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {asset && (
        <ContentFrame
          rail={
            <>
              {/* The record itself: what the server holds for this asset. */}
              <DetailCard title="The asset" icon={<Package />}>
                <DetailList>
                  <DetailRow
                    label="Category"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <AssetCategoryIcon
                          category={asset.category}
                          className="h-3.5 w-3.5 text-(--color-text-muted)"
                        />
                        {assetCategoryLabel(asset.category)}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Location"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-(--color-text-muted)" />
                        {asset.location ?? '-'}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Floor"
                    value={
                      floor?._id ? (
                        <Link
                          href={`/floors/${floor._id}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {floorText(asset) ?? 'Floor'}
                        </Link>
                      ) : (
                        (floorText(asset) ?? 'No floor')
                      )
                    }
                  />
                  <DetailRow
                    label="Room"
                    value={
                      room?._id ? (
                        <Link
                          href={`/rooms/${room._id}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          Room {room.roomNumber ?? ''}
                        </Link>
                      ) : (
                        'No room'
                      )
                    }
                  />
                  <DetailRow label="Count on hand" value={String(asset.quantity ?? 0)} />
                  <DetailRow
                    label="Low stock threshold"
                    value={String(asset.lowStockThreshold ?? 0)}
                  />
                  <DetailRow label="Added" value={formatDateTime(asset.createdAt)} />
                  <DetailRow label="Last updated" value={formatDateTime(asset.updatedAt)} />
                </DetailList>
              </DetailCard>

              {/* The office actions of this module, on the page of the asset
                  they act on, with the rule the server applies to each. */}
              <DetailCard title="The office can act here" icon={<Wrench />}>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Change the state
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server writes the state and an update entry in the audit log. When the
                      state moves into under maintenance or damaged it pushes a service_update to
                      the active residents of the room, or of the floor when the asset hangs on a
                      floor. Moving back to available or in use tells nobody.
                    </p>
                    <div className="mt-2 space-y-2">
                      <Select
                        aria-label="The state of this asset"
                        size="compact"
                        options={[
                          { value: '', label: `Now: ${asset.status.replace(/_/g, ' ')}` },
                          ...STATUS_OPTIONS,
                        ]}
                        value={stateChoice}
                        onChange={(e) => setStateChoice(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={handleStateChange}
                        disabled={stateChoice === '' || busy !== ''}
                        loading={busy === 'state'}
                      >
                        Save the state
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Put it somewhere
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server writes the floor and the room and nothing else. The room you pick
                      decides who hears about this asset the next time it goes out of service; the
                      move itself is not announced.
                    </p>
                    <div className="mt-2 space-y-2">
                      <ResourceSelect
                        endpoint="floors"
                        value={floorChoice}
                        onChange={setFloorChoice}
                        placeholder="No floor"
                        valueKey="_id"
                        labelKey={floorLabel}
                        dataPath="data"
                      />
                      <ResourceSelect
                        endpoint="rooms?isActive=true"
                        value={roomChoice}
                        onChange={setRoomChoice}
                        placeholder="No room"
                        valueKey="_id"
                        labelKey={roomLabel}
                        sublabelFn={roomSublabel}
                        dataPath="data"
                      />
                      <Button
                        size="sm"
                        onClick={handlePlacementChange}
                        disabled={busy !== ''}
                        loading={busy === 'placement'}
                      >
                        Save the placement
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Record a service
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server writes the two dates. The next service date is what puts the asset
                      on the service due list thirty days before it falls due. Nobody is told.
                    </p>
                    <div className="mt-2 space-y-2">
                      <DatePicker
                        label="Last serviced"
                        value={servicedOn}
                        onChange={handleServicedChange}
                      />
                      <DatePicker
                        label="Next service"
                        value={nextServiceOn}
                        onChange={handleNextServiceChange}
                      />
                      <Button
                        size="sm"
                        onClick={handleServiceChange}
                        disabled={busy !== ''}
                        loading={busy === 'service'}
                      >
                        Save the service dates
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-(--color-text-primary)">
                      Adjust the count
                    </p>
                    <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                      The server writes the count and the threshold. The count is what the low stock
                      set is built from: an item at or below its threshold shows there, and a
                      retired item is not taken out of that set. Nobody is told.
                    </p>
                    <div className="mt-2 space-y-2">
                      <Input
                        label="Count on hand"
                        type="number"
                        min={0}
                        step={1}
                        value={countChoice}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setCountChoice(e.target.value)
                        }
                      />
                      <Input
                        label="Low stock threshold"
                        type="number"
                        min={0}
                        step={1}
                        value={thresholdChoice}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setThresholdChoice(e.target.value)
                        }
                      />
                      <Button
                        size="sm"
                        onClick={handleCountChange}
                        disabled={busy !== ''}
                        loading={busy === 'count'}
                      >
                        Save the count
                      </Button>
                    </div>
                  </div>

                  {asset.status !== 'retired' && (
                    <div>
                      <p className="text-xs font-bold text-(--color-text-primary)">Retire it</p>
                      <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                        The server keeps the record and sets its state to retired, so it leaves the
                        service due list. It writes an update entry in the audit log and sends no
                        message.
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        className="mt-2"
                        onClick={() => setRetireOpen(true)}
                      >
                        Retire this asset
                      </Button>
                    </div>
                  )}
                </div>
              </DetailCard>

              {/* Who hears about this asset. The truth, not a promise. */}
              <DetailCard title="Who hears about it" icon={<TriangleAlert />}>
                <p className="text-2xs font-medium text-(--color-text-secondary)">
                  {
                    'The asset model carries no owner, so there is nobody on the office side to notify. The ones affected are the residents of the room, or of the floor.'
                  }
                </p>
                <p className="text-2xs mt-2 font-medium text-(--color-text-secondary)">
                  {
                    'The server tells them once, and only once: when an edit moves the state into under maintenance or damaged, it pushes a service_update to the active residents of the room, or of the floor. A failed push never undoes the write.'
                  }
                </p>
                <p className="text-2xs mt-2 font-medium text-(--color-text-secondary)">
                  {
                    'It tells nobody when the asset is registered in that state, when the state moves back to available or in use, when the asset is retired, moved to another room, recounted or serviced. An asset with neither a room nor a floor has nobody to tell: the server writes the reason in its log and sends nothing.'
                  }
                </p>
              </DetailCard>
            </>
          }
        >
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
              {writeResult}
            </div>
          )}

          {(actionError || queryErrorMessage) && (
            <ErrorBanner message={actionError || queryErrorMessage} />
          )}

          {/* The protagonist of this module: the three questions the office
              asks about a thing the PG owns - can it be used, is it due, is it
              running out. */}
          <DetailCard
            title="The state of this asset"
            icon={<Boxes />}
            action={
              <StatusBadge
                variant={statusToVariant(asset.status)}
                label={asset.status.replace(/_/g, ' ')}
              />
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Can it be used
                </p>
                <p className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {asset.status === 'available'
                    ? 'Available'
                    : asset.status === 'in_use'
                      ? 'In use'
                      : asset.status === 'retired'
                        ? 'Retired, out of the register'
                        : 'Out of service'}
                </p>
                <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                  {asset.status === 'under_maintenance' || asset.status === 'damaged'
                    ? 'the residents of this place were told, if the push reached them'
                    : asset.status === 'retired'
                      ? 'nobody was told that it left the register'
                      : 'nobody is waiting on a message about this'}
                </p>
              </div>
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Is it due
                </p>
                <p className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {health?.label ?? '-'}
                </p>
                <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                  {asset.status === 'retired'
                    ? 'the service schedule is closed'
                    : asset.nextServiceDate
                      ? `the server has it due on ${formatShortDate(asset.nextServiceDate)}`
                      : 'the server holds no next service date for it'}
                </p>
              </div>
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Is it running out
                </p>
                <p className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {low ? 'Below its threshold' : 'Stock is fine'}
                </p>
                <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                  {`the server counts ${asset.quantity ?? 0} against a threshold of ${asset.lowStockThreshold ?? 0}`}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <AssetStockMeter quantity={asset.quantity} threshold={asset.lowStockThreshold} />
            </div>

            <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
              {room?._id ? (
                <>
                  {'This asset lives in '}
                  <Link
                    href={`/rooms/${room._id}`}
                    className="font-semibold text-(--color-brand-600) hover:underline"
                  >
                    {`Room ${room.roomNumber ?? ''}`}
                  </Link>
                  {floor?._id ? (
                    <>
                      {' on '}
                      <Link
                        href={`/floors/${floor._id}`}
                        className="font-semibold text-(--color-brand-600) hover:underline"
                      >
                        {floorText(asset) ?? 'its floor'}
                      </Link>
                    </>
                  ) : null}
                  {'. The room is the record that decides who hears about it.'}
                </>
              ) : floor?._id ? (
                <>
                  {'This asset hangs on '}
                  <Link
                    href={`/floors/${floor._id}`}
                    className="font-semibold text-(--color-brand-600) hover:underline"
                  >
                    {floorText(asset) ?? 'its floor'}
                  </Link>
                  {', so the residents of the whole floor are the ones it reaches.'}
                </>
              ) : (
                <>
                  {
                    'This asset is attached to neither a room nor a floor, so there is no resident to tell when it goes out of service. Give it a room or a floor to close that.'
                  }
                </>
              )}
            </p>
          </DetailCard>

          <DetailCard title="The dates and the service" icon={<CalendarClock />}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Purchased
                </p>
                <p className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {formatShortDate(asset.purchasedDate)}
                </p>
              </div>
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                  Last service
                </p>
                <p className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {formatShortDate(asset.lastServicedDate)}
                </p>
              </div>
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
                <div className="flex items-center justify-between">
                  <p className="text-2xs font-semibold tracking-wider text-(--color-text-muted) uppercase">
                    Next service
                  </p>
                  {health?.variant === 'danger' && (
                    <span className="text-3xs inline-flex items-center rounded-full bg-(--color-danger-100) px-1.5 py-0.5 font-semibold text-(--color-danger-700)">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="text-13 mt-0.5 font-semibold text-(--color-text-primary)">
                  {formatShortDate(asset.nextServiceDate)}
                </p>
                {asset.status !== 'retired' && (
                  <button
                    type="button"
                    onClick={() => router.push(`/assets/${asset._id}/edit`)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Reschedule the service
                  </button>
                )}
              </div>
            </div>
            <AssetServiceTimeline
              purchasedDate={asset.purchasedDate}
              lastServicedDate={asset.lastServicedDate}
              nextServiceDate={asset.nextServiceDate}
              status={asset.status}
              className="mt-5"
            />
          </DetailCard>

          {asset.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="text-sm leading-relaxed text-(--color-text-secondary)">{asset.notes}</p>
            </DetailCard>
          )}

          {/* What lives where this asset lives: the room's or the floor's
              other assets, read from the server's own list. */}
          <DetailCard
            title={room?._id ? 'The other assets of this room' : 'The other assets of this floor'}
            icon={<Boxes />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                {neighbours.length} of the {registerBody?.meta?.total ?? 0} assets
              </span>
            }
          >
            {!room?._id && !floor?._id ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                {
                  'This asset is attached to neither a room nor a floor, so it shares its place with nothing. Put it somewhere to see what else is there.'
                }
              </p>
            ) : neighbours.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                {`The server holds no other asset for this place in the first ${REGISTER_PAGE_SIZE} assets of the register.`}
              </p>
            ) : (
              <ul className="space-y-2">
                {neighbours.map((row) => (
                  <li key={row._id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/assets/${row._id}`}
                      className="text-xs font-semibold text-(--color-brand-600) hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="flex items-center gap-2">
                      <span className="text-2xs font-medium text-(--color-text-muted)">
                        {assetCategoryLabel(row.category)} · qty {row.quantity ?? '-'}
                      </span>
                      <StatusBadge
                        variant={statusToVariant(row.status)}
                        label={row.status.replace(/_/g, ' ')}
                        size="xs"
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
              {`The server serves at most ${REGISTER_PAGE_SIZE} assets in one page, so this is the first ${REGISTER_PAGE_SIZE} of the register narrowed to this place, and not the whole room.`}
            </p>
          </DetailCard>

          {/* The write trail of this asset: the proof of what the office did to
              it, and the only place a change that reached nobody shows up. */}
          <DetailCard
            title="What the office did to this asset"
            icon={<History />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                the newest {auditTrail?.length ?? 0} entries
              </span>
            }
          >
            {!auditTrail || auditTrail.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                {
                  'The server holds no write entry for this asset in the entries it keeps (the entries expire after 90 days).'
                }
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
                        {entry.timestamp ? formatDateTime(entry.timestamp) : 'no timestamp'}
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
        </ContentFrame>
      )}

      <ConfirmModal
        open={retireOpen}
        title="Retire this asset"
        message={retireMessage}
        confirmLabel="Retire it"
        loading={retiring}
        onConfirm={handleRetire}
        onCancel={() => setRetireOpen(false)}
      />
    </FormPage>
  );
}
