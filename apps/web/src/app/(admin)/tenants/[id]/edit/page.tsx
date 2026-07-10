'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, UserRound, Mail, Phone, CalendarDays, Banknote } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { DocumentUpload } from '@/components/ui/DocumentUpload';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';

const ALL_BEDS = [
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
  const [bedOptions, setBedOptions] = useState(ALL_BEDS);
  const [currentBedId, setCurrentBedId] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const roomIdWatch = useWatch({ control, name: 'roomId' });

  const loadBedOptions = useCallback(
    async (roomId: string, keepBedId: string) => {
      if (!roomId) {
        setBedOptions(ALL_BEDS);
        return;
      }
      try {
        const res = await api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomOption }>();
        const room = res.data;
        const maxBeds = room.sharingType ?? 4;
        const beds = ALL_BEDS.slice(0, maxBeds).map((b) => {
          const bedMeta = room.beds?.find((x) => x.bedId === b.value);
          const occupiedByOther =
            !!bedMeta?.isOccupied &&
            String(bedMeta.tenantId ?? '') !== String(id) &&
            b.value !== keepBedId;
          return {
            value: b.value,
            label: occupiedByOther ? `${b.label} (Occupied)` : b.label,
            disabled: occupiedByOther,
          };
        });
        setBedOptions(
          beds
            .filter((b) => !b.disabled || b.value === keepBedId)
            .map(({ value, label }) => ({ value, label })),
        );
      } catch {
        setBedOptions(ALL_BEDS.slice(0, 4));
      }
    },
    [id],
  );

  useEffect(() => {
    if (!id) return;
    api
      .get(`tenants/${id}`)
      .json<{ success: boolean; data: Record<string, unknown> }>()
      .then(async (res) => {
        const d = res.data;
        setTenantData(d);
        const user = (d.user ?? {}) as Record<string, unknown>;
        const room = (d.room ?? {}) as Record<string, unknown>;
        const ec = (d.emergencyContact ?? {}) as Record<string, string>;
        const roomId = (room._id as string) ?? (d.roomId as string) ?? '';
        const bedId = (d.bedId as string) ?? '';
        setCurrentBedId(bedId);

        reset({
          name: (user.name as string) ?? '',
          phone: (user.phone as string) ?? '',
          email: (user.email as string) ?? '',
          roomId,
          bedId,
          monthlyRent: (d.monthlyRent as number) ?? 0,
          depositPaid: (d.depositPaid as number) ?? 0,
          isActive: (d.isActive as boolean) ? 'true' : 'false',
          moveInDate: (d.moveInDate as string) ? String(d.moveInDate).slice(0, 10) : '',
          emergencyName: ec.name ?? '',
          emergencyPhone: (ec.phone as string)?.replace('+91', '') ?? '',
          emergencyRelation: ec.relation ?? '',
        });
        await loadBedOptions(roomId, bedId);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load tenant');
        setIsLoading(false);
      });
  }, [id, reset, loadBedOptions]);

  const onRoomChange = useCallback(
    async (roomId: string) => {
      setValue('roomId', roomId);
      const keepBed =
        roomId === ((tenantData?.room as { _id?: string } | undefined)?._id ?? tenantData?.roomId)
          ? currentBedId
          : '';
      if (!keepBed) setValue('bedId', '');
      try {
        const res = await api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomOption }>();
        if (res.data.monthlyRent) setValue('monthlyRent', res.data.monthlyRent);
      } catch {
        /* ignore */
      }
      await loadBedOptions(roomId, keepBed);
    },
    [tenantData, currentBedId, setValue, loadBedOptions],
  );

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

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Tenant"
      description="Update contact info, room assignment, rent, and documents"
      backHref="/tenants"
      error={submitError}
      isLoading={isLoading}
      maxWidth="4xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/tenants"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
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
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              error={err.isActive?.message}
              {...register('isActive')}
            />
          </FormGrid>
        </FormSection>

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
                    return `Room ${r.roomNumber} — ${r.floor?.label ?? '?'}`;
                  }}
                  sublabelFn={(item) => {
                    const r = item as unknown as RoomOption;
                    return `₹${r.monthlyRent}/mo · ${r.sharingType} sharing`;
                  }}
                  dataPath="data"
                />
              )}
            />
            <Select
              label="Bed"
              options={bedOptions}
              error={err.bedId?.message}
              disabled={!roomIdWatch}
              {...register('bedId')}
            />
          </FormGrid>
        </FormSection>

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
            <Input
              label="Move-in date"
              type="date"
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

        {tenantData && (
          <FormSection
            title="Documents"
            description="Aadhaar and photo are stored securely for this tenant"
            divided
          >
            <FormGrid>
              <DocumentUpload
                tenantId={id}
                docType="aadhaar"
                currentUrl={(tenantData.documents as Record<string, string>)?.aadhaarUrl}
                onUploaded={(url) =>
                  setTenantData((prev) =>
                    prev
                      ? {
                          ...prev,
                          documents: {
                            ...((prev.documents as Record<string, string>) ?? {}),
                            aadhaarUrl: url,
                          },
                        }
                      : prev,
                  )
                }
              />
              <DocumentUpload
                tenantId={id}
                docType="photo"
                currentUrl={(tenantData.documents as Record<string, string>)?.photoUrl}
                onUploaded={(url) =>
                  setTenantData((prev) =>
                    prev
                      ? {
                          ...prev,
                          documents: {
                            ...((prev.documents as Record<string, string>) ?? {}),
                            photoUrl: url,
                          },
                        }
                      : prev,
                  )
                }
              />
            </FormGrid>
          </FormSection>
        )}
      </FormCard>
    </FormPage>
  );
}
