'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Phone,
  Home,
  Calendar,
  Clock,
  CheckCircle,
  Pencil,
  ListChecks,
  Ticket,
  FileText,
  MessageCircle,
  BedDouble,
  Building2,
  ExternalLink,
  BadgeCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { VisitorLifecycleActions } from '@/components/ui/VisitorLifecycleActions';
import { VisitorLifecycleStepper } from '@/components/ui/VisitorLifecycleStepper';
import { VisitorGatePassCard, visitorPassCode } from '@/components/ui/VisitorGatePassCard';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';

interface VisitorDetail {
  _id: string;
  name: string;
  phone: string;
  purpose: string;
  tenant?: {
    _id?: string;
    bedId?: string;
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string; floor?: { label?: string; floorNumber?: number } };
  };
  expectedArrival?: string;
  actualArrival?: string;
  actualDeparture?: string;
  approvedBy?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rem = minutes % 60;
    return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  }
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH === 0 ? `${days}d` : `${days}d ${remH}h`;
}

function visitWindow(
  expectedArrival?: string,
  status?: string,
): { label: string; overdue: boolean } {
  if (!expectedArrival) return { label: 'Unscheduled', overdue: false };
  if (status === 'arrived') return { label: 'On premises', overdue: false };
  if (status === 'departed') return { label: 'Completed', overdue: false };
  if (status === 'cancelled') return { label: 'Cancelled', overdue: false };
  const target = new Date(expectedArrival);
  if (Number.isNaN(target.getTime())) return { label: 'Unscheduled', overdue: false };
  const now = new Date();
  if (target.getTime() < now.getTime()) {
    return { label: `Overdue ${formatDuration(now.getTime() - target.getTime())}`, overdue: true };
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return { label: 'Today', overdue: false };
  if (diffDays === 1) return { label: 'Tomorrow', overdue: false };
  return { label: `In ${diffDays} days`, overdue: false };
}

function statusToDisplayLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export default function VisitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [visitor, setVisitor] = useState<VisitorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get(`visitors/${id}`).json<{ success: boolean; data: VisitorDetail }>();
      setVisitor(res.data);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLifecycleAction = async (action: string) => {
    if (!visitor) return;
    setActionError('');
    try {
      // All FSM transitions use POST /visitors/:id/{arrive|depart|cancel|approve}
      const res = await api
        .post(`visitors/${visitor._id}/${action}`, { json: {} })
        .json<{ success: boolean; data: VisitorDetail }>();
      setVisitor(res.data);
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    }
  };

  if (!isLoading && (error || !visitor)) {
    return (
      <FormPage
        title="Visitor Details"
        description="View visitor information"
        backHref="/visitors"
        error={error || 'Visitor not found'}
        maxWidth="4xl"
      />
    );
  }

  // Model: expected | arrived | departed | cancelled
  // approve -> expected; arrive -> arrived; depart -> departed; cancel -> cancelled
  const status = visitor?.status ?? '';
  const visitWindowState = visitWindow(visitor?.expectedArrival, status);
  const durationMs =
    visitor?.actualArrival != null
      ? new Date(visitor.actualDeparture ?? Date.now()).getTime() -
        new Date(visitor.actualArrival).getTime()
      : null;
  const hostRoom = visitor?.tenant?.room?.roomNumber;
  const hostBed = visitor?.tenant?.bedId;
  const hostFloor = visitor?.tenant?.room?.floor?.label;
  const hostStay = hostRoom ? `Room ${hostRoom}${hostBed ? ` · Bed ${hostBed}` : ''}` : 'No room';

  return (
    <FormPage
      title={visitor?.name ?? 'Visitor Details'}
      description={
        visitor
          ? `Gate pass #${visitorPassCode(visitor._id)} · ${statusToDisplayLabel(status)}`
          : undefined
      }
      backHref="/visitors"
      isLoading={isLoading}
      maxWidth="4xl"
      error={actionError}
      actions={
        visitor ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/visitors/${visitor._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit Visitor
          </Button>
        ) : undefined
      }
      badge={
        visitor ? (
          <StatusBadge
            variant={statusToVariant(visitor.status)}
            label={statusToDisplayLabel(visitor.status)}
          />
        ) : undefined
      }
    >
      {visitor && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Visit window"
              value={visitWindowState.label}
              icon={<Calendar className="h-4 w-4" />}
              variant={visitWindowState.overdue ? 'warning' : 'default'}
            />
            <StatCard
              title="Time on premises"
              value={durationMs == null ? '—' : formatDuration(durationMs)}
              icon={<Clock className="h-4 w-4" />}
              variant={status === 'arrived' ? 'success' : 'default'}
            />
            <StatCard
              title="Host stay"
              value={hostStay}
              icon={<Home className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Pass code"
              value={`#${visitorPassCode(visitor._id)}`}
              icon={<BadgeCheck className="h-4 w-4" />}
              variant="brand"
            />
          </div>

          <DetailCard title="Lifecycle progress" icon={<ListChecks />}>
            <VisitorLifecycleStepper status={status} />
            <div className="mt-4 border-t border-[color:var(--border-color)] pt-4">
              <VisitorLifecycleActions
                visitorId={visitor._id}
                status={status}
                onAction={handleLifecycleAction}
              />
            </div>
          </DetailCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DetailCard
              title="Visitor Information"
              icon={<User />}
              action={
                visitor.phone ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(
                        generateWhatsAppUrl(
                          visitor.phone,
                          `Hi ${visitor.name}, regarding your visit to our PG...`,
                        ),
                        '_blank',
                        'noopener,noreferrer',
                      );
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                ) : undefined
              }
            >
              <DetailList>
                <DetailRow
                  label="Name"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {visitor.name}
                    </span>
                  }
                />
                <DetailRow
                  label="Phone"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {visitor.phone}
                    </span>
                  }
                />
                <DetailRow
                  label="Purpose"
                  value={<span className="capitalize">{visitor.purpose}</span>}
                />
              </DetailList>
            </DetailCard>

            <DetailCard
              title="Visiting"
              icon={<Home />}
              action={
                visitor.tenant?._id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/tenants/${visitor.tenant!._id}`)}
                  >
                    View tenant
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                ) : undefined
              }
            >
              <DetailList>
                <DetailRow
                  label="Tenant"
                  value={
                    visitor.tenant?._id ? (
                      <Link
                        href={`/tenants/${visitor.tenant._id}`}
                        className="inline-flex items-center gap-1 text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                      >
                        <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {visitor.tenant?.user?.name ?? 'View tenant'}
                      </Link>
                    ) : (
                      (visitor.tenant?.user?.name ?? 'N/A')
                    )
                  }
                />
                {visitor.tenant?.user?.phone && (
                  <DetailRow
                    label="Tenant phone"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {visitor.tenant.user.phone}
                      </span>
                    }
                  />
                )}
                <DetailRow
                  label="Room"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {hostRoom ?? 'N/A'}
                    </span>
                  }
                />
                <DetailRow
                  label="Bed"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {hostBed ?? 'N/A'}
                    </span>
                  }
                />
                <DetailRow
                  label="Floor"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {hostFloor ?? 'N/A'}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>
          </div>

          <DetailCard title="Gate pass" icon={<Ticket />}>
            <VisitorGatePassCard
              visit={{
                id: visitor._id,
                visitorName: visitor.name,
                visitorPhone: visitor.phone,
                purpose: visitor.purpose,
                expectedArrival: visitor.expectedArrival,
                actualArrival: visitor.actualArrival,
                actualDeparture: visitor.actualDeparture,
                status,
              }}
              host={{
                name: visitor.tenant?.user?.name,
                roomNumber: hostRoom,
                bedId: hostBed,
                floorLabel: hostFloor,
              }}
            />
          </DetailCard>

          <DetailCard title="Timeline" icon={<Clock />}>
            <DetailList>
              <DetailRow
                label="Expected Arrival"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(visitor.expectedArrival)}
                  </span>
                }
              />
              <DetailRow
                label="Check In"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(visitor.actualArrival)}
                  </span>
                }
              />
              <DetailRow
                label="Check Out"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(visitor.actualDeparture)}
                  </span>
                }
              />
              {durationMs != null && (
                <DetailRow
                  label="Duration on premises"
                  value={<span className="font-mono font-bold">{formatDuration(durationMs)}</span>}
                />
              )}
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    variant={statusToVariant(visitor.status)}
                    label={statusToDisplayLabel(visitor.status)}
                  />
                }
              />
            </DetailList>
          </DetailCard>

          <DetailCard title="Record" icon={<FileText />}>
            <DetailList>
              <DetailRow label="Created" value={formatDateTime(visitor.createdAt)} />
              {visitor.updatedAt && (
                <DetailRow label="Last updated" value={formatDateTime(visitor.updatedAt)} />
              )}
              {visitor.approvedBy && (
                <DetailRow
                  label="Re-approved by"
                  value={
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      <CheckCircle className="h-3.5 w-3.5 text-[color:var(--color-success-600)]" />
                      {String(visitor.approvedBy)}
                    </span>
                  }
                />
              )}
              <DetailRow
                label="Record ID"
                value={
                  <button
                    type="button"
                    className="font-mono text-xs text-[color:var(--color-text-secondary)] underline-offset-2 hover:underline"
                    onClick={() => void copyToClipboard(visitor._id)}
                    title="Copy record ID"
                  >
                    {visitor._id}
                  </button>
                }
              />
            </DetailList>
          </DetailCard>
        </div>
      )}
    </FormPage>
  );
}
