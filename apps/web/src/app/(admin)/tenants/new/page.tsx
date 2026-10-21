'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Shield,
  UserPlus,
  UserRound,
  Mail,
  Phone,
  CalendarDays,
  Banknote,
  Building,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { TempCredentialsDialog } from '@/components/ui/TempCredentialsDialog';
import { OccupancyBedPicker } from '@/components/ui/OccupancyBedPicker';
import {
  TenantLeasePassport,
  type RoomOptionPassport,
} from '@/components/admin/TenantLeasePassport';

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
  phone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  roomId: z.string().min(1, 'Room is required'),
  bedId: z.string().min(1, 'Bed is required'),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  depositPaid: z.coerce.number().min(0, 'Must be >= 0'),
  monthlyRent: z.coerce
    .number()
    .min(1000, 'Monthly rent must be at least Rs 1000')
    .max(50000, 'Monthly rent cannot exceed Rs 50000'),
  emergencyName: z.string().optional(),
  emergencyPhone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  emergencyRelation: z.string().optional(),
  fatherOrSpouseName: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['', 'male', 'female', 'other']).optional(),
  permanentStreet: z.string().optional(),
  permanentCity: z.string().optional(),
  permanentState: z.string().optional(),
  permanentPincode: z.string().optional(),
  permanentPoliceStation: z.string().optional(),
  occupationCategory: z.enum(['', 'salaried', 'student', 'business', 'other']).optional(),
  organizationName: z.string().optional(),
  stayPurpose: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function TenantForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<RoomOptionPassport | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const prefilledName = searchParams.get('name') || '';
  const prefilledPhone = searchParams.get('phone') || '';
  const prefilledEmail = searchParams.get('email') || '';
  const enquiryId = searchParams.get('enquiryId') || '';
  const prefilledRoomId = searchParams.get('roomId') || '';
  const prefilledBedId = searchParams.get('bedId') || '';

  const afterCreateHref = enquiryId ? `/enquiries/${enquiryId}` : '/tenants';
  const todayDate = new Date().toISOString().split('T')[0];

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: prefilledName,
      email: prefilledEmail,
      phone: prefilledPhone,
      roomId: prefilledRoomId,
      bedId: prefilledBedId,
      moveInDate: todayDate,
      depositPaid: 0,
      monthlyRent: 0,
      emergencyName: '',
      emergencyPhone: '',
      emergencyRelation: '',
    },
  });

  const roomIdWatch = useWatch({ control, name: 'roomId' });
  const bedIdWatch = useWatch({ control, name: 'bedId' });
  const moveInDateWatch = useWatch({ control, name: 'moveInDate' });
  const monthlyRentWatch = useWatch({ control, name: 'monthlyRent' });
  const depositPaidWatch = useWatch({ control, name: 'depositPaid' });
  const nameWatch = useWatch({ control, name: 'name' });
  const phoneWatch = useWatch({ control, name: 'phone' });

  const onRoomChange = async (roomId: string, preserveBedId = '') => {
    setValue('roomId', roomId);
    if (preserveBedId) {
      setValue('bedId', preserveBedId);
    }
    if (!roomId) {
      setSelectedRoom(null);
      return;
    }
    try {
      const res = await api
        .get(`rooms/${roomId}`)
        .json<{ success: boolean; data: RoomOptionPassport }>();
      const room = res.data;
      setSelectedRoom(room);
      if (room.monthlyRent) {
        setValue('monthlyRent', room.monthlyRent);
        const currentDeposit = getValues('depositPaid');
        if (!currentDeposit || currentDeposit === 0) {
          setValue('depositPaid', room.monthlyRent);
        }
      }
      if (preserveBedId) {
        setValue('bedId', preserveBedId);
      }
    } catch {
      setSelectedRoom(null);
    }
  };

  useEffect(() => {
    if (prefilledRoomId) {
      void onRoomChange(prefilledRoomId, prefilledBedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledRoomId, prefilledBedId]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const hasEmergency = Boolean(data.emergencyName?.trim());
      if (hasEmergency && (!data.emergencyPhone || !data.emergencyRelation)) {
        setSubmitError('Emergency contact requires name, phone, and relation.');
        return;
      }
      const hasPermanent = Boolean(
        data.permanentStreet?.trim() ||
        data.permanentCity?.trim() ||
        data.permanentPoliceStation?.trim(),
      );
      const hasOccupation = Boolean(data.occupationCategory || data.organizationName?.trim());
      const hasVp = Boolean(
        data.fatherOrSpouseName?.trim() ||
        data.dob ||
        data.gender ||
        hasPermanent ||
        hasOccupation ||
        data.stayPurpose?.trim(),
      );

      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: normalizeInPhone(data.phone),
        roomId: data.roomId,
        bedId: data.bedId,
        moveInDate: new Date(`${data.moveInDate}T00:00:00.000Z`).toISOString(),
        depositPaid: data.depositPaid,
        monthlyRent: data.monthlyRent,
        enquiryId: enquiryId || undefined,
        emergencyContact: hasEmergency
          ? {
              name: data.emergencyName!.trim(),
              phone: normalizeInPhone(data.emergencyPhone),
              relation: data.emergencyRelation!.trim(),
            }
          : undefined,
        verificationProfile: hasVp
          ? {
              fatherOrSpouseName: data.fatherOrSpouseName?.trim() || undefined,
              dob: data.dob ? new Date(`${data.dob}T00:00:00.000Z`).toISOString() : undefined,
              gender: data.gender ? (data.gender as 'male' | 'female' | 'other') : undefined,
              permanentAddress: hasPermanent
                ? {
                    street: data.permanentStreet?.trim() || undefined,
                    city: data.permanentCity?.trim() || undefined,
                    state: data.permanentState?.trim() || undefined,
                    pincode: data.permanentPincode?.trim() || undefined,
                    policeStation: data.permanentPoliceStation?.trim() || undefined,
                  }
                : undefined,
              occupation: hasOccupation
                ? {
                    category: data.occupationCategory
                      ? (data.occupationCategory as 'salaried' | 'student' | 'business' | 'other')
                      : undefined,
                    organizationName: data.organizationName?.trim() || undefined,
                  }
                : undefined,
              stayPurpose: data.stayPurpose?.trim() || undefined,
            }
          : undefined,
      };
      const res = await api
        .post('tenants', { json: payload })
        .json<{ success: boolean; data?: { temporaryPassword?: string } }>();

      if (res.data?.temporaryPassword) {
        setTempPassword(res.data.temporaryPassword);
      } else {
        router.push(afterCreateHref);
      }
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="New Tenant"
      description="Onboard a new resident and assign to a verified room bed slot"
      backHref="/tenants"
      error={submitError}
      maxWidth="form"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* ── Left Column: Streamlined Intake Form ───────────── */}
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            {/* Unit Pre-Selected Notification Strip */}
            {selectedRoom && (
              <div className="flex items-center justify-between rounded-(--radius-xl) border border-(--color-brand-300) bg-(--color-brand-50)/60 p-4 shadow-(--shadow-sm)">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-(--radius-lg) bg-(--color-brand-500) text-(--color-on-brand) shadow-sm">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-(--color-brand-950)">
                        Room {selectedRoom.roomNumber}
                        {bedIdWatch ? ` · Bed ${bedIdWatch}` : ''}
                      </span>
                      <span className="text-3xs rounded-full bg-(--color-brand-100) px-2.5 py-0.5 font-bold tracking-wider text-(--color-brand-800) uppercase">
                        Assigned Unit
                      </span>
                    </div>
                    <p className="text-xs text-(--color-brand-700)">
                      {selectedRoom.floor?.label ?? 'Floor'} · ₹
                      {selectedRoom.monthlyRent?.toLocaleString()}/mo · {selectedRoom.sharingType}{' '}
                      Sharing
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setValue('roomId', '');
                    setValue('bedId', '');
                    setSelectedRoom(null);
                  }}
                  className="text-xs font-bold text-(--color-brand-700) underline-offset-2 hover:underline"
                >
                  Change Unit
                </button>
              </div>
            )}

            <FormCard
              footer={
                <FormActions
                  loading={isSubmitting}
                  cancelHref="/tenants"
                  submitLabel="Save Tenant & Provision Portal"
                  submitIcon={<UserPlus className="h-4 w-4" />}
                  divided={false}
                />
              }
            >
              {/* Section 1: Resident Identity */}
              <FormSection
                title="Resident Identity"
                description="Basic identity and contact details for portal access"
              >
                <FormGrid cols={3}>
                  <Input
                    label="Full name"
                    placeholder="e.g. Rahul Sharma"
                    error={err.name?.message}
                    leftIcon={<UserRound className="h-4 w-4" />}
                    required
                    {...register('name')}
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="rahul@email.com"
                    error={err.email?.message}
                    leftIcon={<Mail className="h-4 w-4" />}
                    required
                    {...register('email')}
                  />
                  <Input
                    label="Mobile Phone"
                    placeholder="+919876543210"
                    error={err.phone?.message}
                    leftIcon={<Phone className="h-4 w-4" />}
                    required
                    {...register('phone')}
                  />
                </FormGrid>
                {/* The reachability rule, in one line. The portal login, the
                    temporary password and every message the office sends use
                    this number, so a resident without one cannot be reached. */}
                <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-secondary)">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-500)" />
                  {phoneWatch
                    ? `The resident is reached on ${phoneWatch}. The server refuses an email or a phone another account already uses, and it sends no message: the office hands over the temporary password by hand.`
                    : 'A mobile number is required: the portal login, the temporary password and every message the office sends use this number. A resident the office cannot reach is a resident it cannot settle in.'}
                </p>
              </FormSection>

              {/* Section 2: Room & Bed Assignment */}
              <FormSection
                title="Room & Bed Allocation"
                description="Select or verify room and bed vacancy"
                divided
              >
                <FormGrid cols={2}>
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
                        labelKey={(item) => {
                          const r = item as unknown as RoomOptionPassport;
                          return `Room ${r.roomNumber} — ${r.floor?.label ?? '?'}`;
                        }}
                        sublabelFn={(item) => {
                          const r = item as unknown as RoomOptionPassport;
                          return `₹${r.monthlyRent?.toLocaleString()}/mo · ${r.sharingType} sharing`;
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
                        roomId={selectedRoom?._id ?? roomIdWatch ?? null}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={err.bedId?.message}
                      />
                    )}
                  />
                </FormGrid>
              </FormSection>

              {/* Section 3: Move-In & Financial Terms */}
              <FormSection
                title="Move-In & Financial Terms"
                description="Stay start date, security deposit, and monthly recurring rent"
                divided
              >
                <FormGrid cols={3}>
                  <DatePicker
                    label="Move-in date"
                    error={err.moveInDate?.message}
                    leftIcon={<CalendarDays className="h-4 w-4" />}
                    required
                    {...register('moveInDate')}
                  />
                  <div>
                    <Input
                      label="Security Deposit (Rs)"
                      type="number"
                      error={err.depositPaid?.message}
                      leftIcon={<Banknote className="h-4 w-4" />}
                      {...register('depositPaid')}
                    />
                    {selectedRoom?.monthlyRent ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setValue('depositPaid', selectedRoom.monthlyRent)}
                          className="text-3xs rounded bg-(--color-field-bg) px-1.5 py-0.5 font-semibold text-(--color-brand-600) hover:bg-(--color-brand-50)"
                        >
                          1 Mo (₹{selectedRoom.monthlyRent.toLocaleString()})
                        </button>
                        <button
                          type="button"
                          onClick={() => setValue('depositPaid', 0)}
                          className="text-3xs rounded bg-(--color-field-bg) px-1.5 py-0.5 font-semibold text-(--color-text-muted) hover:bg-(--color-surface-200)"
                        >
                          No Deposit
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <Input
                    label="Monthly rent (Rs)"
                    type="number"
                    error={err.monthlyRent?.message}
                    leftIcon={<Banknote className="h-4 w-4" />}
                    required
                    {...register('monthlyRent')}
                  />
                </FormGrid>
              </FormSection>

              {/* Section 4: Emergency Contact */}
              <FormSection
                title="Emergency Contact"
                description="Optional — Guardian or relative emergency details"
                icon={<Shield className="h-4 w-4" />}
                divided
              >
                <FormGrid cols={3}>
                  <Input
                    label="Contact Name"
                    placeholder="e.g. Suresh Sharma"
                    error={err.emergencyName?.message}
                    {...register('emergencyName')}
                  />
                  <Input
                    label="Contact Phone"
                    placeholder="+919876543210"
                    error={err.emergencyPhone?.message}
                    {...register('emergencyPhone')}
                  />
                  <Select
                    label="Relationship"
                    options={RELATION_OPTIONS}
                    error={err.emergencyRelation?.message}
                    {...register('emergencyRelation')}
                  />
                </FormGrid>
              </FormSection>

              {/* Section 5: Police Verification & Statutory Profile (Optional) */}
              <FormSection
                title="Police Verification (Optional at Intake)"
                icon={<Shield className="h-4 w-4" />}
                description="Permanent native address, jurisdiction police station, and occupation details"
                divided
              >
                <FormGrid cols={3}>
                  <Input
                    label="Father / Spouse Name"
                    placeholder="Full name"
                    {...register('fatherOrSpouseName')}
                  />
                  <DatePicker
                    label="Date of Birth"
                    error={err.dob?.message}
                    leftIcon={<CalendarDays className="h-4 w-4" />}
                    {...register('dob')}
                  />
                  <Select
                    label="Gender"
                    options={[
                      { value: '', label: 'Select gender' },
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' },
                    ]}
                    {...register('gender')}
                  />
                </FormGrid>

                <FormGrid cols={3}>
                  <Input
                    label="Native City / Town"
                    placeholder="City"
                    {...register('permanentCity')}
                  />
                  <Input label="Native State" placeholder="State" {...register('permanentState')} />
                  <Input
                    label="Native Police Station"
                    placeholder="Police Station jurisdiction"
                    {...register('permanentPoliceStation')}
                  />
                </FormGrid>

                <FormGrid cols={2}>
                  <Input
                    label="Organization / College"
                    placeholder="Workplace or university"
                    {...register('organizationName')}
                  />
                  <Input
                    label="Purpose of Stay"
                    placeholder="Employment / Higher Education"
                    {...register('stayPurpose')}
                  />
                </FormGrid>
              </FormSection>
            </FormCard>
          </div>

          {/* ── Right Column: Sticky Room & Lease Passport ──────── */}
          <div className="space-y-4 lg:col-span-5 xl:col-span-4">
            <TenantLeasePassport
              room={selectedRoom}
              selectedBedId={bedIdWatch}
              moveInDate={moveInDateWatch}
              monthlyRent={monthlyRentWatch}
              depositPaid={depositPaidWatch}
              tenantName={nameWatch}
              tenantPhone={phoneWatch}
            />

            {/* What this save does. The office has to know what the server
                will commit before it commits it, and what it will not do. */}
            <div className="rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
              <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
                What this save does
              </h3>
              <ul className="mt-3 space-y-2.5">
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The server creates the portal login for the resident with a temporary password.
                    The password is shown once, on this screen, and the server sends no message: the
                    office hands it over.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The bed you pick is marked occupied in that room and the room&apos;s occupancy
                    count is updated. The server refuses a bed that is already taken (BED_OCCUPIED),
                    and it refuses a room that is not active.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The resident record starts in house, with the move-in date you type and no
                    move-out date. The bed is taken for the stay, not held on probation: it is freed
                    by a check out, by a transfer from the resident&apos;s page, or by a delete.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    Nothing is billed. The first invoice is raised by the office from the monthly
                    rent on this form, and the deposit is a record of what was taken, not a payment.
                  </span>
                </li>
                {enquiryId ? (
                  <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                    <span>
                      This resident came from an enquiry, so the server marks that enquiry converted
                      and points it at the new resident.
                    </span>
                  </li>
                ) : null}
              </ul>

              <div className="mt-4 border-t border-(--border-color) pt-3">
                <p className="tracking-label text-2xs font-bold text-(--color-text-muted) uppercase">
                  Still open before the resident is settled in
                </p>
                <ul className="text-2xs mt-2 space-y-1.5 font-medium text-(--color-text-secondary)">
                  <li>The identity document and the photo are uploaded and verified.</li>
                  <li>The office handed the temporary password over and the resident signed in.</li>
                  <li>A guardian is linked, so there is somebody to call in an emergency.</li>
                  <li>The first invoice of the month of arrival is raised.</li>
                </ul>
                <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                  The server holds the office back on none of these: they are the office&apos;s own
                  steps, and the resident page shows the identity ones.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>

      <TempCredentialsDialog
        open={!!tempPassword}
        temporaryPassword={tempPassword}
        onClose={() => {
          setTempPassword(null);
          router.push(afterCreateHref);
        }}
        entityLabel="Tenant"
      />
    </FormPage>
  );
}

export default function NewTenantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <TenantForm />
    </Suspense>
  );
}
