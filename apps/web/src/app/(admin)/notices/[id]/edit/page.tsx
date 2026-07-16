'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
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
  { value: 'all', label: 'All tenants' },
  { value: 'floor', label: 'By floor' },
  { value: 'room', label: 'By room' },
  { value: 'individual', label: 'Specific tenant' },
];

export default function EditNoticePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [pickerValue, setPickerValue] = useState('');

  const {
    register,
    handleSubmit,
    reset,
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

  useEffect(() => {
    if (!id) return;
    api
      .get(`notices/${id}`)
      .json<{ success: boolean; data: Record<string, unknown> }>()
      .then((res) => {
        const d = res.data;
        reset({
          title: (d.title as string) ?? '',
          content: (d.content as string) ?? '',
          pinned: (d.pinned as boolean) ?? false,
          targetType:
            (d.targetType as 'all' | 'floor' | 'room' | 'individual') ?? 'all',
          targetIds: Array.isArray(d.targetIds) ? (d.targetIds as string[]).join(', ') : '',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load notice');
        setIsLoading(false);
      });
  }, [id, reset]);

  const addTargetId = (idToAdd: string) => {
    if (!idToAdd) return;
    const next = selectedIds.includes(idToAdd) ? selectedIds : [...selectedIds, idToAdd];
    setValue('targetIds', next.join(', '), { shouldValidate: true });
    setPickerValue('');
  };

  const removeTargetId = (idToRemove: string) => {
    setValue('targetIds', selectedIds.filter((t) => t !== idToRemove).join(', '), {
      shouldValidate: true,
    });
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = {
      title: data.title,
      content: data.content,
      pinned: data.pinned ?? false,
      targetType: data.targetType ?? 'all',
      targetIds: parseTargetIds(data.targetIds),
    };
    try {
      await api.put(`notices/${id}`, { json: payload }).json();
      router.push('/notices');
    } catch {
      setSubmitError('Failed to update notice');
    }
  };

  return (
    <FormPage
      title="Edit Notice"
      description="Update bulletin content, audience, and publish state"
      backHref="/notices"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/notices"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Content" description="Headline and body shown to tenants">
          <FormGrid>
            <FormFullWidth>
              <Input label="Title" error={errors.title?.message} {...register('title')} />
            </FormFullWidth>
            <FormFullWidth>
              <Textarea
                label="Content"
                rows={6}
                placeholder="Write the full notice content..."
                error={errors.content?.message}
                {...register('content')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>

        <FormSection title="Audience" description="Who should see this notice" divided>
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
                    {selectedIds.map((tid) => (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => removeTargetId(tid)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-danger-300)] hover:text-[color:var(--color-danger-600)]"
                        title="Remove"
                      >
                        <span className="max-w-[12rem] truncate font-[family:var(--font-mono)]">
                          {tid}
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
        </FormSection>

        <FormSection
          title="Publishing"
          description="Pin state on the notices board"
          divided
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
            <Checkbox label="Pin this notice" {...register('pinned')} />
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
