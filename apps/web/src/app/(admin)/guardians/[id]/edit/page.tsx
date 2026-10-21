'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, Phone, Mail, Shield, CheckCircle2, Home, BedDouble } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { useApiQuery } from '@/hooks/useApiQuery';
import { errorMessage } from '@/lib/query';

// ── The contract of this form ─────────────────────────────────────────
// Every rule below is the server's own (apps/api/src/routes/guardians.ts:48-58):
//   GET /guardians/:id  apps/api/src/routes/guardians.ts:442-467
//   PUT /guardians/:id   apps/api/src/routes/guardians.ts:470-526

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  relation: z.enum(['father', 'mother', 'guardian', 'other']),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const relationOptions = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

/** The record as the server returns it. */
interface GuardianRecord {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
  tenantId?: string;
  tenant?: {
    _id: string;
    bedId?: string | null;
    isActive?: boolean | null;
    user?: { name?: string } | null;
    room?: { roomNumber?: string; floor?: { label?: string } | null } | null;
  } | null;
  isEmergencyContact: boolean;
  isActive: boolean;
}

const GUARDIAN_KEY = ['guardians', 'detail'] as const;

export default function EditGuardianPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState('');

  /**
   * The record, read through the shared query stack.
   *
   * The form is filled from it once, and the write invalidates it, so the page never shows the
   * values it fetched before the save.
   */
  const { data: guardian, error: queryError } = useApiQuery<GuardianRecord>(
    [...GUARDIAN_KEY, id],
    `guardians/${id}`,
    { enabled: Boolean(id) },
  );

  const isLoading = !guardian && !queryError;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  /**
   * The form is filled from the record when it arrives. React's documented way to adjust a
   * form when something outside it changes.
   */
  useEffect(() => {
    if (!guardian) return;
    reset({
      name: guardian.name ?? '',
      phone: guardian.phone ?? '',
      email: guardian.email ?? '',
      relation: (guardian.relation as FormData['relation']) ?? 'other',
      isActive: guardian.isActive ?? true,
    });
  }, [guardian, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    // Only the fields the server accepts: the update schema is a strict object and
    // refuses anything it does not know (apps/api/src/routes/guardians.ts:48-58).
    const payload = {
      name: data.name.trim(),
      phone: normalizeInPhone(data.phone),
      email: data.email || undefined,
      relation: data.relation,
      isActive: data.isActive,
    };
    try {
      await api.put(`guardians/${id}`, { json: payload }).json();
      await queryClient.invalidateQueries({ queryKey: GUARDIAN_KEY });
      router.push(`/guardians/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const ward = guardian?.tenant ?? null;

  return (
    <FormPage
      title="Edit Guardian"
      description="Change the contact, the relation or the reach of this contact. The resident it stands behind does not change."
      backHref={`/guardians/${id}`}
      error={submitError || errorMessage(queryError)}
      isLoading={isLoading}
      maxWidth="form"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            <FormCard
              footer={
                <FormActions
                  loading={isSubmitting}
                  cancelHref={`/guardians/${id}`}
                  submitLabel="Save Changes"
                  divided={false}
                />
              }
            >
              <FormSection
                title="The resident this contact pays for"
                icon={<UserRound />}
                description="Fixed: a contact belongs to one resident. To stand behind a different resident, add a new contact and switch this one off."
              >
                {ward ? (
                  <div className="rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) p-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-(--color-text-primary)">
                      {ward._id ? (
                        <Link
                          href={`/tenants/${ward._id}`}
                          className="text-(--color-brand-600) hover:underline"
                        >
                          {ward.user?.name ?? 'Open the resident'}
                        </Link>
                      ) : (
                        <span>{ward.user?.name ?? 'Unknown resident'}</span>
                      )}
                      {ward.room && (
                        <span className="inline-flex items-center gap-1 text-(--color-text-secondary)">
                          <Home className="h-3.5 w-3.5 text-(--color-text-muted)" />
                          Room {ward.room.roomNumber}
                        </span>
                      )}
                      {ward.bedId && (
                        <span className="inline-flex items-center gap-1 text-(--color-text-secondary)">
                          <BedDouble className="h-3.5 w-3.5 text-(--color-text-muted)" />
                          Bed {ward.bedId}
                        </span>
                      )}
                      {ward.room?.floor?.label && (
                        <span className="text-(--color-text-secondary)">
                          {ward.room.floor.label}
                        </span>
                      )}
                    </div>
                    <p className="text-2xs mt-1.5 font-medium text-(--color-text-muted)">
                      {ward.isActive === false
                        ? 'The stay of this resident is over.'
                        : 'The resident lives here.'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-(--color-text-muted)">
                    The server holds no resident on this record.
                  </p>
                )}
              </FormSection>

              <FormSection
                title="The contact"
                icon={<Shield />}
                description="The name, the phone and the email are written on the record and on the portal login of this person."
                divided
              >
                <FormGrid>
                  <Input
                    label="Name"
                    error={errors.name?.message}
                    leftIcon={<UserRound className="h-4 w-4" />}
                    {...register('name')}
                  />
                  <Input
                    label="Phone"
                    placeholder="+919876543210"
                    inputMode="tel"
                    error={errors.phone?.message}
                    leftIcon={<Phone className="h-4 w-4" />}
                    {...register('phone')}
                  />
                  <Input
                    label="Email"
                    type="email"
                    error={errors.email?.message}
                    leftIcon={<Mail className="h-4 w-4" />}
                    {...register('email')}
                  />
                  <Controller
                    name="relation"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Relation"
                        options={relationOptions}
                        error={errors.relation?.message}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    )}
                  />
                </FormGrid>
              </FormSection>

              <FormSection
                title="Flags"
                icon={<Shield />}
                description="The reach of the contact. The emergency contact is derived from the relation, not stored."
                divided
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                  <Checkbox
                    label="Reachable"
                    error={errors.isActive?.message}
                    {...register('isActive')}
                  />
                  <p className="text-2xs font-medium text-(--color-text-secondary)">
                    {guardian?.isEmergencyContact
                      ? 'Emergency contact: yes (father or mother). Change the relation above to change it.'
                      : 'Emergency contact: no. Change the relation above to change it.'}
                  </p>
                </div>
              </FormSection>
            </FormCard>
          </div>

          {/* What this save does. The office has to know what the server will
              commit before it commits it, and what it will not do. */}
          <div className="space-y-4 lg:col-span-5 xl:col-span-4">
            <div className="rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
              <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
                What this save does
              </h3>
              <ul className="mt-3 space-y-2.5">
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The server writes the name, the phone, the email, the relation and the reachable
                    flag on the record, and writes the same name, phone, email and flag onto the
                    portal login of this person. The number the office reads and the number the
                    person signs in with stay the same.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    Switching the contact off also switches off the portal login of this person.
                    Switching it back on gives the login back. The record and the resident are kept
                    either way.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The server writes an audit entry with the fields it changed. It sends no
                    notification: this person and the resident are not told that the contact
                    changed.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    Nothing of the resident is written. Their bills, their dues and their own portal
                    access do not change when the contact of a guardian changes.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
