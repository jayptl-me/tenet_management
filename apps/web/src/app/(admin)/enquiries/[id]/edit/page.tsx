'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Mail, UserRound, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  message: z.string().optional(),
  source: z.enum(['landing_page', 'referral', 'walk_in', 'phone_call', 'other']),
  status: z.enum(['new', 'contacted', 'converted', 'lost']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const sourceOptions = [
  { value: 'landing_page', label: 'Landing page' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'other', label: 'Other' },
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
      .json<{ success: boolean; data: FormData & { _id: string; notes?: string } }>()
      .then((res) => {
        const d = res.data;
        reset({
          name: d.name ?? '',
          phone: d.phone ?? '',
          email: d.email ?? '',
          message: d.message ?? '',
          source: (d.source as FormData['source']) ?? 'other',
          status: (d.status as FormData['status']) ?? 'new',
          notes: d.notes ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load enquiry');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`enquiries/${id}`, { json: data }).json();
      router.push('/enquiries');
    } catch {
      setSubmitError('Failed to update enquiry');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  const nextStatusHint = (() => {
    switch (currentStatus) {
      case 'new':
        return 'Mark as contacted once you have reached out';
      case 'contacted':
        return 'Move to converted if the enquiry becomes a tenant';
      case 'converted':
        return 'Enquiry has been successfully converted';
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
          </FormGrid>
        </FormSection>

        <FormSection title="Follow-up" description="Message and pipeline status" divided>
          <FormGrid>
            <div className="space-y-3">
              <Select
                label="Pipeline status"
                options={statusOptions}
                error={err.status?.message}
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
