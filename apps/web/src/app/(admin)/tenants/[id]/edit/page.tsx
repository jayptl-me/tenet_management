'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { DocumentUpload } from '@/components/ui/DocumentUpload';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const BED_OPTIONS = [
  { value: 'A', label: 'Bed A' },
  { value: 'B', label: 'Bed B' },
  { value: 'C', label: 'Bed C' },
  { value: 'D', label: 'Bed D' },
];

const RELATION_OPTIONS = [
  { value: '', label: 'Select relation' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'relative', label: 'Relative' },
  { value: 'friend', label: 'Friend' },
];

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Checked Out' },
];

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email'),
  roomId: z.string().min(1, 'Room is required'),
  bedId: z.string().min(1, 'Bed is required'),
  monthlyRent: z.coerce.number().positive('Monthly rent must be positive'),
  depositPaid: z.coerce.number().min(0, 'Deposit cannot be negative'),
  isActive: z.string().min(1, 'Status is required'),
  moveInDate: z.string().optional(),
  // Emergency contact
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelation: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RoomOption { _id: string; roomNumber: string; sharingType: number; monthlyRent: number; floor?: { label: string; floorNumber?: number } }

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [tenantData, setTenantData] = useState<Record<string, unknown> | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api.get(`tenants/${id}`).json<{ success: boolean; data: Record<string, unknown> }>()
      .then((res) => {
        const d = res.data;
        setTenantData(d);
        const user = (d.user ?? {}) as Record<string, unknown>;
        const room = (d.room ?? {}) as Record<string, unknown>;
        const ec = (d.emergencyContact ?? {}) as Record<string, string>;

        reset({
          name: (user.name as string) ?? '',
          phone: (user.phone as string) ?? '',
          email: (user.email as string) ?? '',
          roomId: (room._id as string) ?? (d.roomId as string) ?? '',
          bedId: (d.bedId as string) ?? '',
          monthlyRent: (d.monthlyRent as number) ?? 0,
          depositPaid: (d.depositPaid as number) ?? 0,
          isActive: (d.isActive as boolean) ? 'true' : 'false',
          moveInDate: (d.moveInDate as string) ? String(d.moveInDate).slice(0, 10) : '',
          emergencyName: ec.name ?? '',
          emergencyPhone: (ec.phone as string)?.replace('+91', '') ?? '',
          emergencyRelation: ec.relation ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => { setSubmitError('Failed to load tenant'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const payload: Record<string, unknown> = {
        monthlyRent: data.monthlyRent,
        depositPaid: data.depositPaid,
        isActive: data.isActive === 'true',
        bedId: data.bedId,
        roomId: data.roomId,
        moveInDate: data.moveInDate || undefined,
        user: {
          name: data.name,
          phone: data.phone,
          email: data.email,
        },
        emergencyContact: data.emergencyName
          ? {
              name: data.emergencyName,
              phone: data.emergencyPhone ? `+91${data.emergencyPhone}` : undefined,
              relation: data.emergencyRelation || undefined,
            }
          : undefined,
      };

      await api.put(`tenants/${id}`, { json: payload }).json();
      router.push('/tenants');
    } catch {
      setSubmitError('Failed to update tenant');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[color:var(--color-text-muted)]" /></div>;

  const err = errors as Record<string, { message?: string }>;

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-2xl font-extrabold text-[color:var(--color-text-primary)]">Edit Tenant</h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">Update tenant details</p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        {/* ── Personal Info ─────────────────────── */}
        <div className="space-y-5">
          <h3 className="font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Personal Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Name" error={err.name?.message} {...register('name')} />
            <Input label="Phone" error={err.phone?.message} {...register('phone')} />
          </div>
          <Input label="Email" type="email" error={err.email?.message} {...register('email')} />
        </div>

        {/* ── Room & Bed ─────────────────────────── */}
        <div className="mt-6 space-y-5 border-t border-[color:var(--border-color)] pt-6">
          <h3 className="font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Room Assignment</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              name="roomId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Room"
                  endpoint="rooms?isActive=true"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select room..."
                  error={err.roomId?.message}
                  valueKey="_id"
                  labelKey={(item: RoomOption) =>
                    `Room ${item.roomNumber} — ${item.floor?.label ?? '?'}`
                  }
                  sublabelFn={(item: RoomOption) =>
                    `₹${item.monthlyRent}/mo · ${item.sharingType} sharing`
                  }
                  dataPath="data"
                />
              )}
            />
            <Select label="Bed" options={BED_OPTIONS} error={err.bedId?.message} {...register('bedId')} />
          </div>
        </div>

        {/* ── Financial ──────────────────────────── */}
        <div className="mt-6 space-y-5 border-t border-[color:var(--border-color)] pt-6">
          <h3 className="font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Financial Details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Monthly Rent" type="number" step="0.01" error={err.monthlyRent?.message} {...register('monthlyRent')} />
            <Input label="Deposit Paid" type="number" step="0.01" error={err.depositPaid?.message} {...register('depositPaid')} />
            <Input label="Move-in Date" type="date" error={err.moveInDate?.message} {...register('moveInDate')} />
          </div>
          <Select label="Status" options={STATUS_OPTIONS} error={err.isActive?.message} {...register('isActive')} />
        </div>

        {/* ── Emergency Contact ──────────────────── */}
        <div className="mt-6 space-y-5 border-t border-[color:var(--border-color)] pt-6">
          <h3 className="flex items-center gap-2 font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
            <Shield className="h-4 w-4" /> Emergency Contact
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Name" placeholder="Emergency contact name" error={err.emergencyName?.message} {...register('emergencyName')} />
            <Input label="Phone (10 digits)" placeholder="9876543210" error={err.emergencyPhone?.message} {...register('emergencyPhone')} />
            <Select label="Relation" options={RELATION_OPTIONS} error={err.emergencyRelation?.message} {...register('emergencyRelation')} />
          </div>
        </div>

        {/* ── Documents ──────────────────────────── */}
        {tenantData && (
          <div className="mt-6 space-y-5 border-t border-[color:var(--border-color)] pt-6">
            <h3 className="font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Documents</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DocumentUpload
                tenantId={id}
                docType="aadhaar"
                currentUrl={(tenantData.documents as Record<string, string>)?.aadhaarUrl}
                onUploaded={(url) => setTenantData((prev) => prev ? { ...prev, documents: { ...(prev.documents as Record<string, string> ?? {}), aadhaarUrl: url } } : prev)}
              />
              <DocumentUpload
                tenantId={id}
                docType="photo"
                currentUrl={(tenantData.documents as Record<string, string>)?.photoUrl}
                onUploaded={(url) => setTenantData((prev) => prev ? { ...prev, documents: { ...(prev.documents as Record<string, string> ?? {}), photoUrl: url } } : prev)}
              />
            </div>
          </div>
        )}

        {/* ── Actions ────────────────────────────── */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t-[length:var(--bw-strong)] border-t-[color:var(--border-color)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
