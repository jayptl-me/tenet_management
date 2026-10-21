'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Shield,
  UserRound,
  Mail,
  Phone,
  CalendarDays,
  Banknote,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
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
  phone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
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
  emergencyPhone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  emergencyRelation: z.string().optional(),
  // Police Verification & Legal Profile
  fatherOrSpouseName: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['', 'male', 'female', 'other']).optional(),
  bloodGroup: z.string().optional(),
  identificationMark: z.string().optional(),
  permanentStreet: z.string().optional(),
  permanentCity: z.string().optional(),
  permanentDistrict: z.string().optional(),
  permanentState: z.string().optional(),
  permanentPincode: z.string().optional(),
  permanentPoliceStation: z.string().optional(),
  occupationCategory: z.enum(['', 'salaried', 'student', 'business', 'other']).optional(),
  organizationName: z.string().optional(),
  officeAddress: z.string().optional(),
  officePhone: z.string().optional(),
  stayPurpose: z.string().optional(),
  ref1Name: z.string().optional(),
  ref1Phone: z.string().optional(),
  ref1Relation: z.string().optional(),
  ref1Address: z.string().optional(),
  ref2Name: z.string().optional(),
  ref2Phone: z.string().optional(),
  ref2Relation: z.string().optional(),
  ref2Address: z.string().optional(),
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

/** The resident record the server holds, read by the edit page. */
interface TenantRecord {
  _id: string;
  user?: Record<string, unknown>;
  room?: { _id?: string; roomNumber?: string };
  roomId?: string;
  bedId?: string;
  monthlyRent?: number;
  depositPaid?: number;
  moveInDate?: string;
  isActive?: boolean;
  documents?: {
    idType?: string;
    idNumberMasked?: string;
    idUrl?: string;
    aadhaarUrl?: string;
    photoUrl?: string;
    isVerified?: boolean;
  };
  emergencyContact?: Record<string, string>;
  verificationProfile?: Record<string, unknown>;
}

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  /**
   * The resident record, read through the shared query stack.
   *
   * The page used to fetch the record with a hand written effect outside
   * React Query, so the cache never knew what it held and the write could not
   * invalidate anything. The record is now read once and the form is filled
   * from it.
   */
  const {
    data: tenantData,
    isPending: isLoading,
    error: loadError,
  } = useApiQuery<TenantRecord>(['tenants', 'detail', id], `tenants/${id}`, { enabled: !!id });

  // The room, the bed and the stay state come from the record, never from a
  // second copy of the truth.
  const isActive = tenantData ? tenantData.isActive !== false : true;
  const currentBedId = tenantData?.bedId ?? '';
  const originalRoomId = tenantData?.room?._id ?? tenantData?.roomId ?? '';

  const roomIdWatch = useWatch({ control, name: 'roomId' });

  // The form is filled once per record: a re-read of the same record must not
  // wipe what the operator has typed.
  const hydratedId = useRef('');
  useEffect(() => {
    if (!tenantData) return;
    if (hydratedId.current === tenantData._id) return;
    hydratedId.current = tenantData._id;

    const user = (tenantData.user ?? {}) as Record<string, unknown>;
    const ec = (tenantData.emergencyContact ?? {}) as Record<string, string>;
    const vp = (tenantData.verificationProfile ?? {}) as Record<string, unknown>;
    const perm = (vp.permanentAddress ?? {}) as Record<string, string>;
    const occ = (vp.occupation ?? {}) as Record<string, string>;
    const refs = (vp.localReferences ?? []) as Array<Record<string, string>>;
    const ref1 = refs[0] ?? {};
    const ref2 = refs[1] ?? {};

    reset({
      name: (user.name as string) ?? '',
      phone: (user.phone as string) ?? '',
      email: (user.email as string) ?? '',
      roomId: originalRoomId,
      bedId: currentBedId,
      monthlyRent: tenantData.monthlyRent ?? 0,
      depositPaid: tenantData.depositPaid ?? 0,
      moveInDate: tenantData.moveInDate ? String(tenantData.moveInDate).slice(0, 10) : '',
      emergencyName: ec.name ?? '',
      emergencyPhone: (ec.phone ?? '').replace('+91', ''),
      emergencyRelation: ec.relation ?? '',
      fatherOrSpouseName: (vp.fatherOrSpouseName as string) ?? '',
      dob: vp.dob ? String(vp.dob).slice(0, 10) : '',
      gender: ((vp.gender as string) || '') as '' | 'male' | 'female' | 'other',
      bloodGroup: (vp.bloodGroup as string) ?? '',
      identificationMark: (vp.identificationMark as string) ?? '',
      permanentStreet: perm.street ?? '',
      permanentCity: perm.city ?? '',
      permanentDistrict: perm.district ?? '',
      permanentState: perm.state ?? '',
      permanentPincode: perm.pincode ?? '',
      permanentPoliceStation: perm.policeStation ?? '',
      occupationCategory: ((occ.category as string) || '') as
        '' | 'salaried' | 'student' | 'business' | 'other',
      organizationName: occ.organizationName ?? '',
      officeAddress: occ.officeAddress ?? '',
      officePhone: occ.contactPhone ?? '',
      stayPurpose: (vp.stayPurpose as string) ?? '',
      ref1Name: ref1.name ?? '',
      ref1Phone: (ref1.phone ?? '').replace('+91', ''),
      ref1Relation: ref1.relation ?? '',
      ref1Address: ref1.address ?? '',
      ref2Name: ref2.name ?? '',
      ref2Phone: (ref2.phone ?? '').replace('+91', ''),
      ref2Relation: ref2.relation ?? '',
      ref2Address: ref2.address ?? '',
    });
  }, [tenantData, originalRoomId, currentBedId, reset]);

  const onRoomChange = async (roomId: string) => {
    setValue('roomId', roomId);
    const keepBed = roomId === originalRoomId ? currentBedId : '';
    if (!keepBed) setValue('bedId', '');
    try {
      const res = await api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomOption }>();
      if (res.data.monthlyRent) setValue('monthlyRent', res.data.monthlyRent);
    } catch {
      /* the room could not be read: the operator keeps the rent they typed */
    }
  };

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
      const hasOccupation = Boolean(
        data.occupationCategory || data.organizationName?.trim() || data.officeAddress?.trim(),
      );
      const hasRef1 = Boolean(data.ref1Name?.trim() && data.ref1Phone?.trim());
      const hasRef2 = Boolean(data.ref2Name?.trim() && data.ref2Phone?.trim());

      const localReferences: Array<{
        name: string;
        phone: string;
        relation?: string;
        address?: string;
      }> = [];
      if (hasRef1) {
        localReferences.push({
          name: data.ref1Name!.trim(),
          phone: normalizeInPhone(data.ref1Phone!),
          relation: data.ref1Relation?.trim() || undefined,
          address: data.ref1Address?.trim() || undefined,
        });
      }
      if (hasRef2) {
        localReferences.push({
          name: data.ref2Name!.trim(),
          phone: normalizeInPhone(data.ref2Phone!),
          relation: data.ref2Relation?.trim() || undefined,
          address: data.ref2Address?.trim() || undefined,
        });
      }

      const payload: Record<string, unknown> = {
        monthlyRent: data.monthlyRent,
        depositPaid: data.depositPaid,
        moveInDate: data.moveInDate
          ? new Date(`${data.moveInDate}T00:00:00.000Z`).toISOString()
          : undefined,
        user: { name: data.name, phone: normalizeInPhone(data.phone), email: data.email },
        emergencyContact: hasEmergency
          ? {
              name: data.emergencyName!.trim(),
              phone: normalizeInPhone(data.emergencyPhone),
              relation: data.emergencyRelation!.trim(),
            }
          : undefined,
        verificationProfile: {
          fatherOrSpouseName: data.fatherOrSpouseName?.trim() || undefined,
          dob: data.dob ? new Date(`${data.dob}T00:00:00.000Z`).toISOString() : undefined,
          gender: data.gender ? (data.gender as 'male' | 'female' | 'other') : undefined,
          bloodGroup: data.bloodGroup?.trim() || undefined,
          identificationMark: data.identificationMark?.trim() || undefined,
          permanentAddress: hasPermanent
            ? {
                street: data.permanentStreet?.trim() || undefined,
                city: data.permanentCity?.trim() || undefined,
                district: data.permanentDistrict?.trim() || undefined,
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
                officeAddress: data.officeAddress?.trim() || undefined,
                contactPhone: data.officePhone?.trim() || undefined,
              }
            : undefined,
          localReferences: localReferences.length > 0 ? localReferences : undefined,
          stayPurpose: data.stayPurpose?.trim() || undefined,
        },
      };
      // Inactive tenants cannot transfer rooms; omit room/bed so API does not treat as transfer.
      if (isActive) {
        payload.bedId = data.bedId;
        payload.roomId = data.roomId;
      }
      await api.put(`tenants/${id}`, { json: payload }).json();
      // The record, its dues and the roster are re-read from the server.
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
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
      error={submitError || errorMessage(loadError)}
      isLoading={isLoading}
      maxWidth="form"
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
          <div className="mb-6 flex items-start gap-3 rounded-(--radius-lg) border border-(--color-warning-300) bg-(--color-warning-50) p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-(--color-warning-600)" />
            <div className="text-sm font-semibold text-(--color-warning-800)">
              <p>Checked out - reinstate before transferring</p>
              <p className="mt-1 text-xs font-medium text-(--color-warning-700)">
                Room and bed assignment is locked while this tenant is inactive.{' '}
                <Link
                  href={`/tenants/${id}`}
                  className="underline underline-offset-2 hover:text-(--color-warning-900)"
                >
                  Open tenant detail to reinstate
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {/* What this save does to the resident. An edit moves what they owe
            and what they are told, and the office has to know both. */}
        <div className="mb-6 rounded-(--radius-lg) border border-(--color-info-200) bg-(--color-info-50) p-4">
          <p className="tracking-label text-2xs font-bold text-(--color-info-800) uppercase">
            What this save does
          </p>
          <ul className="text-2xs mt-2 space-y-1.5 font-medium text-(--color-info-800)">
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                The monthly rent is what the server raises every new invoice from. Changing it moves
                what the resident owes from the NEXT invoice; the invoices already issued keep the
                amounts they carry.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                The deposit is what the office recorded as taken. It is not a payment and it does
                not reduce the dues the server reports.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                The phone, the email and the emergency contact are what the resident reads on their
                profile and what the office calls.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Moving the resident to another room or bed frees the old bed and takes the new one
                in one transaction. The server refuses a bed that is taken, and it refuses a
                transfer while the resident is checked out.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-(--color-warning-600)" />
              <span>
                The resident is not told. The server sends no notification for an edit, and it
                writes no audit entry for a rent or a contact change: only a room or a bed transfer
                is written down, as a tenant_transfer entry.
              </span>
            </li>
          </ul>
        </div>

        <FormSection
          title="Personal information"
          description="Primary contact details used across invoices and notices"
        >
          <FormGrid>
            <Input
              label="Name"
              error={err.name?.message}
              autoComplete="name"
              leftIcon={<UserRound className="h-4 w-4" />}
              {...register('name')}
            />
            <Input
              label="Phone"
              error={err.phone?.message}
              inputMode="tel"
              autoComplete="tel"
              leftIcon={<Phone className="h-4 w-4" />}
              {...register('phone')}
            />
            <Input
              label="Email"
              type="email"
              error={err.email?.message}
              autoComplete="email"
              leftIcon={<Mail className="h-4 w-4" />}
              {...register('email')}
            />
          </FormGrid>
        </FormSection>

        {isActive ? (
          <FormSection
            title="Room assignment"
            description="Only free beds (plus this tenant's current bed) appear for the selected room"
            divided
          >
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
            <p className="text-sm font-semibold text-(--color-text-muted)">
              Current placement is preserved. Use reinstate on the detail page to assign a bed.
            </p>
          </FormSection>
        )}

        <FormSection
          title="Financial details"
          description="Rent and deposit used for invoicing"
          divided
        >
          <FormGrid cols={3}>
            <Input
              label="Monthly rent"
              type="number"
              step="0.01"
              inputMode="decimal"
              error={err.monthlyRent?.message}
              leftIcon={<Banknote className="h-4 w-4" />}
              {...register('monthlyRent')}
            />
            <Input
              label="Deposit paid"
              type="number"
              step="0.01"
              inputMode="decimal"
              error={err.depositPaid?.message}
              leftIcon={<Banknote className="h-4 w-4" />}
              {...register('depositPaid')}
            />
            <DatePicker
              label="Move-in date"
              error={err.moveInDate?.message}
              leftIcon={<CalendarDays className="h-4 w-4" />}
              {...register('moveInDate')}
            />
          </FormGrid>
        </FormSection>
        <FormSection
          title="Emergency contact"
          icon={<Shield />}
          description="Optional guardian or relative for emergencies"
          divided
        >
          <FormGrid cols={3}>
            <Input
              label="Name"
              placeholder="Emergency contact name"
              error={err.emergencyName?.message}
              {...register('emergencyName')}
            />
            <Input
              label="Phone (10 digits)"
              placeholder="9876543210"
              inputMode="tel"
              error={err.emergencyPhone?.message}
              {...register('emergencyPhone')}
            />
            <Select
              label="Relation"
              options={RELATION_OPTIONS}
              error={err.emergencyRelation?.message}
              {...register('emergencyRelation')}
            />
          </FormGrid>
        </FormSection>
        <FormSection
          title="Police Verification & Statutory Profile"
          icon={<Shield />}
          description="Statutory resident details required under Bharatiya Nyaya Sanhita (Section 223) and State Police Acts"
          divided
        >
          <FormGrid cols={3}>
            <Input
              label="Father / Spouse Name"
              placeholder="Full name of parent or spouse"
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
            <Input label="Blood Group" placeholder="e.g. O+, B+, A+" {...register('bloodGroup')} />
            <Input
              label="Identification Mark"
              placeholder="e.g. Mole on right wrist"
              {...register('identificationMark')}
            />
            <Input
              label="Purpose of Stay"
              placeholder="Employment / Higher Studies"
              {...register('stayPurpose')}
            />
          </FormGrid>

          <p className="mt-4 text-xs font-semibold tracking-wider text-(--color-text-secondary) uppercase">
            Permanent Native Address (with Police Station)
          </p>
          <FormGrid cols={3}>
            <Input
              label="Street Address / House #"
              placeholder="House #, Street name"
              {...register('permanentStreet')}
            />
            <Input label="City / Town" placeholder="City" {...register('permanentCity')} />
            <Input label="District" placeholder="District" {...register('permanentDistrict')} />
          </FormGrid>
          <FormGrid cols={3}>
            <Input label="State" placeholder="State" {...register('permanentState')} />
            <Input
              label="PIN Code (6 digits)"
              placeholder="560001"
              maxLength={6}
              {...register('permanentPincode')}
            />
            <Input
              label="Native Police Station"
              placeholder="Jurisdiction Police Station"
              {...register('permanentPoliceStation')}
            />
          </FormGrid>

          <p className="mt-4 text-xs font-semibold tracking-wider text-(--color-text-secondary) uppercase">
            Workplace / College Details
          </p>
          <FormGrid cols={3}>
            <Select
              label="Occupation Category"
              options={[
                { value: '', label: 'Select category' },
                { value: 'salaried', label: 'Salaried / Professional' },
                { value: 'student', label: 'Student / College' },
                { value: 'business', label: 'Self-Employed / Business' },
                { value: 'other', label: 'Other' },
              ]}
              {...register('occupationCategory')}
            />
            <Input
              label="Company / College Name"
              placeholder="Organization name"
              {...register('organizationName')}
            />
            <Input
              label="Office / College Phone"
              placeholder="Contact number"
              {...register('officePhone')}
            />
          </FormGrid>
          <div className="mt-3">
            <Input
              label="Office / College Full Address"
              placeholder="Office or campus address"
              {...register('officeAddress')}
            />
          </div>

          <p className="mt-4 text-xs font-semibold tracking-wider text-(--color-text-secondary) uppercase">
            Two Local Guarantors / City References
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
              <span className="text-xs font-bold text-(--color-brand-700)">Local Reference 1</span>
              <Input label="Name" placeholder="Guarantor name" {...register('ref1Name')} />
              <Input label="Phone" placeholder="10-digit mobile" {...register('ref1Phone')} />
              <Input
                label="Relation"
                placeholder="Friend, Colleague, Relative"
                {...register('ref1Relation')}
              />
              <Input
                label="City Address"
                placeholder="Address in current city"
                {...register('ref1Address')}
              />
            </div>
            <div className="space-y-3 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
              <span className="text-xs font-bold text-(--color-brand-700)">Local Reference 2</span>
              <Input label="Name" placeholder="Guarantor name" {...register('ref2Name')} />
              <Input label="Phone" placeholder="10-digit mobile" {...register('ref2Phone')} />
              <Input
                label="Relation"
                placeholder="Friend, Colleague, Relative"
                {...register('ref2Relation')}
              />
              <Input
                label="City Address"
                placeholder="Address in current city"
                {...register('ref2Address')}
              />
            </div>
          </div>
        </FormSection>

        {tenantData && (
          <FormSection
            title="Documents & KYC"
            description="Official identity document (OVD) and resident photo stored with authenticated encryption"
            divided
          >
            <p className="text-2xs font-medium text-(--color-text-muted)">
              Uploading a file from the office replaces it and leaves the verdict as it is. A
              resident who uploads their own document from the portal flips the verification back to
              pending, and the office has to verify them again.
            </p>
            <FormGrid>
              <DocumentUpload
                tenantId={id}
                docType={tenantData.documents?.idType || 'aadhaar'}
                currentUrl={tenantData.documents?.idUrl || tenantData.documents?.aadhaarUrl}
                idNumberMasked={tenantData.documents?.idNumberMasked}
                isVerified={Boolean(tenantData.documents?.isVerified)}
                onUploaded={() =>
                  queryClient.invalidateQueries({ queryKey: ['tenants', 'detail', id] })
                }
              />
              <DocumentUpload
                tenantId={id}
                docType="photo"
                currentUrl={tenantData.documents?.photoUrl}
                isVerified={Boolean(tenantData.documents?.isVerified)}
                onUploaded={() =>
                  queryClient.invalidateQueries({ queryKey: ['tenants', 'detail', id] })
                }
              />
            </FormGrid>
          </FormSection>
        )}
      </FormCard>
    </FormPage>
  );
}
