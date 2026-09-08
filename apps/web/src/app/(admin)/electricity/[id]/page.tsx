'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Zap, Pencil, CheckCircle2, Send, FileText, FileUp, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard } from '@/components/ui/DetailCard';

interface RoomEntry {
  roomId?:
    | string
    | {
        _id?: string;
        roomNumber?: string;
        sharingType?: number;
        floorId?: { label?: string; floorNumber?: number } | string;
      };
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  amount: number;
}

interface ElectricityBillDetail {
  _id: string;
  month: string;
  totalBillAmount: number;
  computedRoomTotal?: number;
  variance?: number;
  varianceReason?: string;
  roomEntries: RoomEntry[];
  status: string;
  notes?: string;
  billImageUrl?: string;
  billImagePublicId?: string | null;
  createdAt: string;
}

function roomNumberOf(entry: RoomEntry): string {
  if (!entry.roomId || typeof entry.roomId === 'string') return '—';
  return entry.roomId.roomNumber ?? '—';
}

function roomHref(entry: RoomEntry): string | null {
  if (!entry.roomId || typeof entry.roomId === 'string') return null;
  const id = entry.roomId._id;
  return id ? `/rooms/${id}` : null;
}

function floorOf(entry: RoomEntry): string {
  if (!entry.roomId || typeof entry.roomId === 'string') return '—';
  const f = entry.roomId.floorId;
  if (!f || typeof f === 'string') return '—';
  return f.label ?? (f.floorNumber != null ? `Floor ${f.floorNumber}` : '—');
}

export default function ElectricityBillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [bill, setBill] = useState<ElectricityBillDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api
        .get(`electricity/${params.id}`)
        .json<{ success: boolean; data: ElectricityBillDetail }>();
      setBill(res.data);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const finalize = async () => {
    setActing(true);
    setActionError('');
    setActionMsg('');
    try {
      await api.post(`electricity/${params.id}/finalize`, { json: {} }).json();
      setActionMsg('Bill finalized. You can now distribute charges to invoices.');
      await load();
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setActing(false);
    }
  };

  const distribute = async () => {
    setActing(true);
    setActionError('');
    setActionMsg('');
    try {
      const res = await api
        .post(`electricity/${params.id}/distribute`, { json: {} })
        .json<{ success: boolean; data?: { distributed?: number; errors?: number } }>();
      const d = res.data?.distributed ?? 0;
      const e = res.data?.errors ?? 0;
      setActionMsg(`Distribution complete: ${d} invoice(s) updated, ${e} error(s).`);
      await load();
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setActing(false);
    }
  };

  const uploadBillImage = async (file: File) => {
    setUploadingImage(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`electricity/${params.id}/image`, { body: formData }).json();
      setActionMsg('Bill image uploaded.');
      await load();
    } catch (err) {
      const parsed = await parseApiError(err);
      setActionError(parsed.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeBillImage = async () => {
    setUploadingImage(true);
    setActionError('');
    try {
      await api.delete(`electricity/${params.id}/image`).json();
      setActionMsg('Bill image removed.');
      await load();
    } catch (err) {
      const parsed = await parseApiError(err);
      setActionError(parsed.message);
    } finally {
      setUploadingImage(false);
    }
  };

  if (!isLoading && (error || !bill)) {
    return (
      <FormPage
        title="Electricity Bill"
        description="Monthly multi-room bill"
        backHref="/electricity"
        error={error || 'Electricity bill not found'}
        maxWidth="4xl"
      />
    );
  }

  const totalUnits = bill?.roomEntries?.reduce((s, e) => s + (e.unitsConsumed ?? 0), 0) ?? 0;
  const totalRoomAmount = bill?.roomEntries?.reduce((s, e) => s + (e.amount ?? 0), 0) ?? 0;
  const roomTotal = bill?.computedRoomTotal ?? totalRoomAmount;
  const variance = bill?.variance ?? (bill ? bill.totalBillAmount - totalRoomAmount : 0);
  const showVariance = Math.abs(variance) > 0.5;

  return (
    <FormPage
      title={bill ? `Electricity · ${bill.month}` : 'Electricity Bill'}
      description="Monthly multi-room bill"
      backHref="/electricity"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        bill ? (
          <StatusBadge
            variant={statusToVariant(bill.status)}
            label={bill.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
      actions={
        bill ? (
          <>
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
              <Button size="sm" loading={acting} onClick={finalize}>
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
          </>
        ) : undefined
      }
    >
      {bill && (
        <div className="space-y-6">
          {actionError && <ErrorBanner message={actionError} />}
          {actionMsg && (
            <div className="rounded-lg border border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)] p-3 text-sm font-medium text-[color:var(--color-success-800)]">
              {actionMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Bill"
              value={`₹${bill.totalBillAmount.toLocaleString('en-IN')}`}
              icon={<Zap className="h-4 w-4" />}
              variant="brand"
            />
            <StatCard
              title="Rooms"
              value={String(bill.roomEntries?.length ?? 0)}
              variant="default"
            />
            <StatCard title="Total Units" value={String(totalUnits)} variant="default" />
            <StatCard
              title="Room Total"
              value={`₹${roomTotal.toLocaleString('en-IN')}`}
              variant="default"
            />
            <StatCard
              title="Variance"
              value={`₹${variance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
              variant={showVariance ? 'warning' : 'default'}
            />
          </div>

          {showVariance && (
            <div
              className="rounded-lg border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] p-3 text-sm font-medium text-[color:var(--color-warning-800)]"
              role="status"
            >
              Room readings total ₹{roomTotal.toLocaleString('en-IN')} vs bill total ₹
              {bill.totalBillAmount.toLocaleString('en-IN')} (variance ₹
              {variance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}).
              {bill.varianceReason ? ` Reason: ${bill.varianceReason}` : ''}
            </div>
          )}

          {bill.billImageUrl ? (
            <DetailCard title="Bill image" icon={<Zap />}>
              <div className="space-y-3">
                <div className="max-w-sm overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)]">
                  {/\.(pdf)(\?|$)/i.test(bill.billImageUrl) ? (
                    <div className="flex items-center gap-2 p-4 text-sm">
                      <FileText className="h-4 w-4" />
                      <a
                        href={bill.billImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[color:var(--color-brand-600)] hover:underline"
                      >
                        Open bill PDF in new tab
                      </a>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={bill.billImageUrl}
                      alt={`Electricity bill for ${bill.month}`}
                      className="max-h-64 w-full object-contain"
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={bill.billImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold break-all text-[color:var(--color-brand-600)] hover:underline"
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
              <DetailCard title="Bill image" icon={<Zap />}>
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-[color:var(--color-text-muted)]">
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

          <DetailCard title="Room Entries" icon={<Zap />}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border-color)] text-left text-xs font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                    <th className="pr-4 pb-3">Room</th>
                    <th className="pr-4 pb-3">Floor</th>
                    <th className="pr-4 pb-3">Previous</th>
                    <th className="pr-4 pb-3">Current</th>
                    <th className="pr-4 pb-3">Units</th>
                    <th className="pr-4 pb-3">Rate</th>
                    <th className="pr-4 pb-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(bill.roomEntries ?? []).map((entry, i) => {
                    const href = roomHref(entry);
                    return (
                      <tr
                        key={i}
                        className="border-b border-[color:var(--border-color)] last:border-b-0"
                      >
                        <td className="py-3 pr-4 font-semibold text-[color:var(--color-text-primary)]">
                          {href ? (
                            <Link
                              href={href}
                              className="text-[color:var(--color-brand-600)] hover:underline"
                            >
                              {roomNumberOf(entry)}
                            </Link>
                          ) : (
                            roomNumberOf(entry)
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[color:var(--color-text-secondary)]">
                          {floorOf(entry)}
                        </td>
                        <td className="py-3 pr-4">{entry.previousReading}</td>
                        <td className="py-3 pr-4">{entry.currentReading}</td>
                        <td className="py-3 pr-4">{entry.unitsConsumed}</td>
                        <td className="py-3 pr-4">₹{entry.ratePerUnit}</td>
                        <td className="py-3 pr-4 font-semibold">
                          ₹{(entry.amount ?? 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DetailCard>

          {bill.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="text-sm text-[color:var(--color-text-primary)]">{bill.notes}</p>
            </DetailCard>
          )}
        </div>
      )}
    </FormPage>
  );
}
