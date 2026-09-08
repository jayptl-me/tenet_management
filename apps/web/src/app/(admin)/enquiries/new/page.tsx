'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, Tag, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  preferredSharing: z.enum(['2', '3', '4', 'single']),
  source: z.enum(['landing_page', 'referral', 'walk_in', 'phone_call', 'other']),
  message: z.string().optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

type FormData = z.infer<typeof schema>;

const SHARING_OPTIONS = [
  { value: '2', label: '2 Sharing' },
  { value: '3', label: '3 Sharing' },
  { value: '4', label: '4 Sharing' },
  { value: 'single', label: 'Single' },
];

const SOURCE_OPTIONS = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'referral', label: 'Referral' },
  { value: 'landing_page', label: 'Landing page' },
  { value: 'other', label: 'Other' },
];

export default function NewEnquiryPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      message: '',
      notes: '',
      preferredSharing: '2',
      source: 'walk_in',
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api
        .post('enquiries', {
          json: {
            name: data.name.trim(),
            phone: normalizeInPhone(data.phone),
            email: data.email || undefined,
            preferredSharing: data.preferredSharing,
            source: data.source,
            message: data.message || undefined,
            notes: data.notes || undefined,
          },
        })
        .json<{ success: boolean }>();
      router.push('/enquiries');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  return (
    <FormPage
      title="New Enquiry"
      description="Record a new tenant lead from walk-in, phone call, or referral"
      backHref="/enquiries"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/enquiries"
            submitLabel="Save Enquiry"
            divided={false}
          />
        }
      >
        <FormSection
          title="Contact"
          icon={<UserRound />}
          description="Prospect identity and reachability"
        >
          <FormGrid>
            <Input
              label="Name"
              placeholder="Full name"
              error={errors.name?.message}
              leftIcon={<UserRound className="h-4 w-4" />}
              {...register('name')}
            />
            <Input
              label="Phone"
              placeholder="+919876543210"
              inputMode="tel"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </FormGrid>
        </FormSection>
        <FormSection
          title="Requirement"
          icon={<Tag />}
          description="Sharing preference and lead source"
          divided
        >
          <FormGrid>
            <Select
              label="Preferred Sharing"
              options={SHARING_OPTIONS}
              error={errors.preferredSharing?.message}
              {...register('preferredSharing')}
            />
            <Select
              label="Source"
              options={SOURCE_OPTIONS}
              error={errors.source?.message}
              {...register('source')}
            />
          </FormGrid>
        </FormSection>
        <FormSection
          title="Notes"
          icon={<FileText />}
          description="Prospect message and internal follow-ups"
          divided
        >
          <div className="space-y-4">
            <Textarea
              label="Initial Message"
              rows={3}
              placeholder="Prospect requirements or initial message..."
              error={errors.message?.message}
              {...register('message')}
            />
            <Textarea
              label="Staff Notes"
              rows={3}
              placeholder="Internal staff follow-up notes, discussion remarks..."
              error={errors.notes?.message}
              {...register('notes')}
            />
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
