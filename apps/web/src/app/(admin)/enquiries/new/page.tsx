'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';

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
          },
        })
        .json<{ success: boolean }>();
      router.push('/enquiries');
    } catch {
      setSubmitError('Failed to create enquiry. Check phone format (+91...) and try again.');
    }
  };

  return (
    <FormPage
      title="New Enquiry"
      description="Record a new tenant enquiry"
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
        <div className="space-y-5">
          <FormGrid>
            <Input
              label="Name"
              placeholder="Full name"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Phone"
              placeholder="+919876543210"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </FormGrid>
          <FormGrid>
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Select
              label="Preferred Sharing"
              options={SHARING_OPTIONS}
              error={errors.preferredSharing?.message}
              {...register('preferredSharing')}
            />
          </FormGrid>
          <Select
            label="Source"
            options={SOURCE_OPTIONS}
            error={errors.source?.message}
            {...register('source')}
          />
          <Textarea
            label="Message"
            rows={4}
            placeholder="Any additional details..."
            error={errors.message?.message}
            {...register('message')}
          />
        </div>
      </FormCard>
    </FormPage>
  );
}
