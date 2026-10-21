'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { WashingMachine, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { CrudFormPage } from '@/components/ui/CrudFormPage';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
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
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'available', timerDuration: 50 },
  });
  const { register, control, formState } = form;
  const { errors } = formState;

  const err = errors as Record<string, { message?: string }>;

  return (
    <CrudFormPage
      title="New Washing Machine"
      description="Add a washing machine to a floor"
      backHref="/washing-machines"
      redirectTo="/washing-machines"
      submitLabel="Save Machine"
      mode="create"
      form={form}
      submit={async ({ values }) => {
        await api.post('washing-machines', { json: values }).json<{ success: boolean }>();
      }}
    >
      <FormSection
        title="Placement"
        icon={<WashingMachine />}
        description="Floor and machine number (unique per floor)"
      >
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
      </FormSection>
      <FormSection
        title="Configuration"
        icon={<Settings2 />}
        description="Label, cycle timer, initial status, and notes"
        divided
      >
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
        <div className="mt-4 space-y-4">
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={err.status?.message}
              />
            )}
          />
          <Textarea
            label="Notes (optional)"
            rows={3}
            placeholder="Any additional notes..."
            {...register('notes')}
          />
        </div>
      </FormSection>
    </CrudFormPage>
  );
}
