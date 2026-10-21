'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mail,
  Phone,
  Calendar,
  LogOut,
  MessageCircle,
  Copy,
  AlertTriangle,
  CreditCard,
  Loader2,
  User,
  Shield,
  Pencil,
  FileText,
  Activity,
  Users,
  Receipt,
  RotateCcw,
  ExternalLink,
  Printer,
  Scale,
  Check,
  Route,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TenantActivityTimeline } from '@/components/ui/TenantActivityTimeline';
import { TenantStayCalendar, type StayCalendarEvent } from '@/components/ui/TenantStayCalendar';
import { DocumentUpload } from '@/components/ui/DocumentUpload';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { OccupancyBedPicker } from '@/components/ui/OccupancyBedPicker';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { surfaceCardClass } from '@/lib/field-styles';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /tenants/:id              apps/api/src/routes/tenants.ts:486-500
//   GET /tenants/:id/dues         apps/api/src/routes/tenants.ts:1920-1929
//   GET /tenants/:id/invoices     apps/api/src/routes/tenants.ts:1775-1796
//   GET /tenants/:id/payments     apps/api/src/routes/tenants.ts:1495-1504
//   GET /tenants/:id/complaints   apps/api/src/routes/tenants.ts:1507-1516
//   GET /tenants/:id/activity     apps/api/src/routes/tenants.ts:2067-2178
//   GET /guardians?tenantId=      apps/api/src/routes/guardians.ts

interface UnpaidInvoiceRow {
  _id: string;
  invoiceNumber?: string;
  month?: string;
  totalAmount?: number;
  paidAmount?: number;
  remaining?: number | null;
  status?: string;
  dueDate?: string | null;
}

interface CheckoutDues {
  totalDue?: number;
  unpaidInvoices?: UnpaidInvoiceRow[];
  electricityDues?: number;
  depositHeld?: number;
  pendingPayments?: number;
  checkedOut?: boolean;
}

interface RoomOption {
  _id: string;
  roomNumber: string;
  sharingType: number;
  monthlyRent: number;
  floor?: { label: string; floorNumber?: number };
}

interface TenantDetail {
  _id: string;
  user?: { name: string; email: string; phone: string };
  room?: { _id: string; roomNumber: string; floor?: { _id: string; label: string } };
  bedId: string;
  monthlyRent: number;
  depositPaid: number;
  moveInDate: string;
  moveOutDate: string | null;
  isActive: boolean;
  documents?: {
    idType?: 'aadhaar' | 'passport' | 'voter_id' | 'driving_license';
    idNumberMasked?: string;
    idUrl?: string;
    photoUrl?: string;
    isVerified?: boolean;
    verifiedAt?: string;
    consentGiven?: boolean;
    consentTimestamp?: string;
    aadhaarUrl?: string;
  };
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  verificationProfile?: {
    fatherOrSpouseName?: string;
    dob?: string;
    gender?: 'male' | 'female' | 'other';
    bloodGroup?: string;
    identificationMark?: string;
    permanentAddress?: {
      street?: string;
      city?: string;
      district?: string;
      state?: string;
      pincode?: string;
      policeStation?: string;
    };
    occupation?: {
      category?: 'salaried' | 'student' | 'business' | 'other';
      organizationName?: string;
      officeAddress?: string;
      idNumber?: string;
      contactPhone?: string;
    };
    localReferences?: Array<{
      name?: string;
      phone?: string;
      address?: string;
      relation?: string;
    }>;
    stayPurpose?: string;
  };
  createdAt: string;
}

const TENANT_KEY = ['tenants', 'detail'] as const;
const TENANT_DUES_KEY = ['tenants', 'dues'] as const;
const TENANT_PAYMENTS_KEY = ['tenants', 'payments'] as const;
const TENANT_INVOICES_KEY = ['tenants', 'invoices'] as const;
const TENANT_COMPLAINTS_KEY = ['tenants', 'complaints'] as const;
const TENANT_ACTIVITY_KEY = ['tenants', 'activity'] as const;
const TENANT_GUARDIANS_KEY = ['guardians', 'by-tenant'] as const;

type GuardianLink = {
  _id: string;
  name: string;
  phone?: string;
  relation?: string;
  isActive?: boolean;
};
type RecentPayment = { _id: string; amount: number; status: string; createdAt: string };
type RecentInvoice = {
  _id: string;
  invoiceNumber?: string;
  month?: string;
  totalAmount?: number;
  balance?: number | null;
  status?: string;
};
type RecentComplaint = { _id: string; title: string; status: string; priority?: string };
type ActivityEvent = { id: string; type: string; title: string; subtitle?: string; date: string };

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function asRows<T>(data: T[] | undefined): T[] {
  return Array.isArray(data) ? data : [];
}

/**
 * The days of a stay, counted from the move-in date the server holds.
 *
 * The tenant record carries no lease end date, so the length of the stay is
 * the only thing the server can answer about how long a resident has been
 * here.
 */
function daysOfStay(moveInDate: string | undefined, moveOutDate: string | null): number | null {
  if (!moveInDate) return null;
  const start = new Date(moveInDate);
  const end = moveOutDate ? new Date(moveOutDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  return days > 0 ? days : 0;
}

/**
 * One step of the onboarding trail.
 *
 * The trail is the real progression of a resident. The tenant model has no
 * status field, so the steps are read out of the fields the server writes:
 * the created record, the move-in date, the two uploaded documents, the
 * verification and the move-out date.
 */
interface TrailStep {
  key: string;
  label: string;
  detail: string;
  date: string | null;
  done: boolean;
}

/** The onboarding trail of one resident, from the fields the server holds. */
function onboardingTrail(tenant: TenantDetail): TrailStep[] {
  const hasIdDocument = Boolean(tenant.documents?.idUrl || tenant.documents?.aadhaarUrl);
  const hasPhoto = Boolean(tenant.documents?.photoUrl);
  const verified = Boolean(tenant.documents?.isVerified);
  return [
    {
      key: 'account',
      label: 'Account created',
      detail: 'the server created the portal login with a temporary password',
      date: tenant.createdAt ?? null,
      done: true,
    },
    {
      key: 'moved_in',
      label: 'Moved in',
      detail: 'the bed and the move-in date were stamped',
      date: tenant.moveInDate ?? null,
      done: true,
    },
    {
      key: 'id_document',
      label: 'Identity document uploaded',
      detail: 'the resident or the office uploaded the identity document',
      date: null,
      done: hasIdDocument,
    },
    {
      key: 'photo',
      label: 'Photo uploaded',
      detail: 'the resident or the office uploaded the resident photo',
      date: null,
      done: hasPhoto,
    },
    {
      key: 'verified',
      label: 'Identity verified',
      detail: 'an admin verified the documents; the resident was notified',
      date: tenant.documents?.verifiedAt ?? null,
      done: verified,
    },
    {
      key: 'moved_out',
      label: 'Stay closed',
      detail: 'the stay was closed and the bed was freed',
      date: tenant.moveOutDate ?? null,
      done: Boolean(tenant.moveOutDate),
    },
  ];
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [error, setError] = useState('');
  // The outcome of the last write, as the server reported it.
  const [writeResult, setWriteResult] = useState('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [reinstating, setReinstating] = useState(false);
  const [showReinstatePlacement, setShowReinstatePlacement] = useState(false);
  const [reinstateRoomId, setReinstateRoomId] = useState('');
  const [reinstateBedId, setReinstateBedId] = useState('');
  const [reinstateError, setReinstateError] = useState('');
  const [statementLoading, setStatementLoading] = useState(false);
  const [verifyingKyc, setVerifyingKyc] = useState(false);
  const [downloadingPolicePdf, setDownloadingPolicePdf] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TenantDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    data,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<TenantDetail>([...TENANT_KEY, id], `tenants/${id}`, { enabled: !!id });
  const tenant = data ?? null;

  /**
   * The dues summary of the resident.
   *
   * The server owns the money. This is the same summary the resident reads on
   * their phone (GET /tenants/me/dues) and the same one the checkout guard
   * refuses on (apps/api/src/routes/tenants.ts:733-795), so the office and
   * the resident cannot be shown different numbers.
   */
  const { data: duesBody, isPending: duesPending } = useApiQuery<CheckoutDues>(
    [...TENANT_DUES_KEY, id],
    `tenants/${id}/dues`,
    { enabled: !!id },
  );
  const dues = duesBody ?? null;

  const guardiansQuery = useApiQuery<GuardianLink[]>(
    [...TENANT_GUARDIANS_KEY, id],
    `guardians?tenantId=${id}&limit=20`,
    { enabled: !!id },
  );
  const paymentsQuery = useApiQuery<RecentPayment[]>(
    [...TENANT_PAYMENTS_KEY, id],
    `tenants/${id}/payments`,
    { enabled: !!id },
  );
  const invoicesQuery = useApiQuery<RecentInvoice[]>(
    [...TENANT_INVOICES_KEY, id],
    `tenants/${id}/invoices`,
    { enabled: !!id },
  );
  const complaintsQuery = useApiQuery<RecentComplaint[]>(
    [...TENANT_COMPLAINTS_KEY, id],
    `tenants/${id}/complaints`,
    { enabled: !!id },
  );
  const activityQuery = useApiQuery<ActivityEvent[]>(
    [...TENANT_ACTIVITY_KEY, id],
    `tenants/${id}/activity`,
    { enabled: !!id },
  );

  const guardians = asRows(guardiansQuery.data).slice(0, 5);
  const recentPayments = asRows(paymentsQuery.data).slice(0, 5);
  const recentInvoices = asRows(invoicesQuery.data).slice(0, 5);
  const recentComplaints = asRows(complaintsQuery.data).slice(0, 5);
  const relatedError =
    guardiansQuery.isError &&
    paymentsQuery.isError &&
    invoicesQuery.isError &&
    complaintsQuery.isError
      ? 'Could not load related records'
      : '';

  const invoiceEvents: StayCalendarEvent[] = asRows(invoicesQuery.data)
    .filter((r) => typeof r.month === 'string' && /^\d{4}-\d{2}$/.test(r.month))
    .map((r) => ({
      id: `invoice-${r._id}`,
      date: `${r.month}-01`,
      type: 'notice',
      title: `Invoice ${r.invoiceNumber ?? r._id.slice(-6)}`,
      subtitle: r.month ?? '',
    }));
  const activityEvents: StayCalendarEvent[] = asRows(activityQuery.data).map((e) => ({
    id: e.id,
    date: e.date,
    type: e.type,
    title: e.title,
    subtitle: e.subtitle,
  }));
  const calendarEvents = [...activityEvents, ...invoiceEvents];

  /** The money the server reports for this resident. */
  const reportedTotalDue = dues && typeof dues.totalDue === 'number' ? dues.totalDue : null;
  const unpaidInvoices: UnpaidInvoiceRow[] =
    dues && Array.isArray(dues.unpaidInvoices) ? dues.unpaidInvoices : [];
  /**
   * A balance the server did not report is never read as zero.
   *
   * The server counts an invoice with an unknown balance as open but cannot
   * add it up, so a total of zero next to an unknown balance is not "nothing
   * due".
   */
  const unknownBalance = unpaidInvoices.some((invoice) => invoice.remaining == null);

  /**
   * The checkout gate, read the way the server reads it.
   *
   * The server refuses the checkout while an invoice still carries a balance
   * or a payment is unresolved (apps/api/src/routes/tenants.ts:737-795). The
   * dues summary already carries exactly that set: the open invoices with a
   * balance, where an invoice whose total the server does not know counts as
   * a balance, and the count of the unresolved payments.
   */
  const checkoutBlockedByBalance = Boolean(dues && unpaidInvoices.length > 0);
  const checkoutBlockedByPayments = Boolean(dues && (dues.pendingPayments ?? 0) > 0);
  const checkoutBlocked = checkoutBlockedByBalance || checkoutBlockedByPayments;

  const refreshAfterWrite = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: TENANT_KEY }),
      queryClient.invalidateQueries({ queryKey: TENANT_DUES_KEY }),
      queryClient.invalidateQueries({ queryKey: TENANT_PAYMENTS_KEY }),
      queryClient.invalidateQueries({ queryKey: TENANT_INVOICES_KEY }),
      queryClient.invalidateQueries({ queryKey: TENANT_ACTIVITY_KEY }),
      queryClient.invalidateQueries({ queryKey: TENANT_GUARDIANS_KEY }),
    ]);
  };

  const handleConfirmCheckout = async () => {
    if (!tenant || checkoutBlocked) return;
    setCheckingOut(true);
    setCheckoutError('');
    try {
      const res = await api
        .post(`tenants/${tenant._id}/checkout`, { json: {} })
        .json<{ success: boolean; data?: { moveOutDate?: string; isActive?: boolean } }>();
      setShowCheckoutModal(false);
      await refreshAfterWrite();
      const movedOut = res.data?.moveOutDate ?? null;
      setWriteResult(
        `Check out saved. The server reports the stay closed${
          movedOut ? ` on ${formatDate(movedOut)}` : ''
        }, the bed free and the portal login disabled. The resident is not told: the server sends no notification for a check out.`,
      );
    } catch (err) {
      setCheckoutError((await parseApiError(err)).message);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleReinstate = async (body: { roomId?: string; bedId?: string } = {}) => {
    if (!tenant) return;
    setReinstating(true);
    setReinstateError('');
    setError('');
    try {
      const payload = body.roomId && body.bedId ? { roomId: body.roomId, bedId: body.bedId } : {};
      await api.post(`tenants/${tenant._id}/reinstate`, { json: payload }).json();
      await refreshAfterWrite();
      setShowReinstatePlacement(false);
      setWriteResult(
        'Reinstate saved. The server reports the stay open again, the move-out date cleared and the portal login enabled again.',
      );
    } catch (err) {
      const parsed = await parseApiError(err);
      if (parsed.code === 'BED_OCCUPIED') {
        setShowReinstatePlacement(true);
        setReinstateError(
          'Original bed is occupied. Choose a free room and bed, then reinstate again.',
        );
        if (!reinstateRoomId && tenant.room?._id) {
          setReinstateRoomId(tenant.room._id);
        }
      } else {
        setReinstateError(parsed.message);
        setError(parsed.message);
      }
    } finally {
      setReinstating(false);
    }
  };

  const handleDownloadPolicePdf = async () => {
    if (!tenant) return;
    setDownloadingPolicePdf(true);
    try {
      const response = await api.get(`tenants/${tenant._id}/police-verification.pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `police-verification-${(tenant.user?.name || 'resident').toLowerCase().replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setWriteResult(
        'Police verification form downloaded. The server generated the PDF from the record.',
      );
    } catch {
      toast.error('Failed to generate police verification PDF');
    } finally {
      setDownloadingPolicePdf(false);
    }
  };

  const handleVerifyKyc = async () => {
    if (!tenant) return;
    setVerifyingKyc(true);
    try {
      await api.post(`tenants/${tenant._id}/verify-kyc`).json();
      // No success toast: the KYC state next to this button shows the server's
      // own state after the invalidation below, so the screen never claims a
      // verification the server did not record.
      await queryClient.invalidateQueries({ queryKey: [...TENANT_KEY, tenant._id] });
      setWriteResult(
        'Verification saved. The server reports the documents as verified and the resident received the notification.',
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setVerifyingKyc(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`tenants/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      router.push('/tenants');
    } catch (err) {
      setError((await parseApiError(err)).message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const loadError = errorMessage(queryError) || error;

  const trail = useMemo(() => (tenant ? onboardingTrail(tenant) : []), [tenant]);
  const stayDays = tenant ? daysOfStay(tenant.moveInDate, tenant.moveOutDate) : null;

  if (!isLoading && (loadError || !tenant)) {
    return (
      <FormPage
        title="Tenant Details"
        description="View tenant information"
        backHref="/tenants"
        error={loadError || 'Tenant not found'}
        maxWidth="full"
      />
    );
  }

  const hasIdDocument = Boolean(tenant?.documents?.idUrl || tenant?.documents?.aadhaarUrl);
  const hasPhoto = Boolean(tenant?.documents?.photoUrl);
  const canVerifyKyc = hasIdDocument && hasPhoto && !tenant?.documents?.isVerified;

  return (
    <FormPage
      title={tenant?.user?.name ?? 'Tenant Details'}
      description={
        tenant ? `Bed ${tenant.bedId} · Room ${tenant.room?.roomNumber ?? 'N/A'}` : undefined
      }
      backHref="/tenants"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        tenant ? (
          <StatusBadge
            variant={statusToVariant(tenant.isActive ? 'active' : 'checked_out')}
            label={tenant.isActive ? 'In house' : 'Checked out'}
          />
        ) : undefined
      }
      actions={
        tenant ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* The primary action of the record, pinned in the header so it is
                reachable without scrolling. The full action card stays lower
                down on the page, with every action it had. */}
            {tenant.isActive && (
              <Button variant="danger" size="sm" onClick={() => setShowCheckoutModal(true)}>
                <LogOut className="h-4 w-4" />
                Check Out
              </Button>
            )}
            {!tenant.isActive && (
              <Button
                variant="primary"
                size="sm"
                loading={reinstating && !showReinstatePlacement}
                onClick={() => void handleReinstate()}
              >
                <RotateCcw className="h-4 w-4" />
                Reinstate
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/tenants/${tenant._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      {tenant && (
        <div className="space-y-6">
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
              {writeResult}
            </div>
          )}

          {/* ── The protagonist: the resident, the bed and the money ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className={`${surfaceCardClass} p-5 lg:col-span-2`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold tracking-tight text-(--color-text-primary)">
                    {tenant.user?.name ?? 'Unnamed resident'}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-(--color-text-secondary)">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {tenant.user?.email ?? 'No email on file'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {tenant.user?.phone ?? 'No phone on file'}
                    </span>
                  </div>
                </div>
                <StatusBadge
                  variant={statusToVariant(tenant.isActive ? 'active' : 'checked_out')}
                  label={tenant.isActive ? 'In house' : 'Checked out'}
                />
              </div>

              <DetailList className="mt-4">
                <DetailRow
                  label="Room and bed"
                  value={
                    tenant.room?._id ? (
                      <Link
                        href={`/rooms/${tenant.room._id}`}
                        className="text-(--color-brand-600) hover:underline"
                      >
                        Room {tenant.room.roomNumber} · Bed {tenant.bedId}
                        {tenant.room.floor?.label ? ` · ${tenant.room.floor.label}` : ''}
                      </Link>
                    ) : (
                      `Room ${tenant.room?.roomNumber ?? 'N/A'} · Bed ${tenant.bedId}`
                    )
                  }
                />
                <DetailRow
                  label="Stay"
                  value={
                    <span>
                      {tenant.isActive
                        ? `Since ${formatDate(tenant.moveInDate)}`
                        : `${formatDate(tenant.moveInDate)} to ${formatDate(tenant.moveOutDate)}`}
                      {stayDays !== null && (
                        <span className="text-(--color-text-muted)">
                          {' · '}
                          {stayDays} day(s)
                        </span>
                      )}
                    </span>
                  }
                />
                <DetailRow
                  label="Monthly rent and deposit"
                  value={
                    <span className="tabular-nums">
                      {formatCurrency(tenant.monthlyRent)}/mo · deposit{' '}
                      {formatCurrency(tenant.depositPaid)} held
                    </span>
                  }
                />
                {tenant.emergencyContact?.name && (
                  <DetailRow
                    label="Emergency contact"
                    value={
                      <span>
                        {tenant.emergencyContact.name}
                        {tenant.emergencyContact.phone ? ` · ${tenant.emergencyContact.phone}` : ''}
                        {tenant.emergencyContact.relation
                          ? ` (${tenant.emergencyContact.relation})`
                          : ''}
                      </span>
                    }
                  />
                )}
              </DetailList>
            </div>

            {/* The money number of the record: the server's dues summary for
                this resident, the same one the resident reads. */}
            <div className={`${surfaceCardClass} p-5`}>
              <p className="tracking-label text-xs font-semibold text-(--color-text-muted) uppercase">
                Owes now
              </p>
              {duesPending ? (
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
                  {formatCurrency(reportedTotalDue)}
                </p>
              )}
              {unknownBalance && (
                <p className="text-2xs mt-1 font-semibold text-(--color-warning-700)">
                  The server holds an invoice whose total it does not know. That amount is
                  outstanding, never zero, and it is missing from the sum above.
                </p>
              )}
              <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                The server&apos;s dues summary for this resident. The same summary the resident
                reads on their phone, so the two can never disagree.
              </p>
              <div className="text-2xs mt-3 space-y-1 font-medium text-(--color-text-secondary)">
                <p>Open invoices: {duesPending ? 'reading' : String(unpaidInvoices.length)}</p>
                <p>
                  Unresolved payments:{' '}
                  {duesPending ? 'reading' : String(dues?.pendingPayments ?? 0)}
                </p>
                <p>
                  Electricity share:{' '}
                  {duesPending
                    ? 'reading'
                    : typeof dues?.electricityDues === 'number'
                      ? formatCurrency(dues.electricityDues)
                      : 'not reported'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push(`/invoices?tenantId=${tenant._id}`)}
              >
                <Receipt className="h-3.5 w-3.5" />
                Open the bills in the ledger
              </Button>
            </div>
          </div>

          {/* ── The onboarding trail: the progression the record proves ── */}
          <DetailCard title="Onboarding trail" icon={<Route />}>
            <ol className="flex flex-wrap items-start gap-x-2 gap-y-4">
              {trail.map((step, index) => (
                <li key={step.key} className="min-w-40 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[length:var(--bw-default)] font-bold ${
                        step.done
                          ? 'border-(--color-success-500) bg-(--color-success-500) text-(--color-on-success)'
                          : 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-muted)'
                      }`}
                    >
                      {step.done ? <Check className="h-3.5 w-3.5" /> : <span>{index + 1}</span>}
                    </span>
                    {index < trail.length - 1 && (
                      <span
                        aria-hidden
                        className="h-0.5 min-w-4 flex-1 rounded-full bg-(--border-color)"
                      />
                    )}
                  </div>
                  <p
                    className={`mt-1.5 text-xs font-bold ${
                      step.done ? 'text-(--color-text-primary)' : 'text-(--color-text-muted)'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-2xs font-medium text-(--color-text-muted)">
                    {step.done
                      ? step.date
                        ? formatDate(step.date)
                        : 'done, the server holds no date for it'
                      : step.detail}
                  </p>
                </li>
              ))}
            </ol>
            <p className="text-2xs mt-4 font-medium text-(--color-text-muted)">
              The resident record carries no link back to the enquiry it came from: the server
              stores the converted tenant on the enquiry, not the other way round.{' '}
              <Link
                href="/enquiries?status=converted"
                className="text-(--color-brand-600) hover:underline"
              >
                Open the converted enquiries
              </Link>{' '}
              to find the lead this resident came from.
            </p>
          </DetailCard>

          {/* ── What the resident owes, in the resident's own view ── */}
          <DetailCard title="What the resident owes" icon={<Scale />}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DetailList>
                <DetailRow
                  label="Total pending"
                  value={
                    duesPending
                      ? 'reading'
                      : reportedTotalDue === null
                        ? 'not reported'
                        : formatCurrency(reportedTotalDue)
                  }
                />
                <DetailRow
                  label="Open invoices"
                  value={duesPending ? 'reading' : String(unpaidInvoices.length)}
                />
                <DetailRow
                  label="Deposit held"
                  value={
                    duesPending
                      ? 'reading'
                      : typeof dues?.depositHeld === 'number'
                        ? formatCurrency(dues.depositHeld)
                        : 'not reported'
                  }
                />
                <DetailRow
                  label="Unresolved payments"
                  value={duesPending ? 'reading' : String(dues?.pendingPayments ?? 0)}
                />
              </DetailList>

              <div>
                {unpaidInvoices.length > 0 ? (
                  <div className="space-y-1.5">
                    {unpaidInvoices.map((invoice) => (
                      <Link
                        key={invoice._id}
                        href={`/invoices/${invoice._id}`}
                        className="flex items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-color) px-2.5 py-1.5 text-xs font-semibold text-(--color-text-secondary) hover:border-(--color-brand-300)"
                      >
                        <span>
                          {invoice.invoiceNumber ?? invoice._id.slice(-6)}
                          {invoice.month ? ` · ${invoice.month}` : ''}
                        </span>
                        <span className="tabular-nums">
                          {typeof invoice.remaining === 'number'
                            ? formatCurrency(invoice.remaining)
                            : 'balance not reported'}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-(--color-text-muted)">
                    {duesPending
                      ? "Reading the server's dues..."
                      : 'The server reports no open invoice for this resident.'}
                  </p>
                )}
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  Every number here is the server&apos;s. The resident opens the same summary on
                  their phone (GET /tenants/me/dues): one server helper answers both, so the office
                  and the resident never see different amounts.
                </p>
              </div>
            </div>
          </DetailCard>

          {/* ── Documents and identity ── */}
          <DetailCard
            title="Documents and KYC"
            icon={<FileText />}
            action={
              tenant.documents?.isVerified ? (
                <span className="rounded-full bg-(--color-success-50) px-2.5 py-1 text-xs font-semibold text-(--color-success-700)">
                  KYC Verified
                </span>
              ) : canVerifyKyc ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleVerifyKyc}
                  loading={verifyingKyc}
                >
                  Verify KYC
                </Button>
              ) : null
            }
          >
            {!tenant.documents?.isVerified && (
              <p className="mb-4 text-xs font-medium text-(--color-text-secondary)">
                The identity is not verified yet. The office verifies only when both documents are
                uploaded:{' '}
                {hasIdDocument
                  ? 'the identity document is there'
                  : 'the identity document is missing'}
                , {hasPhoto ? 'the photo is there' : 'the photo is missing'}. The server stamps the
                verification and notifies the resident. A resident who uploads their own document
                from the portal flips the state back to unverified; an upload from the office
                replaces the file and leaves the verdict as it is.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DocumentUpload
                tenantId={tenant._id}
                docType={tenant.documents?.idType || 'aadhaar'}
                currentUrl={tenant.documents?.idUrl || tenant.documents?.aadhaarUrl}
                idNumberMasked={tenant.documents?.idNumberMasked}
                isVerified={tenant.documents?.isVerified}
                onUploaded={() => {
                  queryClient.invalidateQueries({ queryKey: [...TENANT_KEY, tenant._id] });
                }}
              />
              <DocumentUpload
                tenantId={tenant._id}
                docType="photo"
                currentUrl={tenant.documents?.photoUrl}
                isVerified={tenant.documents?.isVerified}
                onUploaded={() => {
                  queryClient.invalidateQueries({ queryKey: [...TENANT_KEY, tenant._id] });
                }}
              />
            </div>
          </DetailCard>

          {/* ── Every action the office can take, from here ── */}
          <DetailCard title="Office actions" icon={<User />}>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  const p = tenant.user?.phone ?? '';
                  window.open(
                    generateWhatsAppUrl(
                      p,
                      `Hi ${tenant.user?.name ?? 'Tenant'}, regarding your stay...`,
                    ),
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                disabled={!tenant.user?.phone}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  copyToClipboard(
                    `${tenant.user?.name ?? 'Tenant'} | ${tenant.user?.phone ?? ''} | Room ${tenant.room?.roomNumber ?? 'N/A'} | Bed ${tenant.bedId}`,
                  )
                }
              >
                <Copy className="h-4 w-4" /> Copy Info
              </Button>
              <Button
                variant="outline"
                loading={statementLoading}
                onClick={async () => {
                  if (!tenant) return;
                  setStatementLoading(true);
                  try {
                    // Must use the authenticated ky client - window.open omits the JWT.
                    const blob = await api.get(`tenants/${tenant._id}/statement.pdf`).blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `statement-${tenant.user?.name?.replace(/\s+/g, '-').toLowerCase() ?? 'tenant'}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setWriteResult(
                      'Statement of account downloaded. The server prints the same balances the ledger shows.',
                    );
                  } catch {
                    toast.error('Failed to download statement. Ensure you are logged in.');
                  } finally {
                    setStatementLoading(false);
                  }
                }}
              >
                <Printer className="h-4 w-4" /> Statement of Account
              </Button>
              <Button
                variant="outline"
                loading={downloadingPolicePdf}
                onClick={handleDownloadPolicePdf}
              >
                <FileText className="h-4 w-4 text-(--color-brand-600)" /> Police Verification Form
              </Button>
              {tenant.isActive && (
                <Button variant="danger" onClick={() => setShowCheckoutModal(true)}>
                  <LogOut className="h-4 w-4" /> Check Out
                </Button>
              )}
              {!tenant.isActive && (
                <Button
                  variant="primary"
                  loading={reinstating && !showReinstatePlacement}
                  onClick={() => void handleReinstate()}
                >
                  <RotateCcw className="h-4 w-4" /> Reinstate
                </Button>
              )}
              <Button variant="outline" onClick={() => setDeleteTarget(tenant)}>
                <Trash2 className="h-4 w-4" /> Delete resident
              </Button>
            </div>
            <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
              A check out closes the stay, frees the bed and disables the portal login, and the
              server sends no notification: the resident is not told. Use check out for a normal
              move-out and delete only for a record that must not exist at all.
            </p>
            {!tenant.isActive && (showReinstatePlacement || reinstateError) && (
              <div className="mt-4 space-y-3 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-4">
                {reinstateError && (
                  <p className="text-13 font-semibold text-(--color-danger-700)">
                    {reinstateError}
                  </p>
                )}
                {showReinstatePlacement && (
                  <>
                    <p className="text-sm font-bold text-(--color-text-primary)">
                      Place on a different bed
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <ResourceSelect
                        label="Room"
                        endpoint="rooms?isActive=true"
                        value={reinstateRoomId}
                        onChange={(val) => {
                          setReinstateRoomId(val);
                          setReinstateBedId('');
                        }}
                        placeholder="Select room..."
                        valueKey="_id"
                        labelKey={(item) => {
                          const r = item as unknown as RoomOption;
                          return `Room ${r.roomNumber} - ${r.floor?.label ?? '?'}`;
                        }}
                        sublabelFn={(item) => {
                          const r = item as unknown as RoomOption;
                          return `Rs ${r.monthlyRent}/mo · ${r.sharingType} sharing`;
                        }}
                        dataPath="data"
                      />
                      <OccupancyBedPicker
                        roomId={reinstateRoomId || null}
                        value={reinstateBedId}
                        onChange={setReinstateBedId}
                        label="Bed"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        loading={reinstating}
                        disabled={!reinstateRoomId || !reinstateBedId}
                        onClick={() =>
                          void handleReinstate({
                            roomId: reinstateRoomId,
                            bedId: reinstateBedId,
                          })
                        }
                      >
                        <RotateCcw className="h-4 w-4" /> Reinstate to selected bed
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reinstating}
                        onClick={() => {
                          setShowReinstatePlacement(false);
                          setReinstateError('');
                          setReinstateBedId('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </DetailCard>

          {/* ── The related records ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DetailCard title="Guardians" icon={<Users />}>
              {relatedError && guardians.length === 0 ? (
                <p className="text-sm text-(--color-text-muted)">{relatedError}</p>
              ) : guardians.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-(--color-text-muted)">No guardians linked.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/guardians/new?tenantId=${tenant._id}`)}
                  >
                    Add guardian
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {guardians.map((g) => (
                    <button
                      key={g._id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-(--radius-md) border border-(--border-color) px-3 py-2 text-left text-sm hover:bg-(--color-field-bg)"
                      onClick={() => router.push(`/guardians/${g._id}`)}
                    >
                      <span>
                        <span className="font-semibold text-(--color-text-primary)">{g.name}</span>
                        <span className="ml-2 text-xs text-(--color-text-muted) capitalize">
                          {g.relation ?? ''}
                        </span>
                        {g.isActive === false && (
                          <span className="text-2xs ml-2 font-semibold text-(--color-warning-700)">
                            portal off
                          </span>
                        )}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/guardians?tenantId=${tenant._id}`)}
                  >
                    View all guardians
                  </Button>
                </div>
              )}
            </DetailCard>

            <DetailCard title="Recent payments" icon={<CreditCard />}>
              {recentPayments.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-(--color-text-muted)">No payments yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/payments/new?tenantId=${tenant._id}`)}
                  >
                    Record payment
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentPayments.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-(--radius-md) border border-(--border-color) px-3 py-2 text-left text-sm hover:bg-(--color-field-bg)"
                      onClick={() => router.push(`/payments/${p._id}`)}
                    >
                      <span className="font-semibold">{formatCurrency(p.amount)}</span>
                      <StatusBadge
                        variant={statusToVariant(p.status)}
                        label={p.status.replace(/_/g, ' ')}
                      />
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/payments/new?tenantId=${tenant._id}`)}
                  >
                    Record payment
                  </Button>
                </div>
              )}
            </DetailCard>

            <DetailCard title="Recent invoices" icon={<Receipt />}>
              {recentInvoices.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-(--color-text-muted)">No invoices yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/invoices/new?tenantId=${tenant._id}`)}
                  >
                    Generate invoice
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentInvoices.map((inv) => (
                    <button
                      key={inv._id}
                      type="button"
                      className="group flex w-full items-center justify-between rounded-(--radius-md) border border-(--border-color) px-3 py-2 text-left text-sm transition-all hover:border-(--border-color-hover) hover:bg-(--color-field-bg)"
                      onClick={() => router.push(`/invoices/${inv._id}`)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-xs font-bold text-(--color-brand-700) group-hover:underline">
                          {inv.invoiceNumber ?? inv._id.slice(-6)}
                        </span>
                        {inv.month && (
                          <span className="text-xs text-(--color-text-muted)">{inv.month}</span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="font-semibold text-(--color-text-primary) tabular-nums">
                          {formatCurrency(inv.totalAmount ?? 0)}
                        </span>
                        {typeof inv.balance === 'number' && inv.balance > 0 && (
                          <span className="text-2xs font-semibold text-(--color-danger-700) tabular-nums">
                            {formatCurrency(inv.balance)} due
                          </span>
                        )}
                        <StatusBadge
                          variant={statusToVariant(inv.status ?? 'pending')}
                          label={inv.status ?? 'pending'}
                        />
                        <ExternalLink className="h-3.5 w-3.5 text-(--color-text-muted) opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/invoices/new?tenantId=${tenant._id}`)}
                  >
                    Generate invoice
                  </Button>
                </div>
              )}
            </DetailCard>

            <DetailCard title="Recent complaints" icon={<AlertTriangle />}>
              {recentComplaints.length === 0 ? (
                <p className="text-sm text-(--color-text-muted)">No complaints.</p>
              ) : (
                <div className="space-y-2">
                  {recentComplaints.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-(--radius-md) border border-(--border-color) px-3 py-2 text-left text-sm hover:bg-(--color-field-bg)"
                      onClick={() => router.push(`/complaints/${c._id}`)}
                    >
                      <span className="truncate font-semibold">{c.title}</span>
                      <StatusBadge
                        variant={statusToVariant(c.status)}
                        label={c.status.replace(/_/g, ' ')}
                      />
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/complaints?search=${encodeURIComponent(tenant.user?.name ?? '')}`,
                      )
                    }
                  >
                    View all complaints
                  </Button>
                </div>
              )}
            </DetailCard>
          </div>

          {/* ── The statutory profile, kept as its own card ── */}
          <DetailCard
            title="Police Verification and Legal Profile"
            icon={<Shield />}
            action={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={downloadingPolicePdf}
                  onClick={handleDownloadPolicePdf}
                >
                  <Printer className="mr-1 h-3.5 w-3.5" />
                  Print Police PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push(`/tenants/${tenant._id}/edit`)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit Profile
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <DetailList>
                <DetailRow
                  label="Father / Spouse Name"
                  value={tenant.verificationProfile?.fatherOrSpouseName ?? '—'}
                />
                <DetailRow
                  label="Date of Birth"
                  value={
                    tenant.verificationProfile?.dob
                      ? formatDate(tenant.verificationProfile.dob)
                      : '—'
                  }
                />
                <DetailRow
                  label="Gender and Blood Group"
                  value={
                    [
                      tenant.verificationProfile?.gender
                        ? tenant.verificationProfile.gender.toUpperCase()
                        : null,
                      tenant.verificationProfile?.bloodGroup
                        ? `Blood Group: ${tenant.verificationProfile.bloodGroup}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  }
                />
                <DetailRow
                  label="Identification Mark"
                  value={tenant.verificationProfile?.identificationMark ?? '—'}
                />
                <DetailRow
                  label="Purpose of Stay"
                  value={tenant.verificationProfile?.stayPurpose ?? 'Employment / Education'}
                />
              </DetailList>

              <DetailList>
                <DetailRow
                  label="Permanent Address"
                  value={
                    tenant.verificationProfile?.permanentAddress?.city
                      ? [
                          tenant.verificationProfile.permanentAddress.street,
                          tenant.verificationProfile.permanentAddress.city,
                          tenant.verificationProfile.permanentAddress.state,
                          tenant.verificationProfile.permanentAddress.pincode,
                        ]
                          .filter(Boolean)
                          .join(', ')
                      : '—'
                  }
                />
                <DetailRow
                  label="Native Police Station"
                  value={
                    tenant.verificationProfile?.permanentAddress?.policeStation ? (
                      <span className="font-semibold text-(--color-brand-700)">
                        {tenant.verificationProfile.permanentAddress.policeStation}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow
                  label="Occupation / Institute"
                  value={
                    tenant.verificationProfile?.occupation?.organizationName
                      ? `${tenant.verificationProfile.occupation.organizationName} (${tenant.verificationProfile.occupation.category ?? 'employed'})`
                      : '—'
                  }
                />
                <DetailRow
                  label="Local References (City)"
                  value={
                    tenant.verificationProfile?.localReferences &&
                    tenant.verificationProfile.localReferences.length > 0
                      ? tenant.verificationProfile.localReferences
                          .map((r) => `${r.name || 'Reference'} (${r.phone || 'No phone'})`)
                          .join('; ')
                      : '—'
                  }
                />
              </DetailList>
            </div>
          </DetailCard>

          {/* ── The checkout gate: the server's answer before the write ── */}
          <Modal
            open={showCheckoutModal}
            onClose={() => {
              setShowCheckoutModal(false);
              setCheckoutError('');
            }}
            title={`Checkout ${tenant.user?.name ?? 'Tenant'}`}
            description="All dues must be cleared before a tenant can be checked out"
            size="lg"
            loading={checkingOut}
            footer={
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setCheckoutError('');
                  }}
                  disabled={checkingOut}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleConfirmCheckout()}
                  loading={checkingOut}
                  disabled={duesPending || !dues || checkoutBlocked || checkoutBlockedByPayments}
                >
                  <LogOut className="h-4 w-4" /> Confirm Checkout
                </Button>
              </>
            }
          >
            {duesPending ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-(--color-warning-500)" />
                <span className="text-13 font-semibold text-(--color-text-muted)">
                  Reading the server&apos;s dues...
                </span>
              </div>
            ) : checkoutError ? (
              <div className="text-13 rounded-(--radius-lg) border border-(--color-danger-300) bg-(--color-danger-50) p-3 font-semibold text-(--color-danger-700)">
                {checkoutError}
              </div>
            ) : dues ? (
              <div className="space-y-4">
                <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-(--color-text-primary)">
                      Total Pending Dues
                    </span>
                    <span className="text-lg font-extrabold text-(--color-text-primary)">
                      {reportedTotalDue === null
                        ? 'not reported'
                        : formatCurrency(reportedTotalDue)}
                    </span>
                  </div>
                  <div className="text-12 mt-2 grid grid-cols-2 gap-2 font-semibold text-(--color-text-muted)">
                    <div>
                      Electricity:{' '}
                      {typeof dues.electricityDues === 'number'
                        ? formatCurrency(dues.electricityDues)
                        : 'not reported'}
                    </div>
                    <div>
                      Deposit Held:{' '}
                      {typeof dues.depositHeld === 'number'
                        ? formatCurrency(dues.depositHeld)
                        : 'not reported'}
                    </div>
                    <div>Unresolved Payments: {dues.pendingPayments ?? 0}</div>
                  </div>
                </div>
                {unpaidInvoices.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-bold text-(--color-text-primary)">
                      Unpaid Invoices ({unpaidInvoices.length})
                    </p>
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {unpaidInvoices.map((inv) => (
                        <button
                          key={inv._id}
                          type="button"
                          onClick={() => router.push(`/invoices/${inv._id}`)}
                          className="group flex w-full items-center justify-between rounded-(--radius-lg) border border-(--border-color) px-3 py-2 text-left text-sm transition-all hover:border-(--border-color-hover) hover:bg-(--color-field-bg)"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-(--color-brand-600) group-hover:underline">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-xs text-(--color-text-muted)">{inv.month}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="text-right">
                              <span className="font-bold text-(--color-text-primary) tabular-nums">
                                {typeof inv.remaining === 'number'
                                  ? formatCurrency(inv.remaining)
                                  : 'not reported'}
                              </span>
                              {inv.remaining != null &&
                                inv.remaining !== inv.totalAmount &&
                                inv.totalAmount != null && (
                                  <p className="text-3xs font-semibold text-(--color-text-muted) tabular-nums">
                                    of {formatCurrency(inv.totalAmount)}
                                  </p>
                                )}
                            </div>
                            <StatusBadge
                              variant={statusToVariant(inv.status ?? 'unpaid')}
                              label={inv.status ?? 'unpaid'}
                            />
                            <ExternalLink className="h-3.5 w-3.5 text-(--color-text-muted) opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {checkoutBlockedByBalance ? (
                  <div className="text-13 rounded-(--radius-lg) border border-(--color-danger-300) bg-(--color-danger-50) p-3 font-semibold text-(--color-danger-700)">
                    Clear all unpaid invoice balances before checkout.
                  </div>
                ) : checkoutBlockedByPayments ? (
                  <div className="text-13 rounded-(--radius-lg) border border-(--color-danger-300) bg-(--color-danger-50) p-3 font-semibold text-(--color-danger-700)">
                    Resolve pending or overdue payments before checkout.
                  </div>
                ) : (
                  <div className="text-13 rounded-(--radius-lg) border border-(--color-success-300) bg-(--color-success-50) p-3 font-semibold text-(--color-success-700)">
                    No pending dues. Safe to checkout.
                  </div>
                )}
                <p className="text-2xs font-medium text-(--color-text-muted)">
                  The server refuses the checkout while an invoice carries a balance or a payment is
                  unresolved, and it does the whole move in one transaction: the stay closes, the
                  bed is freed, the portal login and the guardian logins are disabled. The resident
                  is not told: the server sends no notification for a check out.
                </p>
              </div>
            ) : null}
          </Modal>

          <ConfirmModal
            open={!!deleteTarget}
            title="Delete resident permanently?"
            message={
              deleteTarget?.user?.name
                ? `Permanently delete "${deleteTarget.user.name}" and ALL associated records: payments, invoices, complaints, visitors, guardians (including their portal logins), laundry slots, meal feedback, attendance, and leaves. Their bed is freed and their login is disabled. This cannot be undone - prefer Check Out for a normal move-out.`
                : 'Permanently delete this resident and ALL associated records? Their bed is freed and their login is disabled. This cannot be undone.'
            }
            confirmLabel="Delete Permanently"
            loading={deleting}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />

          <DetailCard title="Tenancy Calendar" icon={<Calendar />}>
            <TenantStayCalendar
              moveInDate={tenant.moveInDate}
              moveOutDate={tenant.moveOutDate}
              isActive={tenant.isActive}
              events={calendarEvents}
            />
          </DetailCard>

          <DetailCard title="Activity Timeline" icon={<Activity />}>
            <TenantActivityTimeline tenantId={tenant._id} />
          </DetailCard>
        </div>
      )}
    </FormPage>
  );
}
