'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bell,
  CheckCircle2,
  FileText,
  FileUp,
  Info,
  Pencil,
  Scale,
  Send,
  Trash2,
  TriangleAlert,
  Users,
  Zap,
} from 'lucide-react';
import { lifecycleFor } from '@pg/types';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FormPage } from '@/components/ui/FormPage';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { clsx } from 'clsx';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /electricity/:id  apps/api/src/routes/electricity.ts:384-488

interface RoomEntry {
  roomId?:
    | string
    | {
        _id?: string;
        roomNumber?: string;
        sharingType?: number;
        floorId?: { label?: string; floorNumber?: number } | string | null;
      };
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  amount: number;
}

interface LinkedInvoice {
  _id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  roomNumber: string;
  /** The share the server wrote on the invoice. */
  electricityAmount: number;
  totalAmount: number;
  status: string;
  dueDate?: string;
}

interface ElectricityBillDetail {
  _id: string;
  month: string;
  totalBillAmount: number;
  /** The server's sum of the room amounts (computedRoomTotal). */
  computedRoomTotal?: number;
  /** The server's difference between the utility total and the room sum. */
  variance?: number;
  varianceReason?: string;
  roomEntries: RoomEntry[];
  status: string;
  notes?: string;
  billImageUrl?: string;
  billImagePublicId?: string | null;
  createdAt: string;
  updatedAt?: string;
  linkedInvoices?: LinkedInvoice[];
}

/** What the distribute route reports back (apps/api/src/routes/electricity.ts:922-936). */
interface DistributeResult {
  message?: string;
  distributed?: number;
  created?: number;
  updated?: number;
  errors?: number;
  fullyDistributed?: boolean;
}

// ── Vocabulary ─────────────────────────────────────────────────────────

/**
 * The three states of a bill, in the order the routes move them in.
 *
 * The enum is in the model (apps/api/src/models/electricityBill.ts:110-114),
 * the move from draft to finalized is POST /electricity/:id/finalize and the
 * move from finalized to distributed is POST /electricity/:id/distribute
 * (apps/api/src/routes/electricity.ts:644-937).
 */
/**
 * What each state means for the resident and for the office.
 *
 * The states themselves come from the shared lifecycle vocabulary
 * (packages/types/src/lifecycle.json), so the admin panel, the portal and the
 * contract all read the same three keys. Only the explanation is local.
 */
const BILL_STATE_RULES: Record<string, string> = {
  draft: 'The readings can still be edited. No resident is charged and nobody is told.',
  finalized:
    'The readings are locked and the server refuses any later edit. The bill is still on no invoice.',
  distributed:
    'The shares are on the resident invoices. The server refuses to edit or delete the bill.',
};

const BILL_STATES = lifecycleFor('electricity').steps.map((step) => ({
  key: step.key,
  label: step.label,
  rule: BILL_STATE_RULES[step.key] ?? '',
}));

const BILL_KEY = (id: string) => ['electricity', id] as const;
const ELECTRICITY_PREFIX = ['electricity'] as const;

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(value?: string): string {
  if (!value) return 'Not reported';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not reported';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function roomNumberOf(entry: RoomEntry): string {
  if (!entry.roomId || typeof entry.roomId === 'string') return 'Not reported';
  return entry.roomId.roomNumber ?? 'Not reported';
}

function roomHref(entry: RoomEntry): string | null {
  if (!entry.roomId || typeof entry.roomId === 'string') return null;
  const id = entry.roomId._id;
  return id ? `/rooms/${id}` : null;
}

function floorOf(entry: RoomEntry): string {
  if (!entry.roomId || typeof entry.roomId === 'string') return 'Not reported';
  const floor = entry.roomId.floorId;
  if (!floor || typeof floor === 'string') return 'Not reported';
  return floor.label ?? (floor.floorNumber != null ? `Floor ${floor.floorNumber}` : 'Not reported');
}

/**
 * The residents whose invoice carries a share, grouped by the room the server
 * recorded for them.
 *
 * A count of residents is not money, so the page never adds the shares up.
 */
function countResidentsByRoom(invoices: LinkedInvoice[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const invoice of invoices) {
    const key = invoice.roomNumber || 'Unassigned';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/**
 * The multipart body of the bill image upload.
 *
 * The route reads the file from the field named "file"
 * (apps/api/src/routes/electricity.ts:955-960).
 */
function formDataOf(file: File): FormData {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

/**
 * The progression of the bill, drawn as a progression.
 *
 * The shared stepper of the admin app cannot draw this one: the shared
 * vocabulary (packages/types/src/lifecycle.json) carries no electricity
 * domain, and adding one also regenerates the portal file, which is outside
 * this module. The three states and their order are the model's and the
 * routes', so the card cannot drift from what the server can do.
 */
function BillProgression({ status }: { status: string }) {
  const current = BILL_STATES.findIndex((state) => state.key === status);
  return (
    <ol className="space-y-3">
      {BILL_STATES.map((state, index) => {
        const reached = current >= 0 && index <= current;
        const isCurrent = index === current;
        return (
          <li key={state.key} className="flex items-start gap-3">
            <span
              aria-hidden
              className={clsx(
                'text-2xs mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold',
                isCurrent
                  ? 'bg-(--color-brand-500) text-(--color-on-brand)'
                  : reached
                    ? 'bg-(--color-success-500) text-(--color-on-success)'
                    : 'border border-(--border-color) bg-(--color-field-bg) text-(--color-text-muted)',
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p
                className={clsx(
                  'text-13 font-bold',
                  isCurrent ? 'text-(--color-text-primary)' : 'text-(--color-text-muted)',
                )}
              >
                {state.label}
                {isCurrent ? ' (this bill)' : ''}
              </p>
              <p className="text-2xs font-medium text-(--color-text-muted)">{state.rule}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

export default function ElectricityBillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState('');
  // Outcome of the last write, as the server reported it.
  const [writeResult, setWriteResult] = useState('');
  const [acting, setActing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: bill = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<ElectricityBillDetail>(BILL_KEY(params.id), `electricity/${params.id}`);
  const queryErrorMessage = errorMessage(queryError);

  /**
   * Re-read the bill and the ledger after a write, so the screen shows the
   * server state instead of a locally asserted outcome.
   */
  const refreshAfterMutation = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BILL_KEY(params.id) }),
      queryClient.invalidateQueries({ queryKey: ELECTRICITY_PREFIX }),
    ]);
  };

  const finalize = async () => {
    setActing(true);
    setActionError('');
    setWriteResult('');
    try {
      await api.post(`electricity/${params.id}/finalize`, { json: {} }).json();
      await refreshAfterMutation();
      setWriteResult(
        'Finalized. The server locked the readings, so the bill can no longer be edited. No resident is charged yet.',
      );
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setActing(false);
    }
  };

  const distribute = async () => {
    setActing(true);
    setActionError('');
    setWriteResult('');
    try {
      const res = await api
        .post(`electricity/${params.id}/distribute`, { json: {} })
        .json<{ success: boolean; data?: DistributeResult }>();
      const result = res.data;
      await refreshAfterMutation();
      setWriteResult(
        `Server report: ${result?.message ?? 'distribution finished'}. ` +
          `Residents charged: ${result?.distributed ?? 0}, invoices created: ${result?.created ?? 0}, ` +
          `invoices updated: ${result?.updated ?? 0}, errors: ${result?.errors ?? 0}. ` +
          (result?.fullyDistributed
            ? 'The bill reads distributed.'
            : 'The bill was left as finalized, so the run can be repeated.'),
      );
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setActing(false);
    }
  };

  const uploadBillImage = async (file: File) => {
    setUploadingImage(true);
    setActionError('');
    setWriteResult('');
    try {
      await api.post(`electricity/${params.id}/image`, { body: formDataOf(file) }).json();
      await refreshAfterMutation();
      setWriteResult('Bill image uploaded. The server stored it against this bill.');
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeBillImage = async () => {
    setUploadingImage(true);
    setActionError('');
    setWriteResult('');
    try {
      await api.delete(`electricity/${params.id}/image`).json();
      await refreshAfterMutation();
      setWriteResult('Bill image removed. The server no longer holds one for this bill.');
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setUploadingImage(false);
    }
  };

  const roomTotal = bill?.computedRoomTotal;
  const variance = bill?.variance;
  const hasVariance = typeof variance === 'number' && Math.abs(variance) > 0.5;
  const varianceReason = bill?.varianceReason?.trim() ?? '';
  const linkedInvoices = bill?.linkedInvoices ?? [];
  const chargedInvoices = linkedInvoices.filter((invoice) => invoice.electricityAmount > 0);
  const unchargedInvoices = linkedInvoices.filter((invoice) => invoice.electricityAmount <= 0);

  /**
   * The office cannot finalize a bill whose numbers do not add up.
   *
   * The server does not check the variance when it finalizes, so the rule is
   * enforced here and stated on the screen: the readings have to match the
   * utility total, or the office has to write down why they do not.
   */
  const finalizeBlocked = hasVariance && varianceReason === '';

  /**
   * The residents whose invoice carries a share, grouped by the room the
   * server recorded for them. A count of residents is not money, so the page
   * never adds the shares up.
   */
  const residentsByRoom = countResidentsByRoom(chargedInvoices);

  if (!isLoading && (queryErrorMessage || !bill)) {
    return (
      <FormPage
        title="Electricity Bill"
        description="Monthly multi-room bill"
        backHref="/electricity"
        error={queryErrorMessage || 'Electricity bill not found'}
        maxWidth="full"
      />
    );
  }

  const roomEntryColumns: DataTableColumn<RoomEntry>[] = [
    {
      header: 'Room',
      accessor: (entry) => {
        const href = roomHref(entry);
        return href ? (
          <Link href={href} className="font-semibold text-(--color-brand-600) hover:underline">
            {roomNumberOf(entry)}
          </Link>
        ) : (
          <span className="font-semibold text-(--color-text-primary)">{roomNumberOf(entry)}</span>
        );
      },
    },
    {
      header: 'Floor',
      accessor: (entry) => <span className="text-(--color-text-secondary)">{floorOf(entry)}</span>,
    },
    {
      header: 'Previous',
      accessor: (entry) => entry.previousReading,
    },
    {
      header: 'Current',
      accessor: (entry) => entry.currentReading,
    },
    {
      header: 'Units',
      accessor: (entry) => entry.unitsConsumed,
    },
    {
      header: 'Rate',
      accessor: (entry) => `₹${entry.ratePerUnit}`,
    },
    {
      header: 'Room amount',
      accessor: (entry) => (
        <span className="font-semibold text-(--color-text-primary) tabular-nums">
          {fmtMoney(entry.amount ?? 0)}
        </span>
      ),
    },
    {
      header: 'Residents charged',
      accessor: (entry) => {
        const count = residentsByRoom.get(roomNumberOf(entry));
        if (!count) {
          return (
            <span className="text-(--color-text-muted)">
              None
              <span className="text-2xs block">no invoice carries a share of this room</span>
            </span>
          );
        }
        return (
          <span className="text-(--color-text-primary)">
            {count}
            <span className="text-2xs block text-(--color-text-muted)">
              the server split this room between them
            </span>
          </span>
        );
      },
    },
  ];

  const linkedInvoiceColumns: DataTableColumn<LinkedInvoice>[] = [
    {
      header: 'Resident',
      accessor: (invoice) => (
        <Link
          href={`/tenants/${invoice.tenantId}`}
          className="font-semibold text-(--color-brand-600) hover:underline"
        >
          {invoice.tenantName}
        </Link>
      ),
    },
    {
      header: 'Room',
      accessor: (invoice) => (
        <span className="text-(--color-text-secondary)">
          {invoice.roomNumber ? `Room ${invoice.roomNumber}` : 'Not reported'}
        </span>
      ),
    },
    {
      header: 'Their share',
      accessor: (invoice) =>
        invoice.electricityAmount > 0 ? (
          <span className="font-semibold text-(--color-brand-600) tabular-nums">
            {fmtMoney(invoice.electricityAmount)}
          </span>
        ) : (
          <span className="text-(--color-warning-700)">
            No share
            <span className="text-2xs block">the server did not put one on this invoice</span>
          </span>
        ),
    },
    {
      header: 'Invoice',
      accessor: (invoice) => (
        <Link
          href={`/invoices/${invoice._id}`}
          className="font-mono text-xs font-bold text-(--color-brand-600) hover:underline"
        >
          {invoice.invoiceNumber}
        </Link>
      ),
    },
    {
      header: 'Invoice total',
      accessor: (invoice) => (
        <span className="font-semibold text-(--color-text-primary) tabular-nums">
          {fmtMoney(invoice.totalAmount)}
        </span>
      ),
    },
    {
      header: 'Invoice status',
      accessor: (invoice) => (
        <StatusBadge variant={statusToVariant(invoice.status)} label={invoice.status} />
      ),
    },
    {
      header: 'Due',
      accessor: (invoice) => formatDate(invoice.dueDate),
    },
  ];

  return (
    <FormPage
      title={bill ? `Electricity ${bill.month}` : 'Electricity Bill'}
      description="The month bill, the readings it was computed from and the share every resident carries"
      backHref="/electricity"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        bill ? (
          <StatusBadge
            variant={statusToVariant(bill.status)}
            label={bill.status ? bill.status.replace(/_/g, ' ') : 'Unknown'}
          />
        ) : undefined
      }
      actions={
        bill ? (
          <div className="flex flex-wrap items-center gap-2">
            {bill.status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/electricity/${bill._id}/edit`)}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
            {bill.status === 'draft' && (
              <Button size="sm" loading={acting} onClick={finalize} disabled={finalizeBlocked}>
                <CheckCircle2 className="h-4 w-4" /> Finalize
              </Button>
            )}
            {bill.status === 'finalized' && (
              <Button size="sm" loading={acting} onClick={distribute}>
                <Send className="h-4 w-4" /> Distribute
              </Button>
            )}
            {bill.status === 'distributed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/invoices?month=${bill.month}`)}
              >
                <FileText className="h-4 w-4" /> View Invoices
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {bill && (
        <div className="space-y-6">
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
              {writeResult}
            </div>
          )}
          <ErrorBanner message={actionError} />

          {finalizeBlocked && (
            <div className="flex items-start gap-3 rounded-(--radius-lg) border border-(--color-warning-300) bg-(--color-warning-50) p-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-(--color-warning-600)" />
              <div className="text-sm font-semibold text-(--color-warning-800)">
                <p>
                  The readings do not add up to the utility bill, so this bill cannot be finalized.
                </p>
                <p className="mt-1 text-xs font-medium text-(--color-warning-700)">
                  The difference is {fmtMoney(Math.abs(variance ?? 0))}. Write the reason in the
                  variance reason of the bill, or correct the readings, and the office can finalize
                  it. The server itself does not check this when it finalizes a bill.
                </p>
              </div>
            </div>
          )}

          <ContentFrame
            rail={
              <>
                <DetailCard title="The bill" icon={<Info />}>
                  <DetailList>
                    <DetailRow label="Month" value={bill.month} />
                    <DetailRow
                      label="State"
                      value={
                        <StatusBadge
                          variant={statusToVariant(bill.status)}
                          label={bill.status.replace(/_/g, ' ')}
                        />
                      }
                    />
                    <DetailRow label="Utility bill" value={fmtMoney(bill.totalBillAmount)} />
                    <DetailRow
                      label="Readings at the tariff"
                      value={typeof roomTotal === 'number' ? fmtMoney(roomTotal) : 'Not reported'}
                    />
                    <DetailRow
                      label="Difference"
                      value={
                        typeof variance === 'number' ? (
                          <span
                            className={clsx(
                              'tabular-nums',
                              hasVariance
                                ? 'text-(--color-warning-700)'
                                : 'text-(--color-success-700)',
                            )}
                          >
                            {fmtMoney(variance)}
                          </span>
                        ) : (
                          'Not reported'
                        )
                      }
                    />
                    <DetailRow label="Rooms" value={String(bill.roomEntries?.length ?? 0)} />
                    <DetailRow
                      label="Residents charged"
                      value={
                        bill.status === 'distributed'
                          ? String(chargedInvoices.length)
                          : 'Not distributed yet'
                      }
                    />
                    <DetailRow label="Recorded" value={formatDate(bill.createdAt)} />
                    <DetailRow label="Last change" value={formatDate(bill.updatedAt)} />
                  </DetailList>
                </DetailCard>

                <DetailCard title="Office actions" icon={<Zap />}>
                  <div className="flex flex-col gap-3">
                    {bill.status === 'draft' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => router.push(`/electricity/${bill._id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" /> Edit the readings
                        </Button>
                        <Button
                          variant="primary"
                          loading={acting}
                          onClick={finalize}
                          disabled={finalizeBlocked}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Finalize
                        </Button>
                      </>
                    )}
                    {bill.status === 'finalized' && (
                      <Button variant="primary" loading={acting} onClick={distribute}>
                        <Send className="h-4 w-4" /> Distribute the shares
                      </Button>
                    )}
                    {bill.status === 'distributed' && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/invoices?month=${bill.month}`)}
                      >
                        <FileText className="h-4 w-4" /> View the invoices of the month
                      </Button>
                    )}
                  </div>
                  <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                    {bill.status === 'draft'
                      ? 'The server refuses to edit or delete a finalized bill, and it refuses to delete a distributed one.'
                      : bill.status === 'finalized'
                        ? 'The readings are locked. The server refuses any edit from here on.'
                        : 'The shares are on the resident invoices. The server refuses to edit or delete this bill.'}
                  </p>
                </DetailCard>

                <DetailCard title="What the residents are told" icon={<Bell />}>
                  {bill.status === 'distributed' ? (
                    <>
                      <p className="text-xs font-medium text-(--color-text-secondary)">
                        Every resident the server charged receives an electricity_bill notification
                        with their share and the month.
                      </p>
                      {unchargedInvoices.length > 0 && (
                        <p className="text-2xs mt-2 font-medium text-(--color-warning-700)">
                          {unchargedInvoices.length} invoice(s) of this bill carry no share: the
                          server skips a cancelled invoice and an invoice that is already paid and
                          already carries electricity, and it counts neither the charge nor an
                          error. Those residents are not told and are not charged.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs font-medium text-(--color-text-secondary)">
                      Nobody is told yet. The notification goes out when the shares are distributed,
                      not when the readings are entered or the bill is finalized.
                    </p>
                  )}
                </DetailCard>
              </>
            }
          >
            {/* Where the bill stands, and what each step means. */}
            <DetailCard title="Bill progress" icon={<CheckCircle2 />}>
              <BillProgression status={bill.status} />
            </DetailCard>

            {/* The question this module exists to answer: do the numbers add
                up? The three numbers are the server's, and the page says when
                they do not. */}
            <DetailCard title="Do the numbers add up" icon={<Scale />}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) p-3">
                  <p className="text-2xs font-semibold text-(--color-text-muted) uppercase">
                    Utility bill
                  </p>
                  <p className="font-display text-15 font-bold text-(--color-text-primary) tabular-nums">
                    {fmtMoney(bill.totalBillAmount)}
                  </p>
                </div>
                <div className="rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) p-3">
                  <p className="text-2xs font-semibold text-(--color-text-muted) uppercase">
                    Readings at the tariff
                  </p>
                  <p className="font-display text-15 font-bold text-(--color-text-primary) tabular-nums">
                    {typeof roomTotal === 'number' ? fmtMoney(roomTotal) : 'Not reported'}
                  </p>
                </div>
                <div
                  className={clsx(
                    'rounded-(--radius-md) border p-3',
                    hasVariance
                      ? 'border-(--color-warning-300) bg-(--color-warning-50)'
                      : 'border-(--color-success-200) bg-(--color-success-50)',
                  )}
                >
                  <p className="text-2xs font-semibold text-(--color-text-muted) uppercase">
                    Difference
                  </p>
                  <p
                    className={clsx(
                      'font-display text-15 font-bold tabular-nums',
                      hasVariance ? 'text-(--color-warning-800)' : 'text-(--color-success-700)',
                    )}
                  >
                    {typeof variance === 'number' ? fmtMoney(variance) : 'Not reported'}
                  </p>
                </div>
              </div>

              <p
                className={clsx(
                  'mt-3 text-xs font-semibold',
                  hasVariance ? 'text-(--color-warning-800)' : 'text-(--color-success-700)',
                )}
              >
                {typeof variance !== 'number'
                  ? 'The server did not report a difference for this bill.'
                  : hasVariance
                    ? `The readings do not add up to the utility bill: they are ${fmtMoney(
                        Math.abs(variance),
                      )} apart.`
                    : 'The readings add up to the utility bill.'}
              </p>
              {hasVariance && (
                <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                  Reason written by the office: {varianceReason || 'none'}. The server records the
                  difference and the reason, and it refuses a bill whose readings are more than
                  ₹10,000 apart from the total when the bill is saved.
                </p>
              )}
            </DetailCard>

            {/* The readings the bill was computed from, per room. */}
            <DetailCard title="Room readings" icon={<Zap />}>
              <DataTable
                columns={roomEntryColumns}
                data={bill.roomEntries ?? []}
                keyExtractor={(entry: RoomEntry) => {
                  const id =
                    typeof entry.roomId === 'object' && entry.roomId
                      ? entry.roomId._id
                      : String(entry.roomId ?? 'room');
                  return `${id}-${entry.currentReading}-${entry.previousReading}`;
                }}
              />
              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                The meter readings, the units and the rate are the server's, and so is the room
                amount: the model computes it from the readings when the bill is saved
                (apps/api/src/models/electricityBill.ts:138-148). The server splits a room amount
                between the residents who were in that room during the billing month, and the share
                each of them carries is the number in the table below.
              </p>
            </DetailCard>

            {/* What the bill produced: the share every resident carries and the
                invoice it became. */}
            <DetailCard title="What each resident pays" icon={<Users />}>
              {linkedInvoices.length > 0 ? (
                <>
                  <DataTable
                    columns={linkedInvoiceColumns}
                    data={linkedInvoices}
                    keyExtractor={(invoice: LinkedInvoice) => invoice._id}
                  />
                  <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                    The shares and the invoice totals are the server&apos;s. A share is what the
                    bill put on that resident&apos;s invoice, and the invoice is where the money now
                    lives. The server distributes the bill to the residents who were in the room
                    during the billing month, so an invoice of somebody else carries no share.
                  </p>
                  <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                    The share lands on the invoice of the bill&apos;s own month. The invoice of that
                    month is issued on the 1st and is due on the 5th, so a bill distributed after
                    the month closed reaches a resident whose invoice is already due.
                  </p>
                </>
              ) : (
                <p className="text-xs font-medium text-(--color-text-secondary)">
                  {bill.status === 'distributed'
                    ? 'The server reports no invoice for the residents of these rooms for this month. The bill reads distributed, so nothing was charged to anybody.'
                    : 'The bill is not distributed yet, so no invoice carries a share of it. The residents are charged when the bill is distributed.'}
                </p>
              )}
            </DetailCard>

            {bill.billImageUrl ? (
              <DetailCard title="Bill image" icon={<FileText />}>
                <div className="space-y-3">
                  <div className="max-w-sm overflow-hidden rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-50)">
                    {/\.(pdf)(\?|$)/i.test(bill.billImageUrl) ? (
                      <div className="flex items-center gap-2 p-4 text-sm">
                        <FileText className="h-4 w-4" />
                        <a
                          href={bill.billImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          Open bill PDF in new tab
                        </a>
                      </div>
                    ) : (
                      <Image
                        src={bill.billImageUrl}
                        alt={`Electricity bill for ${bill.month}`}
                        width={640}
                        height={480}
                        unoptimized
                        className="max-h-64 w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={bill.billImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold break-all text-(--color-brand-600) hover:underline"
                    >
                      Open original in new tab
                    </a>
                    {bill.status === 'draft' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={uploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <FileUp className="h-3.5 w-3.5" /> Replace file
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={uploadingImage}
                          onClick={() => void removeBillImage()}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </DetailCard>
            ) : (
              bill.status === 'draft' && (
                <DetailCard title="Bill image" icon={<FileText />}>
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-(--color-text-muted)">
                      Upload a photo or PDF of the utility bill as proof. Stored on Cloudinary when
                      configured.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileUp className="h-3.5 w-3.5" /> Upload bill image
                    </Button>
                  </div>
                </DetailCard>
              )
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              disabled={uploadingImage}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setActionError('Bill image must be under 5MB.');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  return;
                }
                void uploadBillImage(file);
              }}
            />

            {bill.notes && (
              <DetailCard title="Notes" icon={<FileText />}>
                <p className="text-sm text-(--color-text-primary)">{bill.notes}</p>
              </DetailCard>
            )}
          </ContentFrame>
        </div>
      )}
    </FormPage>
  );
}
