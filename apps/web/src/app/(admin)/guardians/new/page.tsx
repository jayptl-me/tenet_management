'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserRound,
  Phone,
  Mail,
  Shield,
  DoorOpen,
  Building2,
  CheckCircle2,
  TriangleAlert,
} from 'lucide-react';
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
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAppConfigPublic } from '@/hooks/useAppConfig';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';

// ── The contract of this form ─────────────────────────────────────────
// Every rule below is the server's own (apps/api/src/routes/guardians.ts:36-58):
//   POST /guardians  apps/api/src/routes/guardians.ts:112-238
//   GET /tenants/:id apps/api/src/routes/tenants.ts:486-500

const schema = z.object({
  tenantId: z.string().min(1, 'Resident is required'),
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

/** The resident the contact pays for, as the server returns it. */
interface WardPreview {
  user?: { name?: string; email?: string; phone?: string } | null;
  room?: { roomNumber?: string; floor?: { label?: string } | null } | null;
  bedId?: string | null;
  monthlyRent?: number;
  isActive?: boolean;
}

function NewGuardianForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillTenantId = searchParams.get('tenantId') ?? '';
  const [submitError, setSubmitError] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  /**
   * Whether the guardian portal is switched on.
   *
   * The portal of a guardian lives behind this switch (apps/api/src/routes/guardians.ts:109), so
   * a contact added while it is off has a login that cannot open the ward.
   */
  const { data: appConfig } = useAppConfigPublic();
  const portalEnabled = appConfig?.features?.guardianPortalEnabled ?? null;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: prefillTenantId,
    },
  });

  const tenantIdWatch = useWatch({ control, name: 'tenantId' });

  /**
   * The resident in view, read through the shared query stack.
   *
   * The preview is the resident the server holds: the room, the bed and the floor the person
   * is standing behind.
   */
  const { data: ward } = useApiQuery<WardPreview>(
    ['tenants', 'detail', tenantIdWatch],
    `tenants/${tenantIdWatch}`,
    { enabled: Boolean(tenantIdWatch) },
  );

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
      description="Add the person who stands behind a resident. The server creates a portal login for that person and links it to the resident you pick."
      backHref="/guardians"
      error={submitError}
      maxWidth="form"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            <FormCard
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
                title="The resident they pay for"
                icon={<UserRound />}
                description="Only active residents can have a guardian. The server refuses a resident it does not hold."
              >
                <Controller
                  name="tenantId"
                  control={control}
                  render={({ field }) => (
                    <ResourceSelect
                      label="Resident"
                      endpoint="tenants?isActive=true"
                      value={field.value}
                      onChange={(val) => field.onChange(val)}
                      placeholder="Select resident..."
                      error={err.tenantId?.message}
                      valueKey="_id"
                      labelKey={tenantLabel}
                      sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
                      dataPath="data"
                    />
                  )}
                />
                {tenantIdWatch ? (
                  <div className="mt-3 rounded-(--radius-md) border border-(--color-brand-200) bg-(--color-brand-50) p-3">
                    {ward ? (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-(--color-brand-800)">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {ward.user?.name ?? 'Unknown'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <DoorOpen className="h-3.5 w-3.5" />
                          Room {ward.room?.roomNumber ?? 'N/A'}
                          {ward.bedId ? ` · Bed ${ward.bedId}` : ''}
                        </span>
                        {ward.room?.floor?.label && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {ward.room.floor.label}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs font-semibold text-(--color-text-muted)">
                        Reading the resident from the server...
                      </p>
                    )}
                  </div>
                ) : null}
              </FormSection>

              <FormSection
                title="The contact"
                icon={<Shield />}
                description="The person the office calls. The email and the phone belong to the portal login of that person."
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
          </div>

          {/* What this save commits. The office has to know what the server will
              write before it writes it, and what it will not do. */}
          <div className="space-y-4 lg:col-span-5 xl:col-span-4">
            <div className="rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
              <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
                What this save does
              </h3>
              <ul className="mt-3 space-y-2.5">
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The server creates a portal login for this person, with a temporary password.
                    The password is shown once, on this screen, and the server sends no message: the
                    office hands it over.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The contact is linked to the resident you pick, and the link cannot be moved
                    later: a different resident means a new contact, and the old one is switched
                    off.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    Nothing of the resident is written. The resident keeps their own login, their
                    own bills and their own dues view: their portal access does not change in any
                    way when a guardian is set.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    Nobody is told. The resident does not learn that a guardian was set, and the
                    contact does not learn that they were added. The server sends no notification
                    for this write.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The server refuses a phone or an email another account already uses
                    (DUPLICATE_USER), and it refuses a resident it does not hold (TENANT_NOT_FOUND).
                  </span>
                </li>
              </ul>

              {portalEnabled === false && (
                <div className="mt-4 flex items-start gap-2 rounded-(--radius-lg) border border-(--color-warning-300) bg-(--color-warning-50) p-3">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-(--color-warning-600)" />
                  <p className="text-2xs font-semibold text-(--color-warning-800)">
                    The guardian portal is switched off in the settings. The login will be created,
                    but this person cannot open the resident until the office switches the portal
                    on.
                  </p>
                </div>
              )}

              <div className="mt-4 border-t border-(--border-color) pt-3">
                <p className="tracking-label text-2xs font-bold text-(--color-text-muted) uppercase">
                  Still open before this contact can reach the resident
                </p>
                <ul className="text-2xs mt-2 space-y-1.5 font-medium text-(--color-text-secondary)">
                  <li>The temporary password was handed over and the person signed in.</li>
                  <li>The resident was told by the office, because the server tells nobody.</li>
                  <li>The guardian portal is switched on in the settings.</li>
                </ul>
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
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <NewGuardianForm />
    </Suspense>
  );
}
