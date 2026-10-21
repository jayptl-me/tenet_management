'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info, Settings2, WashingMachine } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { CrudFormPage } from '@/components/ui/CrudFormPage';
import { DetailCard } from '@/components/ui/DetailCard';
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

/**
 * The states a machine can be registered in.
 *
 * The running state is not here: the server refuses a create or an edit that
 * writes it, because a claim is written by a resident and only by a resident.
 */
const STATUS_OPTIONS = [
  { value: 'available', label: 'Free to claim' },
  { value: 'under_maintenance', label: 'In maintenance' },
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
      title="New washing machine"
      description="Register a machine on a floor: the residents of that floor claim it from their own machine list"
      backHref="/washing-machines"
      redirectTo="/washing-machines"
      submitLabel="Save Machine"
      mode="create"
      maxWidth="form"
      form={form}
      submit={async ({ values }) => {
        await api.post('washing-machines', { json: values }).json<{ success: boolean }>();
      }}
      preflight={
        <DetailCard title="What this save commits" icon={<Info />}>
          <ul className="text-2xs space-y-2 leading-relaxed font-medium text-(--color-text-secondary)">
            <li>
              The server writes the machine on the floor, with the number, the label, the length of
              a claim and the state you pick, and it writes a create entry in the audit log.
            </li>
            <li>
              The machine number has to be free on that floor. The server refuses a duplicate with
              the message &quot;A machine with this number already exists on this floor&quot; and
              keeps the machine you already registered.
            </li>
            <li>
              The residents of the floor are not told. They read the machine list of their own floor
              right before they claim, and that list is the channel of this module: a claim on a
              machine that is not free to claim is refused.
            </li>
            <li>
              A resident claims the machine for the window the timer holds, between 10 and 180
              minutes. The server releases the machine on its own when the window runs out.
            </li>
          </ul>
        </DetailCard>
      }
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
            hint="The number the residents of the floor read on the machine. It has to be free on this floor."
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
            hint="The name the office reads. Without it the machine is called by its number."
            {...register('label')}
          />
          <Input
            label="Timer Duration (minutes)"
            type="number"
            min={10}
            max={180}
            error={err.timerDuration?.message}
            helperText="The length of a claim when the resident does not pick one. The server releases it on its own when the window runs out."
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
                helperText="The state the machine starts in. A machine that is free to claim can be claimed by a resident of the floor right away."
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
