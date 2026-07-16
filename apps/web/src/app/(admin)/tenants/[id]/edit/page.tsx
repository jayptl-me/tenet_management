'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, UserRound, Mail, Phone, CalendarDays, Banknote, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { OccupancyBedPicker } from '@/components/ui/OccupancyBedPicker';
import { DocumentUpload } from '@/components/ui/DocumentUpload';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';

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
  phone: z.string().min(10, 'Phone is required').refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  email: z.string().email('Invalid email'),
  roomId: z.string().min(1, 'Room is required'),
  bedId: z.string().min(1, 'Bed is required'),
  monthlyRent: z.coerce
    .number()
    .min(1000, 'Monthly rent must be at least Rs 1000')
    .max(50000, 'Monthly rent cannot exceed Rs 50000'),
  depositPaid: z.coerce.number().min(0, 'Deposit cannot be negative'),
  moveInDate: z.string().optional(),
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
  beds?: Array<{ bedId: string; isOccupied: boolean; tenantId?: string | null }>;
}

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [tenantData, setTenantData] = useState<Record<string, unknown> | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [currentBedId, setCurrentBedId] = useState('');
  const [originalRoomId, setOriginalRoomId] = useState('');

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const roomIdWatch = useWatch({ control, name: 'roomId' });

  useEffect(() => {
    if (!id) return;
    api.get(`tenants/${id}`).json<{ success: boolean; data: Record<string, unknown> }>()
      .then((res) => {
        const d = res.data;
        setTenantData(d);
        const user = (d.user ?? {}) as Record<string, unknown>;
        const room = (d.room ?? {}) as Record<string, unknown>;
        const ec = (d.emergencyContact ?? {}) as Record<string, string>;
        const roomId = (room._id as string) ?? (d.roomId as string) ?? '';
        const bedId = (d.bedId as string) ?? '';
        const active = d.isActive !== false;
        setIsActive(active);
        setCurrentBedId(bedId);
        setOriginalRoomId(roomId);
        reset({
          name: (user.name as string) ?? '', phone: (user.phone as string) ?? '', email: (user.email as string) ?? '',
          roomId, bedId, monthlyRent: (d.monthlyRent as number) ?? 0, depositPaid: (d.depositPaid as number) ?? 0,
          moveInDate: (d.moveInDate as string) ? String(d.moveInDate).slice(0, 10) : '',
          emergencyName: ec.name ?? '', emergencyPhone: (ec.phone as string)?.replace('+91', '') ?? '', emergencyRelation: ec.relation ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => { setSubmitError('Failed to load tenant'); setIsLoading(false); });
  }, [id, reset]);

  const onRoomChange = useCallback(async (roomId: string) => {
    setValue('roomId', roomId);
    const originalRoomId =
      ((tenantData?.room as { _id?: string } | undefined)?._id ?? tenantData?.roomId) as string | undefined;
    const keepBed = roomId === originalRoomId ? currentBedId : '';
    if (!keepBed) setValue('bedId', '');
    try {
      const res = await api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomOption }>();
      if (res.data.monthlyRent) setValue('monthlyRent', res.data.monthlyRent);
    } catch {
      /* ignore */
    }
  }, [tenantData, currentBedId, setValue]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const hasEmergency = Boolean(data.emergencyName?.trim());
      if (hasEmergency && (!data.emergencyPhone || !data.emergencyRelation)) {
        setSubmitError('Emergency contact requires name, phone, and relation.');
        return;
      }
      const payload: Record<string, unknown> = {
        monthlyRent: data.monthlyRent,
        depositPaid: data.depositPaid,
        moveInDate: data.moveInDate ? new Date(`${data.moveInDate}T00:00:00.000Z`).toISOString() : undefined,
        user: { name: data.name, phone: normalizeInPhone(data.phone), email: data.email },
        emergencyContact: hasEmergency
          ? {
              name: data.emergencyName!.trim(),
              phone: normalizeInPhone(data.emergencyPhone),
              relation: data.emergencyRelation!.trim(),
            }
          : undefined,
      };
      // Inactive tenants cannot transfer rooms; omit room/bed so API does not treat as transfer.
      if (isActive) {
        payload.bedId = data.bedId;
        payload.roomId = data.roomId;
      }
      await api.put(`tenants/${id}`, { json: payload }).json();
      router.push(`/tenants/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Tenant"
      description="Update contact info, room assignment, rent, and documents"
      backHref={`/tenants/${id}`}
      error={submitError}
      isLoading={isLoading}
      maxWidth="4xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref={`/tenants/${id}`}
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        {!isActive && (
          <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-warning-600)]" />
            <div className="text-sm font-semibold text-[color:var(--color-warning-800)]">
              <p>Checked out - reinstate before transferring</p>
              <p className="mt-1 text-xs font-medium text-[color:var(--color-warning-700)]">
                Room and bed assignment is locked while this tenant is inactive.{' '}
                <Link
                  href={`/tenants/${id}`}
                  className="underline underline-offset-2 hover:text-[color:var(--color-warning-900)]"
                >
                  Open tenant detail to reinstate
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        <FormSection title="Personal information" description="Primary contact details used across invoices and notices">
          <FormGrid>
            <Input label="Name" error={err.name?.message} autoComplete="name" leftIcon={<UserRound className="h-4 w-4" />} {...register('name')} />
            <Input label="Phone" error={err.phone?.message} inputMode="tel" autoComplete="tel" leftIcon={<Phone className="h-4 w-4" />} {...register('phone')} />
            <Input label="Email" type="email" error={err.email?.message} autoComplete="email" leftIcon={<Mail className="h-4 w-4" />} {...register('email')} />
          </FormGrid>
        </FormSection>

        {isActive ? (
          <FormSection title="Room assignment" description="Only free beds (plus this tenant's current bed) appear for the selected room" divided>
            <FormGrid>
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
                      void onRoomChange(val);
                    }}
                    placeholder="Select room..."
                    error={err.roomId?.message}
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
                )}
              />
              <Controller
                name="bedId"
                control={control}
                render={({ field }) => (
                  <OccupancyBedPicker
                    roomId={roomIdWatch || null}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    currentBedId={
                      roomIdWatch && roomIdWatch === originalRoomId ? currentBedId : undefined
                    }
                    error={err.bedId?.message}
                  />
                )}
              />
            </FormGrid>
          </FormSection>
        ) : (
          <FormSection
            title="Room assignment"
            description="Transfer is disabled until the tenant is reinstated"
            divided
          >
            <p className="text-sm font-semibold text-[color:var(--color-text-muted)]">
              Current placement is preserved. Use reinstate on the detail page to assign a bed.
            </p>
          </FormSection>
        )}

        <FormSection title="Financial details" description="Rent and deposit used for invoicing" divided>
          <FormGrid cols={3}>
            <Input label="Monthly rent" type="number" step="0.01" inputMode="decimal" error={err.monthlyRent?.message} leftIcon={<Banknote className="h-4 w-4" />} {...register('monthlyRent')} />
            <Input label="Deposit paid" type="number" step="0.01" inputMode="decimal" error={err.depositPaid?.message} leftIcon={<Banknote className="h-4 w-4" />} {...register('depositPaid')} />
            <Input label="Move-in date" type="date" error={err.moveInDate?.message} leftIcon={<CalendarDays className="h-4 w-4" />} {...register('moveInDate')} />
          </FormGrid>
        </FormSection>
        <FormSection title="Emergency contact" icon={<Shield />} description="Optional guardian or relative for emergencies" divided>
          <FormGrid cols={3}>
            <Input label="Name" placeholder="Emergency contact name" error={err.emergencyName?.message} {...register('emergencyName')} />
            <Input label="Phone (10 digits)" placeholder="9876543210" inputMode="tel" error={err.emergencyPhone?.message} {...register('emergencyPhone')} />
            <Select label="Relation" options={RELATION_OPTIONS} error={err.emergencyRelation?.message} {...register('emergencyRelation')} />
          </FormGrid>
        </FormSection>
        {tenantData && (
          <FormSection title="Documents" description="Aadhaar and photo are stored securely for this tenant" divided>
            <FormGrid>
              <DocumentUpload tenantId={id} docType="aadhaar" currentUrl={(tenantData.documents as Record<string, string>)?.aadhaarUrl}
                onUploaded={(url) => setTenantData((prev) => prev ? { ...prev, documents: { ...((prev.documents as Record<string, string>) ?? {}), aadhaarUrl: url } } : prev)} />
              <DocumentUpload tenantId={id} docType="photo" currentUrl={(tenantData.documents as Record<string, string>)?.photoUrl}
                onUploaded={(url) => setTenantData((prev) => prev ? { ...prev, documents: { ...((prev.documents as Record<string, string>) ?? {}), photoUrl: url } } : prev)} />
            </FormGrid>
          </FormSection>
        )}
      </FormCard>
    </FormPage>
  );
}
