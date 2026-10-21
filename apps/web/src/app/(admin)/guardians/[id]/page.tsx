'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  Mail,
  Pencil,
  Shield,
  Home,
  BedDouble,
  Building2,
  Calendar,
  Plus,
  Power,
  UserRound,
  Users,
  Receipt,
  Copy,
  MessageCircle,
  Info,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { TenantStayCalendar, type StayCalendarEvent } from '@/components/ui/TenantStayCalendar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { surfaceCardClass } from '@/lib/field-styles';
import { copyToClipboard, generateWhatsAppUrl } from '@/lib/whatsapp';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /guardians/:id          apps/api/src/routes/guardians.ts:442-467
//   GET /tenants/:id            apps/api/src/routes/tenants.ts:486-500
//   GET /tenants/:id/dues       apps/api/src/routes/tenants.ts:1919-1929
//   GET /tenants/:id/invoices   apps/api/src/routes/tenants.ts:1775-1796
//   GET /guardians?tenantId=    apps/api/src/routes/guardians.ts:241-286

interface GuardianDetail {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
  tenantId?: string;
  tenant?: {
    _id: string;
    bedId?: string | null;
    isActive?: boolean | null;
    user?: { _id: string; name: string; email: string; phone: string } | null;
    room?: { _id: string; roomNumber: string; floor?: { label?: string } | null } | null;
  } | null;
  isEmergencyContact: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WardTenant {
  _id: string;
  moveInDate?: string;
  moveOutDate?: string | null;
  isActive?: boolean;
  monthlyRent?: number;
  depositPaid?: number;
  bedId?: string;
  room?: { _id?: string; roomNumber?: string; floor?: { label?: string } | null } | null;
}

/** The dues of the ward, as the server computes them. */
interface WardDues {
  totalDue?: number;
  unpaidInvoices?: Array<{
    _id: string;
    invoiceNumber?: string;
    month?: string;
    totalAmount?: number;
    paidAmount?: number;
    remaining?: number | null;
    status?: string;
    dueDate?: string | null;
  }>;
  electricityDues?: number;
  depositHeld?: number;
  pendingPayments?: number;
  checkedOut?: boolean;
}

/** One invoice of the ward, with the server-computed money fields. */
interface WardInvoice {
  _id: string;
  invoiceNumber?: string;
  month?: string;
  totalAmount?: number;
  paidAmount?: number;
  balance?: number | null;
  status?: string;
  dueDate?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * The oldest cycle the ward still owes.
 *
 * The month is a label, not an amount: the server reports the month of every open invoice and
 * the oldest one is the earliest month in that list. No money is derived here.
 */
function oldestOpenCycle(invoices: Array<{ month?: string }>): string | null {
  const months = invoices
    .map((invoice) => invoice.month)
    .filter((month): month is string => typeof month === 'string' && month.length > 0);
  if (months.length === 0) return null;
  return months.slice().sort()[0] ?? null;
}

const GUARDIAN_KEY = ['guardians', 'detail'] as const;
const WARD_KEY = ['guardians', 'ward'] as const;
const WARD_DUES_KEY = ['guardians', 'ward-dues'] as const;
const WARD_INVOICES_KEY = ['guardians', 'ward-invoices'] as const;
const WARD_CONTACTS_KEY = ['guardians', 'by-ward'] as const;

export default function GuardianDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const id = params?.id ?? '';
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  const guardianQuery = useApiQuery<GuardianDetail>([...GUARDIAN_KEY, id], `guardians/${id}`, {
    enabled: Boolean(id),
  });
  const guardian = guardianQuery.data ?? null;
  const isLoading = guardianQuery.isPending;
  const loadError = errorMessage(guardianQuery.error);

  const wardId = guardian?.tenant?._id ?? guardian?.tenantId ?? '';

  /**
   * The resident the contact pays for, and the money of that resident.
   *
   * The server owns every number: GET /tenants/:id/dues is the same summary the resident reads
   * on their phone and the same one the checkout guard uses.
   */
  const { data: ward, isPending: wardPending } = useApiQuery<WardTenant>(
    [...WARD_KEY, wardId],
    `tenants/${wardId}`,
    { enabled: Boolean(wardId) },
  );
  const { data: dues, isPending: duesPending } = useApiQuery<WardDues>(
    [...WARD_DUES_KEY, wardId],
    `tenants/${wardId}/dues`,
    { enabled: Boolean(wardId) },
  );
  const { data: invoices } = useApiBodyQuery<{ data: WardInvoice[] }>(
    [...WARD_INVOICES_KEY, wardId],
    `tenants/${wardId}/invoices`,
    { enabled: Boolean(wardId) },
  );

  /**
   * The other contacts of the same resident.
   *
   * A resident can have more than one person standing behind them. The server holds them all
   * under the resident, so the office sees the whole set from one place.
   */
  const { data: wardContacts } = useApiBodyQuery<{ data: GuardianDetail[] }>(
    [...WARD_CONTACTS_KEY, wardId],
    `guardians?tenantId=${wardId}&limit=50`,
    { enabled: Boolean(wardId) },
  );

  const wardInvoiceRows = Array.isArray(invoices?.data) ? invoices.data : [];
  const contactRows = Array.isArray(wardContacts?.data) ? wardContacts.data : [];
  const otherContacts = contactRows.filter((row) => row._id !== id);

  const reportedTotalDue = dues && typeof dues.totalDue === 'number' ? dues.totalDue : null;
  const openInvoices = dues && Array.isArray(dues.unpaidInvoices) ? dues.unpaidInvoices : [];
  const unknownBalance = openInvoices.some((invoice) => invoice.remaining == null);
  const oldestCycle = oldestOpenCycle(openInvoices);

  const calendarEvents: StayCalendarEvent[] = wardInvoiceRows
    .filter((invoice) => invoice.dueDate)
    .map((invoice) => ({
      date: String(invoice.dueDate).slice(0, 10),
      type: 'invoice' as const,
      title: `Invoice ${invoice.month ?? ''}`,
      subtitle: typeof invoice.totalAmount === 'number' ? fmtMoney(invoice.totalAmount) : undefined,
      id: invoice._id,
    }));

  const refreshAfterWrite = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: GUARDIAN_KEY }),
      queryClient.invalidateQueries({ queryKey: WARD_KEY }),
      queryClient.invalidateQueries({ queryKey: WARD_DUES_KEY }),
      queryClient.invalidateQueries({ queryKey: WARD_INVOICES_KEY }),
      queryClient.invalidateQueries({ queryKey: WARD_CONTACTS_KEY }),
      queryClient.invalidateQueries({ queryKey: ['guardians', 'list'] }),
    ]);
  };

  /**
   * Switch the contact off, or back on.
   *
   * The server keeps the record either way. Switching off also switches off the portal login
   * of that person; switching back on gives the login back. Nobody is told either way.
   */
  const handleToggleActive = async (nextActive: boolean) => {
    if (!guardian) return;
    setWorking(true);
    setError('');
    try {
      await api.put(`guardians/${guardian._id}`, { json: { isActive: nextActive } }).json();
      setConfirming(false);
      await refreshAfterWrite();
      setWriteResult(
        nextActive
          ? 'The contact is live again. The server reports the guardian as active and the portal login of that person works again. The person was not told: they find out when they sign in.'
          : 'The contact is switched off. The server kept the record, set the active flag to false, switched off the portal login of that person and wrote an update entry in the audit log. The resident was not told and the guardian was not told.',
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setWorking(false);
    }
  };

  if (!isLoading && (loadError || !guardian)) {
    return (
      <FormPage
        title="Guardian Details"
        description="View guardian information"
        backHref="/guardians"
        error={loadError || 'The server holds no guardian with that id.'}
        maxWidth="full"
      />
    );
  }

  const residentName = guardian?.tenant?.user?.name ?? 'the resident';

  /**
   * The rent and the deposit the server holds for the resident.
   *
   * Both numbers are the server's. A value the server did not report is named, never
   * read as zero.
   */
  const rentText =
    typeof ward?.monthlyRent === 'number' ? `${fmtMoney(ward.monthlyRent)}/mo` : 'not reported';
  const depositText =
    typeof ward?.depositPaid === 'number' ? fmtMoney(ward.depositPaid) : 'not reported';
  const moneyLine = `${rentText} · deposit ${depositText} held`;

  return (
    <FormPage
      title={guardian?.name ?? 'Guardian Details'}
      description={
        guardian
          ? `The contact for ${residentName} - ${guardian.relation}`
          : 'The contact for a resident'
      }
      backHref="/guardians"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        guardian ? (
          <StatusBadge
            variant={statusToVariant(guardian.isActive ? 'active' : 'inactive')}
            label={guardian.isActive ? 'Reachable' : 'Switched off'}
          />
        ) : undefined
      }
      actions={
        guardian ? (
          <div className="flex flex-wrap items-center gap-2">
            {guardian.tenant?._id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/guardians/new?tenantId=${guardian.tenant!._id}`)}
              >
                <Plus className="h-4 w-4" />
                Add a contact for this resident
              </Button>
            )}
            {guardian.isActive ? (
              <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                <Power className="h-4 w-4" />
                Switch the contact off
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={working}
                onClick={() => void handleToggleActive(true)}
              >
                <Power className="h-4 w-4" />
                Switch the contact back on
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/guardians/${guardian._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      {guardian && (
        <div className="space-y-6">
          <ErrorBanner message={error} />

          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
              {writeResult}
            </div>
          )}

          {/* ── The protagonist: the contact, and the money it stands behind ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className={`${surfaceCardClass} p-5 lg:col-span-2`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold tracking-tight text-(--color-text-primary)">
                    {guardian.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-(--color-text-secondary)">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {guardian.phone}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {guardian.email ?? 'No email on file'}
                    </span>
                  </div>
                </div>
                <StatusBadge
                  variant={statusToVariant(guardian.isActive ? 'active' : 'inactive')}
                  label={guardian.isActive ? 'Reachable' : 'Switched off'}
                />
              </div>

              <DetailList className="mt-4">
                <DetailRow
                  label="Relation to the resident"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <span className="capitalize">{guardian.relation}</span>
                      {guardian.isEmergencyContact && (
                        <StatusBadge variant="danger" label="Emergency contact" size="xs" />
                      )}
                    </span>
                  }
                />
                <DetailRow
                  label="Portal login"
                  value={
                    guardian.isActive
                      ? 'The login of this person works: they can sign in and see the resident they pay for.'
                      : 'The login of this person is switched off: they cannot sign in to the portal.'
                  }
                />
                <DetailRow label="Added" value={formatDateTime(guardian.createdAt)} />
                <DetailRow label="Last change" value={formatDateTime(guardian.updatedAt)} />
              </DetailList>
            </div>

            {/* The money number of the record: the server's dues summary for the
                resident this contact pays for. */}
            <div className={`${surfaceCardClass} p-5`}>
              <p className="tracking-label text-xs font-semibold text-(--color-text-muted) uppercase">
                What the ward owes
              </p>
              {!wardId ? (
                <p className="mt-2 text-sm font-semibold text-(--color-text-muted)">
                  No resident on this record
                </p>
              ) : duesPending ? (
                <p className="mt-2 text-sm font-semibold text-(--color-text-muted)">
                  reading the server&apos;s dues...
                </p>
              ) : reportedTotalDue === null ? (
                <p className="mt-2 text-sm font-semibold text-(--color-text-muted)">Not reported</p>
              ) : (
                <p
                  className={`font-display text-xl font-bold tracking-tight tabular-nums ${
                    reportedTotalDue > 0
                      ? 'text-(--color-danger-700)'
                      : 'text-(--color-success-700)'
                  }`}
                >
                  {fmtMoney(reportedTotalDue)}
                </p>
              )}
              {unknownBalance && (
                <p className="text-2xs mt-1 font-semibold text-(--color-warning-700)">
                  The server holds an open invoice whose total it does not know. That amount is
                  outstanding, never zero, and it is missing from the sum above.
                </p>
              )}
              <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                The server&apos;s dues summary for {residentName}. The resident reads the same
                summary on their phone, and so does this contact.
              </p>
              <div className="text-2xs mt-3 space-y-1 font-medium text-(--color-text-secondary)">
                <p>Open invoices: {duesPending ? 'reading' : String(openInvoices.length)}</p>
                <p>Oldest open cycle: {duesPending ? 'reading' : (oldestCycle ?? 'none')}</p>
                <p>
                  Unresolved payments:{' '}
                  {duesPending ? 'reading' : String(dues?.pendingPayments ?? 0)}
                </p>
              </div>
              {wardId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push(`/invoices?tenantId=${wardId}`)}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Open the bills in the ledger
                </Button>
              )}
            </div>
          </div>

          {/* ── The resident this contact stands behind ── */}
          <DetailCard
            title="The resident they pay for"
            icon={<UserRound />}
            action={
              guardian.tenant?._id ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/tenants/${guardian.tenant!._id}`)}
                >
                  Open the resident
                </Button>
              ) : null
            }
          >
            {!guardian.tenant ? (
              <div className="space-y-2">
                <p className="text-sm text-(--color-text-muted)">
                  This contact has no resident on its record. The server holds a resident id on
                  every guardian, so the resident it points at was deleted without this contact
                  being switched off.
                </p>
                <p className="text-2xs font-medium text-(--color-text-muted)">
                  The contact keeps its name, its number and its history. The office decides what to
                  do with it: switch it off, or leave it for the record.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <DetailList>
                  <DetailRow
                    label="Resident"
                    value={
                      guardian.tenant._id ? (
                        <Link
                          href={`/tenants/${guardian.tenant._id}`}
                          className="text-(--color-brand-600) hover:underline"
                        >
                          {guardian.tenant.user?.name ?? 'Open the resident'}
                        </Link>
                      ) : (
                        (guardian.tenant.user?.name ?? 'Unknown')
                      )
                    }
                  />
                  <DetailRow
                    label="Room and bed"
                    value={
                      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                        {guardian.tenant.room && (
                          <span className="inline-flex items-center gap-1">
                            <Home className="h-3 w-3 text-(--color-text-muted)" />
                            Room {guardian.tenant.room.roomNumber}
                          </span>
                        )}
                        {guardian.tenant.bedId && (
                          <span className="inline-flex items-center gap-1">
                            <BedDouble className="h-3 w-3 text-(--color-text-muted)" />
                            Bed {guardian.tenant.bedId}
                          </span>
                        )}
                        {guardian.tenant.room?.floor?.label && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-(--color-text-muted)" />
                            {guardian.tenant.room.floor.label}
                          </span>
                        )}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Stay"
                    value={
                      guardian.tenant.isActive === false ? (
                        <span>
                          The stay is over
                          {ward?.moveOutDate ? ` (${formatDate(ward.moveOutDate)})` : ''}
                        </span>
                      ) : ward?.moveInDate ? (
                        <span>Since {formatDate(ward.moveInDate)}</span>
                      ) : (
                        <span>The resident lives here</span>
                      )
                    }
                  />
                  <DetailRow
                    label="Rent and deposit"
                    value={<span className="tabular-nums">{moneyLine}</span>}
                  />
                </DetailList>

                <div>
                  <p className="text-2xs font-medium text-(--color-text-muted)">
                    The money of this resident belongs to the ledger: the bills are raised from the
                    rent on the resident record and the payments are recorded against the bill. What
                    this page shows is what the resident owes, read from the server.
                  </p>
                  {wardPending ? (
                    <p className="text-sm text-(--color-text-muted)">Reading the resident...</p>
                  ) : (
                    <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                      {ward?.isActive === false
                        ? 'The stay of this resident is over: the server keeps no open invoice for a resident whose stay is over, so nothing is owed here.'
                        : 'The resident is in house. The bills below are the ones the server holds for them.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </DetailCard>

          {/* ── The invoices behind the dues ── */}
          <DetailCard title="The invoices behind it" icon={<Receipt />}>
            {wardInvoiceRows.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-(--color-text-muted)">
                  The server holds no invoice for this resident.
                </p>
                {wardId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/invoices/new?tenantId=${wardId}`)}
                  >
                    Raise the first bill
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {wardInvoiceRows.map((invoice) => (
                  <Link
                    key={invoice._id}
                    href={`/invoices/${invoice._id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-color) px-2.5 py-1.5 text-xs font-semibold text-(--color-text-secondary) hover:border-(--color-brand-300)"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-(--color-brand-700)">
                        {invoice.invoiceNumber ?? invoice._id.slice(-6)}
                      </span>
                      {invoice.month && (
                        <span className="text-(--color-text-muted)">{invoice.month}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="tabular-nums">
                        {typeof invoice.totalAmount === 'number'
                          ? fmtMoney(invoice.totalAmount)
                          : 'total not reported'}
                      </span>
                      {typeof invoice.balance === 'number' && invoice.balance > 0 && (
                        <span className="text-2xs font-semibold text-(--color-danger-700) tabular-nums">
                          {fmtMoney(invoice.balance)} due
                        </span>
                      )}
                      {invoice.balance == null && (
                        <span className="text-2xs font-semibold text-(--color-warning-700)">
                          balance not reported
                        </span>
                      )}
                      {invoice.status && (
                        <StatusBadge
                          variant={statusToVariant(invoice.status)}
                          label={invoice.status.replace(/_/g, ' ')}
                          size="xs"
                        />
                      )}
                      <ExternalLink className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    </span>
                  </Link>
                ))}
                <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                  The balance of each invoice is the server&apos;s own number (the settled sum of
                  the paid payments against the total). An invoice whose total the server does not
                  know carries no balance: it is outstanding, never settled.
                </p>
              </div>
            )}
          </DetailCard>

          {/* ── The other contacts of the same resident ── */}
          <DetailCard title="The other contacts of this resident" icon={<Users />}>
            {otherContacts.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-(--color-text-muted)">
                  No other contact stands behind this resident.
                </p>
                {wardId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/guardians/new?tenantId=${wardId}`)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add a contact for this resident
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {otherContacts.map((contact) => (
                  <button
                    key={contact._id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-color) px-3 py-2 text-left text-sm hover:bg-(--color-field-bg)"
                    onClick={() => router.push(`/guardians/${contact._id}`)}
                  >
                    <span>
                      <span className="font-semibold text-(--color-text-primary)">
                        {contact.name}
                      </span>
                      <span className="ml-2 text-xs text-(--color-text-muted) capitalize">
                        {contact.relation ?? ''}
                      </span>
                      {contact.isActive === false && (
                        <span className="text-2xs ml-2 font-semibold text-(--color-warning-700)">
                          portal off
                        </span>
                      )}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-(--color-text-muted)" />
                  </button>
                ))}
                {wardId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/guardians?tenantId=${wardId}`)}
                  >
                    View every contact of this resident
                  </Button>
                )}
              </div>
            )}
          </DetailCard>

          {/* ── The stay of the resident, with the bills that fall in it ── */}
          {guardian.tenant && (
            <DetailCard title="The stay and the bills in it" icon={<Calendar />}>
              <TenantStayCalendar
                moveInDate={ward?.moveInDate}
                moveOutDate={ward?.moveOutDate}
                events={calendarEvents}
              />
              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                The stay starts on the move-in date the server holds. The marks are the bills of
                this resident on their due date.
              </p>
            </DetailCard>
          )}

          {/* ── What the office can do from here ── */}
          <DetailCard title="What the office can do from here" icon={<Shield />}>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  const p = guardian.phone;
                  window.open(
                    generateWhatsAppUrl(
                      p,
                      `Hello ${guardian.name}, this is the PG office about ${residentName}.`,
                    ),
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp the contact
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void copyToClipboard(
                    `${guardian.name} | ${guardian.relation} | ${guardian.phone} | ${guardian.email ?? 'no email'} | ward: ${residentName}`,
                  )
                }
              >
                <Copy className="h-4 w-4" />
                Copy the contact
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/guardians/${guardian._id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
                Change the contact
              </Button>
              {wardId && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/payments/new?tenantId=${wardId}`)}
                >
                  Record a payment for the resident
                </Button>
              )}
            </div>
            <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
              <Info className="mr-1 inline h-3 w-3" />
              The contact itself is not a payer account: the money of the resident is raised on the
              resident record, and a payment is recorded against a bill. The contact sees the
              resident&apos;s dues in the portal, it does not pay from the portal.
            </p>
          </DetailCard>
        </div>
      )}

      <ConfirmModal
        open={confirming}
        title="Switch the contact off"
        message={`The server keeps the record of "${guardian?.name ?? ''}", sets its active flag to false, switches off the portal login of that person and writes an update entry in the audit log. The resident is not told and the guardian is not told. You can switch the contact back on from this page at any time.`}
        confirmLabel="Switch it off"
        loading={working}
        onConfirm={() => void handleToggleActive(false)}
        onCancel={() => setConfirming(false)}
      />
    </FormPage>
  );
}
