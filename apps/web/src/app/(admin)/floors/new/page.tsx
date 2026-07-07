'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  label: z.string().min(1, 'Floor label is required'),
  floorNumber: z.coerce.number().min(0, 'Must be >= 0'),
  totalRooms: z.coerce.number().min(1, 'Must have at least 1 room'),
  washingMachines: z.coerce.number().min(0, 'Must be >= 0'),
  fridges: z.coerce.number().min(0, 'Must be >= 0'),
});

type FormData = z.infer<typeof schema>;

export default function NewFloorPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { floorNumber: 1, totalRooms: 4, washingMachines: 0, fridges: 0 },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api
        .post('floors', {
          json: {
            label: data.label,
            floorNumber: data.floorNumber,
            totalRooms: data.totalRooms,
            amenities: { washingMachines: data.washingMachines, fridges: data.fridges },
          },
        })
        .json<{ success: boolean }>();
      router.push('/floors');
    } catch {
      setSubmitError('Failed to create floor. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Floor</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Add a new floor to the PG</p>
        </div>
      </div>

      {submitError && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Floor Label"
              placeholder="e.g. Ground Floor, First Floor"
              error={errors.label?.message}
              {...register('label')}
            />
            <Input
              label="Floor Number"
              type="number"
              error={errors.floorNumber?.message}
              {...register('floorNumber')}
            />
          </div>
          <Input
            label="Total Rooms"
            type="number"
            error={errors.totalRooms?.message}
            {...register('totalRooms')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Washing Machines"
              type="number"
              error={errors.washingMachines?.message}
              {...register('washingMachines')}
            />
            <Input
              label="Fridges"
              type="number"
              error={errors.fridges?.message}
              {...register('fridges')}
            />
          </div>
        </div>
        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Floor
          </Button>
        </div>
      </form>
    </div>
  );
}
