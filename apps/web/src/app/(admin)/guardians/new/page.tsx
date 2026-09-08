'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, Phone, Mail, Shield, DoorOpen, Building2, BedDouble } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { TempCredentialsDialog } from '@/components/ui/TempCredentialsDialog';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  name: z.string().min(1, 'Name is required').max(100),
  phone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  email: z.string().email('Email is required for guardian login'),
  relation: z.enum(['father', 'mother', 'guardian', 'other']),
});

type FormData = z.infer<typeof schema>;

const RELATION_OPTIONS = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

interface TenantPreview {
  name: string;
  roomNumber?: string;
  bedId?: string;
  floorLabel?: string;
}

function NewGuardianForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillTenantId = searchParams.get('tenantId') ?? '';
  const [submitError, setSubmitError] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [hostPreview, setHostPreview] = useState<TenantPreview | null>(null);
  const [hostLoading, setHostLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: prefillTenantId,
    },
  });

  const tenantIdWatch = useWatch({ control, name: 'tenantId' });

  const onTenantChange = async (tenantId: string) => {
    setValue('tenantId', tenantId);
    setHostPreview(null);
    if (!tenantId) return;
    setHostLoading(true);
    try {
      const res = await api.get(`tenants/${tenantId}`).json<{
        success: boolean;
        data: {
          user?: { name?: string };
          room?: { roomNumber?: string; floor?: { label?: string } };
          bedId?: string;
        };
      }>();
      const d = res.data;
      setHostPreview({
        name: d.user?.name ?? 'Unknown',
        roomNumber: d.room?.roomNumber,
        bedId: d.bedId,
        floorLabel: d.room?.floor?.label,
      });
    } catch {
      setHostPreview(null);
    } finally {
      setHostLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    setTempPassword(null);
    const payload = {
      tenantId: data.tenantId,
      name: data.name.trim(),
      phone: normalizeInPhone(data.phone),
      email: data.email.trim().toLowerCase(),
      relation: data.relation,
    };
    try {
      const res = await api.post('guardians', { json: payload }).json<{
        success: boolean;
        data: { temporaryPassword?: string; _id?: string };
      }>();
      if (res.data.temporaryPassword) {
        setTempPassword(res.data.temporaryPassword);
      } else {
        router.push('/guardians');
      }
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="New Guardian"
      description="Add a guardian for a tenant (creates login credentials)"
      backHref="/guardians"
      error={submitError}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/guardians"
            submitLabel="Save Guardian"
            divided={false}
          />
        }
      >
        <FormSection
          title="Linked resident"
          icon={<UserRound />}
          description="Only active residents can have guardians"
        >
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Tenant"
                endpoint="tenants?isActive=true"
                value={field.value}
                onChange={(val) => {
                  field.onChange(val);
                  void onTenantChange(val);
                }}
                placeholder="Select tenant..."
                error={err.tenantId?.message}
                valueKey="_id"
                labelKey={tenantLabel}
                sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
                dataPath="data"
              />
            )}
          />
          {tenantIdWatch ? (
            <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
              {hostLoading ? (
                <p className="text-xs font-semibold text-[color:var(--color-brand-700)]">
                  Loading resident stay…
                </p>
              ) : hostPreview ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-[color:var(--color-brand-800)]">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-3.5 w-3.5" />
                    {hostPreview.name}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DoorOpen className="h-3.5 w-3.5" />
                    Room {hostPreview.roomNumber ?? 'N/A'}
                    {hostPreview.bedId ? ` · Bed ${hostPreview.bedId}` : ''}
                  </span>
                  {hostPreview.floorLabel && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {hostPreview.floorLabel}
                    </span>
                  )}
                  {hostPreview.bedId && (
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" />
                      Bed {hostPreview.bedId}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs font-semibold text-[color:var(--color-text-muted)]">
                  Select a tenant to preview their room and bed placement.
                </p>
              )}
            </div>
          ) : null}
        </FormSection>

        <FormSection
          title="Guardian details"
          icon={<Shield />}
          description="Contact used for portal login and ward updates"
          divided
        >
          <FormGrid>
            <Input
              label="Full name"
              placeholder="Guardian name"
              error={err.name?.message}
              leftIcon={<UserRound className="h-4 w-4" />}
              autoComplete="name"
              {...register('name')}
            />
            <Input
              label="Phone"
              placeholder="+919876543210"
              inputMode="tel"
              error={err.phone?.message}
              leftIcon={<Phone className="h-4 w-4" />}
              autoComplete="tel"
              {...register('phone')}
            />
            <Input
              label="Email (required for login)"
              type="email"
              placeholder="guardian@example.com"
              error={err.email?.message}
              leftIcon={<Mail className="h-4 w-4" />}
              autoComplete="email"
              {...register('email')}
            />
            <Select
              label="Relation"
              options={RELATION_OPTIONS}
              error={err.relation?.message}
              {...register('relation')}
            />
          </FormGrid>
        </FormSection>
      </FormCard>
      <TempCredentialsDialog
        open={!!tempPassword}
        temporaryPassword={tempPassword}
        onClose={() => {
          setTempPassword(null);
          router.push('/guardians');
        }}
        entityLabel="Guardian"
      />
    </FormPage>
  );
}

export default function NewGuardianPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
        </div>
      }
    >
      <NewGuardianForm />
    </Suspense>
  );
}
