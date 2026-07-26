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
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

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
  status: z.enum(['available', 'under_maintenance', 'down']).optional(),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'down', label: 'Down' },
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

export default function EditWashingMachinePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [machineData, setMachineData] = useState<MachineDetail | null>(null);

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
      .get(`washing-machines/${id}`)
      .json<{ success: boolean; data: MachineDetail }>()
      .then((res) => {
        setMachineData(res.data);
        reset({
          label: res.data.label || '',
          machineNumber: res.data.machineNumber,
          timerDuration: res.data.timerDuration,
          status: res.data.status as FormData['status'],
          notes: res.data.notes || '',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load washing machine');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`washing-machines/${id}`, { json: data }).json();
      router.push('/washing-machines');
    } catch {
      setSubmitError('Failed to update washing machine');
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const machine = machineData;
  const isInUse = machine?.status === 'in_use';

  return (
    <FormPage
      title="Edit Washing Machine"
      description={`${machine?.label || `Machine ${machine?.machineNumber}`} · ${machine?.floorLabel ?? `Floor ${machine?.floorNumber ?? ''}`}`}
      backHref="/washing-machines"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {machine?.currentUser && (
          <DetailCard title="Currently In Use" variant="default">
            <DetailList>
              <DetailRow label="Claimed By" value={machine.currentUser.name ?? 'Unknown'} />
              <DetailRow label="Room" value={machine.currentUser.room ?? '—'} />
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
                  label="Timer Ends"
                  value={new Date(machine.timerEndsAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              )}
            </DetailList>
          </DetailCard>
        )}

        {isInUse && (
          <div className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] px-4 py-3 text-sm font-medium text-[color:var(--color-warning-700)]">
            Machine is currently in use. Changing status to available/under_maintenance/down will release the current claim.
          </div>
        )}

        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              cancelHref="/washing-machines"
              submitLabel="Save Changes"
              divided={false}
            />
          }
        >
          <FormSection
            title="Machine details"
            description="Update machine configuration"
          >
            <FormGrid>
              <Input
                label="Label"
                placeholder="e.g. Front Loader"
                error={err.label?.message}
                {...register('label')}
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
                label="Timer Duration (minutes)"
                type="number"
                min={10}
                max={180}
                error={err.timerDuration?.message}
                {...register('timerDuration')}
              />
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                error={err.status?.message}
                {...register('status')}
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
        </FormCard>
      </div>
    </FormPage>
  );
}
