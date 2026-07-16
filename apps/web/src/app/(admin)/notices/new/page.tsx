'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';
import {
  floorLabel,
  roomLabel,
  roomSublabel,
  tenantLabel,
  tenantSublabel,
} from '@/lib/resource-select-presets';

function parseTargetIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const schema = z
  .object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(200),
    content: z.string().min(10, 'Content must be at least 10 characters').max(5000),
    pinned: z.boolean().optional(),
    targetType: z.enum(['all', 'floor', 'room', 'individual']),
    targetIds: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.targetType !== 'all' && parseTargetIds(data.targetIds).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetIds'],
        message:
          data.targetType === 'floor'
            ? 'Select at least one floor'
            : data.targetType === 'room'
              ? 'Select at least one room'
              : 'Select at least one tenant',
      });
    }
  });

type FormData = z.infer<typeof schema>;

const TARGET_OPTIONS = [
  { value: 'all', label: 'All Tenants' },
  { value: 'floor', label: 'By Floor' },
  { value: 'room', label: 'By Room' },
  { value: 'individual', label: 'Specific Tenant' },
];

export default function NewNoticePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [pickerValue, setPickerValue] = useState('');

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { content: '', pinned: false, targetIds: '', targetType: 'all' },
  });

  const targetType = useWatch({ control, name: 'targetType' }) ?? 'all';
  const targetIdsRaw = useWatch({ control, name: 'targetIds' }) ?? '';
  const selectedIds = parseTargetIds(targetIdsRaw);

  const addTargetId = (id: string) => {
    if (!id) return;
    const next = selectedIds.includes(id) ? selectedIds : [...selectedIds, id];
    setValue('targetIds', next.join(', '), { shouldValidate: true });
    setPickerValue('');
  };

  const removeTargetId = (id: string) => {
    setValue('targetIds', selectedIds.filter((t) => t !== id).join(', '), {
      shouldValidate: true,
    });
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = {
      title: data.title.trim(),
      content: data.content.trim(),
      pinned: data.pinned ?? false,
      targetType: data.targetType ?? 'all',
      targetIds: parseTargetIds(data.targetIds),
    };
    try {
      await api.post('notices', { json: payload }).json<{ success: boolean }>();
      router.push('/notices');
    } catch {
      setSubmitError('Failed to post notice. Please try again.');
    }
  };

  return (
    <FormPage
      title="Post Notice"
      description="Create a new announcement for tenants"
      backHref="/notices"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/notices"
            submitLabel="Post Notice"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <Input
            label="Title"
            placeholder="Notice title"
            error={errors.title?.message}
            {...register('title')}
          />
          <Textarea
            label="Content"
            rows={6}
            placeholder="Write the full notice content..."
            error={errors.content?.message}
            {...register('content')}
          />
          <FormGrid>
            <Select
              label="Target"
              options={TARGET_OPTIONS}
              error={errors.targetType?.message}
              {...register('targetType', {
                onChange: () => {
                  setValue('targetIds', '', { shouldValidate: true });
                  setPickerValue('');
                },
              })}
            />
            {targetType !== 'all' ? (
              <div className="space-y-2">
                <Controller
                  name="targetIds"
                  control={control}
                  render={() => (
                    <>
                      {targetType === 'floor' && (
                        <ResourceSelect
                          label="Add floor"
                          endpoint="floors"
                          value={pickerValue}
                          onChange={addTargetId}
                          placeholder="Select a floor..."
                          labelKey={floorLabel}
                          error={errors.targetIds?.message}
                          helperText="Required when target is By floor."
                        />
                      )}
                      {targetType === 'room' && (
                        <ResourceSelect
                          label="Add room"
                          endpoint="rooms?isActive=true"
                          value={pickerValue}
                          onChange={addTargetId}
                          placeholder="Select a room..."
                          labelKey={roomLabel}
                          sublabelFn={roomSublabel}
                          error={errors.targetIds?.message}
                          helperText="Required when target is By room."
                        />
                      )}
                      {targetType === 'individual' && (
                        <ResourceSelect
                          label="Add tenant"
                          endpoint="tenants?isActive=true"
                          value={pickerValue}
                          onChange={addTargetId}
                          placeholder="Select a tenant..."
                          valueKey="userId"
                          labelKey={(item) =>
                            tenantLabel(item as Parameters<typeof tenantLabel>[0])
                          }
                          sublabelFn={(item) =>
                            tenantSublabel(item as Parameters<typeof tenantSublabel>[0])
                          }
                          error={errors.targetIds?.message}
                          helperText="Required when target is Specific tenant (uses user IDs)."
                        />
                      )}
                    </>
                  )}
                />
                {selectedIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removeTargetId(id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-danger-300)] hover:text-[color:var(--color-danger-600)]"
                        title="Remove"
                      >
                        <span className="max-w-[12rem] truncate font-[family:var(--font-mono)]">
                          {id}
                        </span>
                        <span aria-hidden="true">x</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="self-end pb-2 text-xs text-[color:var(--color-text-muted)]">
                Visible to all tenants. No target IDs needed.
              </p>
            )}
          </FormGrid>
          <Checkbox label="Pin this notice" {...register('pinned')} />
        </div>
      </FormCard>
    </FormPage>
  );
}
