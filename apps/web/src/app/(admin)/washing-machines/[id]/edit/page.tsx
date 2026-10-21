'use client';

import { useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info, User } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CrudFormPage } from '@/components/ui/CrudFormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { useApiQuery } from '@/hooks/useApiQuery';

const schema = z.object({
  label: z.string().max(80).optional(),
  machineNumber: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(1).optional(),
  ),
  timerDuration: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(10).max(180).optional(),
  ),
  status: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.enum(['available', 'under_maintenance', 'down']).optional(),
  ),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

/**
 * The states an edit may write.
 *
 * The running state is not here: the server refuses an edit that writes it,
 * because a claim is written by a resident and only by a resident.
 */
const STATUS_OPTIONS = [
  { value: 'available', label: 'Free to claim' },
  { value: 'under_maintenance', label: 'In maintenance' },
  { value: 'down', label: 'Down' },
];

/**
 * The states an edit may write while a claim runs on the machine.
 *
 * Every one of them releases the claim, so the office picks one on purpose.
 */
const STATUS_OPTIONS_IN_USE = [
  { value: '', label: 'Keep the claim (state untouched)' },
  { value: 'available', label: 'Free to claim (releases the claim)' },
  { value: 'under_maintenance', label: 'In maintenance (releases the claim)' },
  { value: 'down', label: 'Down (releases the claim)' },
];

interface MachineDetail {
  _id: string;
  machineNumber: number;
  label: string;
  status: string;
  floorLabel?: string;
  floorNumber?: number;
  timerDuration: number;
  notes?: string;
  currentUser?: { name?: string; room?: string } | null;
  claimedAt?: string;
  timerEndsAt?: string;
}

/**
 * Entity -> form values.
 *
 * Module-level so the shell's bridge effect stays stable. The running state is
 * left unset on purpose: it is claim state, not an editable status, so the
 * office has to pick a status consciously, and every status it can pick
 * releases the claim.
 */
function mapMachineToValues(machine: MachineDetail): FormData {
  return {
    label: machine.label || '',
    machineNumber: machine.machineNumber,
    timerDuration: machine.timerDuration,
    status: machine.status === 'in_use' ? undefined : (machine.status as FormData['status']),
    notes: machine.notes || '',
  };
}

export default function EditWashingMachinePage() {
  const params = useParams();
  const id = params.id as string;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const { register, control, formState } = form;
  const { errors } = formState;

  const err = errors as Record<string, { message?: string }>;

  /**
   * The same cache identity as the shell's load: one request shared between
   * the form reset and the panel below.
   */
  const machineQuery = useApiQuery<MachineDetail>(
    ['washing-machines', 'detail', id],
    `washing-machines/${id}`,
  );
  const machine = machineQuery.data;
  const isInUse = machine?.status === 'in_use';

  return (
    <CrudFormPage
      title="Edit washing machine"
      description={`${machine?.label || `Machine ${machine?.machineNumber ?? ''}`} - ${
        machine?.floorLabel ?? `Floor ${machine?.floorNumber ?? ''}`
      }`}
      backHref="/washing-machines"
      redirectTo="/washing-machines"
      mode="edit"
      maxWidth="form"
      form={form}
      load={{
        queryKey: ['washing-machines', 'detail', id],
        path: `washing-machines/${id}`,
        mapToValues: mapMachineToValues,
      }}
      submit={async ({ values }) => {
        const payload: Record<string, unknown> = { ...values };
        // Untouched status while in use must not be sent (the server refuses
        // the running state on an edit).
        if (payload.status === undefined) delete payload.status;
        await api.put(`washing-machines/${id}`, { json: payload }).json();
      }}
      preflight={
        <>
          {machine?.currentUser ? (
            <DetailCard title="Currently running" icon={<User />}>
              <DetailList>
                <DetailRow label="Claimed by" value={machine.currentUser.name ?? 'Unknown'} />
                <DetailRow label="Room" value={machine.currentUser.room ?? 'Not recorded'} />
                {machine.claimedAt && (
                  <DetailRow
                    label="Since"
                    value={new Date(machine.claimedAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                )}
                {machine.timerEndsAt && (
                  <DetailRow
                    label="Held until"
                    value={new Date(machine.timerEndsAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                )}
              </DetailList>
            </DetailCard>
          ) : null}

          {isInUse ? (
            <div className="rounded-(--radius-lg) border border-(--color-warning-200) bg-(--color-warning-50) px-4 py-3 text-sm font-medium text-(--color-warning-700)">
              A resident holds this machine until the timer on the claim runs out. Leave the state
              untouched to keep the claim, or pick a state below to release it.
            </div>
          ) : null}

          <DetailCard title="What this save commits" icon={<Info />}>
            <ul className="text-2xs space-y-2 leading-relaxed font-medium text-(--color-text-secondary)">
              <li>
                The server writes the fields you changed: the label, the number, the length of a
                claim, the notes and the state, and it writes an update entry in the audit log.
              </li>
              <li>
                A state other than untouched releases the claim on the machine. The resident who
                held it is not told: they see the machine free the next time they open the app.
              </li>
              <li>
                The machine number has to be free on that floor. The server refuses a duplicate with
                the message &quot;A machine with this number already exists on this floor&quot; and
                keeps the machine you already registered.
              </li>
              <li>
                The residents of the floor are not told about any of it. They read the machine list
                of their own floor right before they claim, and that list is the channel of this
                module.
              </li>
            </ul>
          </DetailCard>
        </>
      }
    >
      <FormSection title="Machine details" description="Update machine configuration">
        <FormGrid>
          <Input
            label="Label"
            placeholder="e.g. Front Loader"
            error={err.label?.message}
            hint="The name the office reads. Without it the machine is called by its number."
            {...register('label')}
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
        <FormGrid>
          <Input
            label="Timer Duration (minutes)"
            type="number"
            min={10}
            max={180}
            error={err.timerDuration?.message}
            helperText="The length of a claim when the resident does not pick one."
            {...register('timerDuration')}
          />
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                label="Status"
                options={isInUse ? STATUS_OPTIONS_IN_USE : STATUS_OPTIONS}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={err.status?.message}
                helperText={
                  isInUse
                    ? 'Leave as-is to keep the current claim. Every other state releases it.'
                    : undefined
                }
              />
            )}
          />
        </FormGrid>
        <Textarea
          label="Notes"
          rows={3}
          placeholder="Optional notes..."
          error={err.notes?.message}
          {...register('notes')}
        />
      </FormSection>
    </CrudFormPage>
  );
}
