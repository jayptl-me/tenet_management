'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Mail, UserRound, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  preferredSharing: z.enum(['2', '3', '4', 'single']),
  message: z.string().max(1000).optional(),
  source: z.enum(['landing_page', 'referral', 'walk_in', 'phone_call', 'other']),
  status: z.enum(['new', 'contacted', 'converted', 'lost']),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof schema>;

const sourceOptions = [
  { value: 'landing_page', label: 'Landing page' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'other', label: 'Other' },
];

const sharingOptions = [
  { value: '2', label: '2 Sharing' },
  { value: '3', label: '3 Sharing' },
  { value: '4', label: '4 Sharing' },
  { value: 'single', label: 'Single' },
];

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

export default function EditEnquiryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [originalStatus, setOriginalStatus] = useState('');
  const [hasTenant, setHasTenant] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const currentStatus = useWatch({ control, name: 'status' });

  useEffect(() => {
    if (!id) return;
    api
      .get(`enquiries/${id}`)
      .json<{
        success: boolean;
        data: FormData & {
          _id: string;
          notes?: string;
          preferredSharing?: string;
          convertedTenantId?: string | { _id?: string } | null;
        };
      }>()
      .then((res) => {
        const d = res.data;
        setOriginalStatus(d.status ?? 'new');
        setHasTenant(Boolean(d.convertedTenantId));
        reset({
          name: d.name ?? '',
          phone: d.phone ?? '',
          email: d.email ?? '',
          preferredSharing: (d.preferredSharing as FormData['preferredSharing']) ?? '2',
          message: d.message ?? '',
          source: (d.source as FormData['source']) ?? 'other',
          status: (d.status as FormData['status']) ?? 'new',
          notes: d.notes ?? '',
        });
        setIsLoading(false);
      })
      .catch(async (err) => {
        setSubmitError((await parseApiError(err)).message);
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    // converted is pinned to the tenant-creation flow server-side (409 otherwise).
    if (data.status === 'converted' && !hasTenant) {
      setSubmitError(
        'Mark converted only via Convert to Tenant on the enquiry detail page, which creates and links the tenant.',
      );
      return;
    }
    try {
      await api
        .put(`enquiries/${id}`, {
          json: {
            name: data.name.trim(),
            phone: normalizeInPhone(data.phone),
            email: data.email || undefined,
            preferredSharing: data.preferredSharing,
            message: data.message,
            source: data.source,
            status: data.status,
            notes: data.notes,
          },
        })
        .json();
      router.push('/enquiries');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const isConverted = originalStatus === 'converted';
  // converted is API-pinned to its tenant: hide it as a manual target.
  const visibleStatusOptions = hasTenant
    ? statusOptions
    : statusOptions.filter((o) => o.value !== 'converted');

  const nextStatusHint = (() => {
    if (isConverted) return 'Converted enquiries are pinned to their tenant';
    switch (currentStatus) {
      case 'new':
        return 'Mark as contacted once you have reached out';
      case 'contacted':
        return 'Use Convert to Tenant on the detail page to convert';
      case 'converted':
        return 'Converted requires a linked tenant (use the detail page flow)';
      case 'lost':
        return 'Enquiry marked as lost — no further action needed';
      default:
        return '';
    }
  })();

  return (
    <FormPage
      title="Edit Enquiry"
      description="Update lead contact, source, and pipeline status"
      backHref="/enquiries"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/enquiries"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Contact information" description="Prospect details from the enquiry">
          <FormGrid>
            <Input
              label="Full name"
              placeholder="Enquiry name"
              error={err.name?.message}
              leftIcon={<UserRound className="h-4 w-4" />}
              autoComplete="name"
              {...register('name')}
            />
            <Input
              label="Phone number"
              placeholder="+919876543210"
              inputMode="tel"
              error={err.phone?.message}
              leftIcon={<Phone className="h-4 w-4" />}
              autoComplete="tel"
              {...register('phone')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              error={err.email?.message}
              leftIcon={<Mail className="h-4 w-4" />}
              autoComplete="email"
              {...register('email')}
            />
            <Select
              label="Source"
              options={sourceOptions}
              error={err.source?.message}
              {...register('source')}
            />
            <Select
              label="Preferred sharing"
              options={sharingOptions}
              error={err.preferredSharing?.message}
              {...register('preferredSharing')}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Follow-up" description="Message and pipeline status" divided>
          <FormGrid>
            <div className="space-y-3">
              <Select
                label="Pipeline status"
                options={visibleStatusOptions}
                error={err.status?.message}
                disabled={isConverted}
                helperText={
                  isConverted ? 'Pinned to the converted tenant; status cannot change' : undefined
                }
                {...register('status')}
              />
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-info-200)] bg-[color:var(--color-info-50)] px-3 py-2">
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-info-500)]" />
                <p className="text-xs font-medium text-[color:var(--color-info-700)]">
                  {nextStatusHint}
                </p>
              </div>
            </div>
            <FormFullWidth>
              <Textarea
                label="Message"
                rows={3}
                placeholder="Initial enquiry message..."
                error={err.message?.message}
                {...register('message')}
              />
            </FormFullWidth>
            <FormFullWidth>
              <Textarea
                label="Staff notes"
                rows={2}
                placeholder="Internal notes about follow-ups..."
                error={err.notes?.message}
                {...register('notes')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
