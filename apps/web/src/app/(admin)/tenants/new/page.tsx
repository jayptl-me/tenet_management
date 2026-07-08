'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Shield, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const BED_OPTIONS = ['A', 'B', 'C', 'D'].map((b) => ({ value: b, label: `Bed ${b}` }));

const RELATION_OPTIONS = [
  { value: '', label: 'Select relation' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'relative', label: 'Relative' },
  { value: 'friend', label: 'Friend' },
];

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  roomId: z.string().min(1, 'Room is required'),
  bedId: z.string().min(1, 'Bed is required'),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  depositPaid: z.coerce.number().min(0, 'Must be >= 0'),
  monthlyRent: z.coerce.number().min(1, 'Monthly rent is required'),
  // Emergency contact (optional)
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().regex(/^\d{10}$/, 'Must be 10 digits').optional().or(z.literal('')),
  emergencyRelation: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RoomOption { _id: string; roomNumber: string; sharingType: number; monthlyRent: number; floor?: { label: string; floorNumber?: number }; beds?: Array<{ bedId: string; isOccupied: boolean }> }

function TenantForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<RoomOption | null>(null);
  const [availableBeds, setAvailableBeds] = useState<typeof BED_OPTIONS>(BED_OPTIONS);

  const prefilledName = searchParams.get('name') || '';
  const prefilledPhone = searchParams.get('phone') || '';
  const prefilledEmail = searchParams.get('email') || '';

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: prefilledName,
      email: prefilledEmail,
      phone: prefilledPhone,
      depositPaid: 0,
      monthlyRent: 0,
      emergencyName: '',
      emergencyPhone: '',
      emergencyRelation: '',
    },
  });

  // When room is selected, fetch its details to auto-fill rent and filter beds
  const onRoomChange = async (roomId: string) => {
    setValue('roomId', roomId);
    if (!roomId) {
      setSelectedRoom(null);
      setAvailableBeds(BED_OPTIONS);
      return;
    }
    try {
      const res = await api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomOption }>();
      const room = res.data;
      setSelectedRoom(room);

      // Auto-fill monthly rent from room
      if (room.monthlyRent) {
        setValue('monthlyRent', room.monthlyRent);
      }

      // Filter available beds based on room sharing type
      const maxBeds = room.sharingType ?? 4;
      const occupiedBeds = new Set(room.beds?.filter((b) => b.isOccupied).map((b) => b.bedId) ?? []);
      const beds = BED_OPTIONS.slice(0, maxBeds).map((b) => ({
        ...b,
        label: occupiedBeds.has(b.value) ? `${b.label} (Occupied)` : b.label,
      }));
      setAvailableBeds(beds);
    } catch {
      setSelectedRoom(null);
      setAvailableBeds(BED_OPTIONS);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        roomId: data.roomId,
        bedId: data.bedId,
        moveInDate: data.moveInDate,
        depositPaid: data.depositPaid,
        monthlyRent: data.monthlyRent,
        emergencyContact: data.emergencyName
          ? {
              name: data.emergencyName,
              phone: data.emergencyPhone ? `+91${data.emergencyPhone}` : undefined,
              relation: data.emergencyRelation || undefined,
            }
          : undefined,
      };

      await api.post('tenants', { json: payload }).json<{ success: boolean }>();
      router.push('/tenants');
    } catch {
      setSubmitError('Failed to create tenant. Please try again.');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-2xl font-extrabold text-[color:var(--color-text-primary)]">New Tenant</h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">Add a new tenant to the PG</p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        {/* ── Personal Info ─────────────────────── */}
        <div className="space-y-5">
          <h3 className="font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Personal Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full Name" placeholder="Tenant name" error={err.name?.message} {...register('name')} />
            <Input label="Email" type="email" placeholder="tenant@email.com" error={err.email?.message} {...register('email')} />
          </div>
          <Input label="Phone" placeholder="+919876543210" error={err.phone?.message} {...register('phone')} />
        </div>

        {/* ── Room & Bed ─────────────────────────── */}
        <div className="mt-6 space-y-5 border-t border-[color:var(--border-color)] pt-6">
          <h3 className="font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Room Assignment
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              name="roomId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Room"
                  endpoint="rooms?isActive=true"
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val);
                    onRoomChange(val);
                  }}
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
            <Select
              label="Bed"
              options={availableBeds}
              error={err.bedId?.message}
              {...register('bedId')}
            />
          </div>

          {/* Selected room info */}
          {selectedRoom && (
            <div className="rounded-lg border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
              <p className="text-xs font-semibold text-[color:var(--color-brand-700)]">
                Selected: Room {selectedRoom.roomNumber} · Floor {selectedRoom.floor?.label ?? '?'} · {selectedRoom.sharingType} sharing · ₹{selectedRoom.monthlyRent?.toLocaleString()}/mo
              </p>
            </div>
          )}
        </div>

        {/* ── Financial ──────────────────────────── */}
        <div className="mt-6 space-y-5 border-t border-[color:var(--border-color)] pt-6">
          <h3 className="font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Financial Details
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Move-in Date" type="date" error={err.moveInDate?.message} {...register('moveInDate')} />
            <Input label="Deposit Paid (₹)" type="number" error={err.depositPaid?.message} {...register('depositPaid')} />
            <Input label="Monthly Rent (₹)" type="number" error={err.monthlyRent?.message} {...register('monthlyRent')} />
          </div>
        </div>

        {/* ── Emergency Contact ──────────────────── */}
        <div className="mt-6 space-y-5 border-t border-[color:var(--border-color)] pt-6">
          <h3 className="flex items-center gap-2 font-[family:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
            <Shield className="h-4 w-4" /> Emergency Contact
          </h3>
          <p className="text-xs text-[color:var(--color-text-muted)]">Optional — can be added later</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Name" placeholder="Emergency contact name" error={err.emergencyName?.message} {...register('emergencyName')} />
            <Input label="Phone (10 digits)" placeholder="9876543210" error={err.emergencyPhone?.message} {...register('emergencyPhone')} />
            <Select label="Relation" options={RELATION_OPTIONS} error={err.emergencyRelation?.message} {...register('emergencyRelation')} />
          </div>
        </div>

        {/* ── Actions ────────────────────────────── */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t-[length:var(--bw-strong)] border-t-[color:var(--border-color)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <UserPlus className="h-4 w-4" />
            Save Tenant
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewTenantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
        </div>
      }
    >
      <TenantForm />
    </Suspense>
  );
}
