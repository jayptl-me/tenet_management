'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';
import { floorLabel } from '@/lib/resource-select-presets';

const schema = z.object({
  floorId: z.string().min(1, 'Floor is required'),
  machineNumber: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 1 : v),
    z.coerce.number().int().min(1, 'Machine number must be at least 1'),
  ),
  label: z.string().max(80).optional(),
  timerDuration: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 50 : v),
    z.coerce.number().int().min(10, 'Minimum 10 minutes').max(180, 'Maximum 180 minutes'),
  ),
  status: z.enum(['available', 'under_maintenance', 'down']),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'down', label: 'Down' },
];

export default function NewWashingMachinePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'available', timerDuration: 50 },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('washing-machines', { json: data }).json<{ success: boolean }>();
      router.push('/washing-machines');
    } catch {
      setSubmitError('Failed to create washing machine. A machine with this number may already exist on this floor.');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="New Washing Machine"
      description="Add a washing machine to a floor"
      backHref="/washing-machines"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/washing-machines"
            submitLabel="Save Machine"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <FormGrid>
            <Controller
              name="floorId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Floor"
                  endpoint="floors"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select floor..."
                  error={err.floorId?.message}
                  labelKey={floorLabel}
                />
              )}
            />
            <Input
              label="Machine Number"
              type="number"
              min={1}
              error={err.machineNumber?.message}
              {...register('machineNumber')}
            />
          </FormGrid>
          <FormGrid>
            <Input
              label="Label (optional)"
              placeholder="e.g. Washing Machine 1, Front Loader"
              error={err.label?.message}
              {...register('label')}
            />
            <Input
              label="Timer Duration (minutes)"
              type="number"
              min={10}
              max={180}
              error={err.timerDuration?.message}
              {...register('timerDuration')}
            />
          </FormGrid>
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            error={err.status?.message}
            {...register('status')}
          />
          <Textarea
            label="Notes (optional)"
            rows={3}
            placeholder="Any additional notes..."
            {...register('notes')}
          />
        </div>
      </FormCard>
    </FormPage>
  );
}
