'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';

const schema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z.enum(['upi', 'cash', 'bank_transfer', 'other']),
  type: z.enum(['rent', 'electricity', 'deposit', 'laundry', 'other']),
  status: z.enum(['pending', 'pending_verification', 'paid', 'overdue', 'cancelled']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`payments/${id}`)
      .json<{ success: boolean; data: FormData }>()
      .then((res) => {
        reset(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load payment');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`payments/${id}`, { json: data }).json();
      router.push('/payments');
    } catch {
      setSubmitError('Failed to update payment');
    }
  };

  return (
    <FormPage
      title="Edit Payment"
      description="Update payment amount, method, and status"
      backHref="/payments"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/payments"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection
          title="Payment details"
          description="Amount, method, and payment category"
        >
          <FormGrid>
            <Input
              label="Amount"
              type="number"
              step="0.01"
              error={errors.amount?.message}
              {...register('amount')}
            />
            <Select
              label="Method"
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank_transfer', label: 'Bank transfer' },
                { value: 'upi', label: 'UPI' },
                { value: 'other', label: 'Other' },
              ]}
              error={errors.method?.message}
              {...register('method')}
            />
            <Select
              label="Type"
              options={[
                { value: 'rent', label: 'Rent' },
                { value: 'deposit', label: 'Deposit' },
                { value: 'electricity', label: 'Electricity' },
                { value: 'laundry', label: 'Laundry' },
                { value: 'other', label: 'Other' },
              ]}
              error={errors.type?.message}
              {...register('type')}
            />
          </FormGrid>
        </FormSection>

        <FormSection
          title="Status and notes"
          description="Verification state and optional remarks"
          divided
        >
          <FormGrid>
            <Select
              label="Status"
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'pending_verification', label: 'Pending verification' },
                { value: 'paid', label: 'Paid' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              error={errors.status?.message}
              {...register('status')}
            />
            <FormFullWidth>
              <Textarea
                label="Notes"
                rows={3}
                placeholder="Optional notes..."
                error={errors.notes?.message}
                {...register('notes')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
