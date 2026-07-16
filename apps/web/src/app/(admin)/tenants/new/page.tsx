'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, UserPlus, UserRound, Mail, Phone, CalendarDays, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { TempCredentialsDialog } from '@/components/ui/TempCredentialsDialog';
import { OccupancyBedPicker } from '@/components/ui/OccupancyBedPicker';

const RELATION_OPTIONS = [
  { value: '', label: 'Select relation' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'relative', label: 'Relative' },
  { value: 'friend', label: 'Friend' },
];

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email'),
  phone: z.string().min(10, 'Phone is required').refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  roomId: z.string().min(1, 'Room is required'),
  bedId: z.string().min(1, 'Bed is required'),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  depositPaid: z.coerce.number().min(0, 'Must be >= 0'),
  monthlyRent: z.coerce
    .number()
    .min(1000, 'Monthly rent must be at least Rs 1000')
    .max(50000, 'Monthly rent cannot exceed Rs 50000'),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional().or(z.literal('')).refine((v) => !v || isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  emergencyRelation: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface RoomOption {
  _id: string;
  roomNumber: string;
  sharingType: number;
  monthlyRent: number;
  floor?: { label: string; floorNumber?: number };
  beds?: Array<{ bedId: string; isOccupied: boolean }>;
}

function TenantForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<RoomOption | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const prefilledName = searchParams.get('name') || '';
  const prefilledPhone = searchParams.get('phone') || '';
  const prefilledEmail = searchParams.get('email') || '';
  const enquiryId = searchParams.get('enquiryId') || '';

  const afterCreateHref = enquiryId ? `/enquiries/${enquiryId}` : '/tenants';

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: prefilledName, email: prefilledEmail, phone: prefilledPhone, depositPaid: 0, monthlyRent: 0, emergencyName: '', emergencyPhone: '', emergencyRelation: '' },
  });

  const onRoomChange = async (roomId: string) => {
    setValue('roomId', roomId);
    setValue('bedId', '');
    if (!roomId) { setSelectedRoom(null); return; }
    try {
      const res = await api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomOption }>();
      const room = res.data;
      setSelectedRoom(room);
      if (room.monthlyRent) setValue('monthlyRent', room.monthlyRent);
    } catch { setSelectedRoom(null); }
  };

  const markEnquiryConverted = async () => {
    if (!enquiryId) return;
    try {
      await api
        .put(`enquiries/${enquiryId}/status`, { json: { status: 'converted' } })
        .json<{ success: boolean }>();
    } catch (err) {
      console.error('Failed to mark enquiry as converted', err);
      toast.warning(
        'Tenant created, but the enquiry could not be marked as converted. Update it manually.',
      );
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const moveInIso = new Date(`${data.moveInDate}T00:00:00.000Z`).toISOString();
      const hasEmergency = Boolean(data.emergencyName?.trim());
      if (hasEmergency && (!data.emergencyPhone || !data.emergencyRelation)) {
        setSubmitError('Emergency contact requires name, phone, and relation.');
        return;
      }
      const payload: Record<string, unknown> = {
        name: data.name, email: data.email, phone: normalizeInPhone(data.phone),
        roomId: data.roomId, bedId: data.bedId, moveInDate: moveInIso,
        depositPaid: data.depositPaid, monthlyRent: data.monthlyRent,
        emergencyContact: hasEmergency ? { name: data.emergencyName!.trim(), phone: normalizeInPhone(data.emergencyPhone), relation: data.emergencyRelation!.trim() } : undefined,
      };
      const res = await api.post('tenants', { json: payload }).json<{ success: boolean; data?: { temporaryPassword?: string } }>();
      await markEnquiryConverted();
      if (res.data?.temporaryPassword) {
        setTempPassword(res.data.temporaryPassword);
      } else {
        router.push(afterCreateHref);
      }
    } catch {
      setSubmitError('Failed to create tenant. Check phone (+91...), move-in date, rent, and bed availability.');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage title="New Tenant" description="Add a new tenant to the PG" backHref="/tenants" error={submitError} maxWidth="4xl">
      <FormCard onSubmit={handleSubmit(onSubmit)} footer={<FormActions loading={isSubmitting} cancelHref="/tenants" submitLabel="Save Tenant" submitIcon={<UserPlus className="h-4 w-4" />} divided={false} />}>
        <FormSection title="Personal information" description="Basic identity and contact details">
          <FormGrid>
            <Input label="Full name" placeholder="Tenant name" error={err.name?.message} leftIcon={<UserRound className="h-4 w-4" />} {...register('name')} />
            <Input label="Email" type="email" placeholder="tenant@email.com" error={err.email?.message} leftIcon={<Mail className="h-4 w-4" />} {...register('email')} />
            <Input label="Phone" placeholder="+919876543210" error={err.phone?.message} leftIcon={<Phone className="h-4 w-4" />} {...register('phone')} />
          </FormGrid>
        </FormSection>
        <FormSection title="Room assignment" description="Select an available room and bed" divided>
          <FormGrid>
            <Controller name="roomId" control={control} render={({ field }) => (
              <ResourceSelect label="Room" endpoint="rooms?isActive=true" value={field.value} onChange={(val) => { field.onChange(val); onRoomChange(val); }} placeholder="Select room..." error={err.roomId?.message} valueKey="_id"
                labelKey={(item) => { const r = item as unknown as RoomOption; return `Room ${r.roomNumber} — ${r.floor?.label ?? '?'}`; }}
                sublabelFn={(item) => { const r = item as unknown as RoomOption; return `₹${r.monthlyRent}/mo · ${r.sharingType} sharing`; }} dataPath="data" />
            )} />
            <Controller name="bedId" control={control} render={({ field }) => (
              <OccupancyBedPicker roomId={selectedRoom?._id ?? null} value={field.value ?? ''} onChange={field.onChange} error={err.bedId?.message} />
            )} />
          </FormGrid>
          {selectedRoom && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
              <p className="text-xs font-semibold text-[color:var(--color-brand-700)]">Selected: Room {selectedRoom.roomNumber} · Floor {selectedRoom.floor?.label ?? '?'} · {selectedRoom.sharingType} sharing · ₹{selectedRoom.monthlyRent?.toLocaleString()}/mo</p>
            </div>
          )}
        </FormSection>
        <FormSection title="Financial details" description="Move-in date, deposit, and monthly rent" divided>
          <FormGrid cols={3}>
            <Input label="Move-in date" type="date" error={err.moveInDate?.message} leftIcon={<CalendarDays className="h-4 w-4" />} {...register('moveInDate')} />
            <Input label="Deposit paid (Rs)" type="number" error={err.depositPaid?.message} leftIcon={<Banknote className="h-4 w-4" />} {...register('depositPaid')} />
            <Input label="Monthly rent (Rs)" type="number" error={err.monthlyRent?.message} leftIcon={<Banknote className="h-4 w-4" />} {...register('monthlyRent')} />
          </FormGrid>
        </FormSection>
        <FormSection title="Emergency contact" description="Optional - can be added later" icon={<Shield />} divided>
          <FormGrid cols={3}>
            <Input label="Name" placeholder="Emergency contact name" error={err.emergencyName?.message} {...register('emergencyName')} />
            <Input label="Phone (10 digits)" placeholder="9876543210" error={err.emergencyPhone?.message} {...register('emergencyPhone')} />
            <Select label="Relation" options={RELATION_OPTIONS} error={err.emergencyRelation?.message} {...register('emergencyRelation')} />
          </FormGrid>
        </FormSection>
      </FormCard>
      <TempCredentialsDialog open={!!tempPassword} temporaryPassword={tempPassword} onClose={() => { setTempPassword(null); router.push(afterCreateHref); }} entityLabel="Tenant" />
    </FormPage>
  );
}

export default function NewTenantPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" /></div>}>
      <TenantForm />
    </Suspense>
  );
}
