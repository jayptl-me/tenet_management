'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { WashingMachine, Timer, User, Building2, Hash, Clock, Pencil, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

interface WashingMachineDetail {
  _id: string;
  machineNumber: number;
  label: string;
  status: string;
  floorId?: string;
  floorLabel?: string;
  floorNumber?: number;
  timerDuration: number;
  claimedAt?: string;
  timerEndsAt?: string;
  lastUsedAt?: string;
  notes?: string;
  currentUser?: { id?: string; name?: string; room?: string } | null;
  createdAt: string;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function WashingMachineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [machine, setMachine] = useState<WashingMachineDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`washing-machines/${id}`)
      .json<{ success: boolean; data: WashingMachineDetail }>()
      .then((res) => setMachine(res.data))
      .catch(() => setError('Failed to load washing machine details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleRelease = async () => {
    if (!machine) return;
    try {
      await api.post(`washing-machines/${machine._id}/release`).json();
      const res = await api.get(`washing-machines/${id}`).json<{ success: boolean; data: WashingMachineDetail }>();
      setMachine(res.data);
    } catch {
      setError('Failed to release machine');
    }
  };

  if (!isLoading && (error || !machine)) {
    return (
      <FormPage
        title="Washing Machine"
        description="View washing machine details"
        backHref="/washing-machines"
        error={error || 'Machine not found'}
        maxWidth="4xl"
      />
    );
  }

  const statusVariant = machine
    ? machine.status === 'available'
      ? 'success'
      : machine.status === 'in_use'
        ? 'info'
        : machine.status === 'under_maintenance'
          ? 'warning'
          : 'danger'
    : 'neutral';

  const machineName = machine?.label || (machine ? `Machine ${machine.machineNumber}` : 'Washing Machine');
  const floorDisplay = machine
    ? `${machine.floorLabel ?? 'Floor'}${machine.floorNumber != null ? ` #${machine.floorNumber}` : ''}`
    : '';
  const isInUse = machine?.status === 'in_use';

  return (
    <FormPage
      title={machineName}
      description={floorDisplay}
      backHref="/washing-machines"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        machine ? (
          <StatusBadge variant={statusVariant} label={machine.status.replace(/_/g, ' ')} />
        ) : undefined
      }
      actions={
        machine ? (
          <div className="flex items-center gap-2">
            {isInUse && (
              <Button variant="outline" size="sm" onClick={handleRelease}>
                <RefreshCw className="h-4 w-4" />
                Release Machine
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/washing-machines/${machine._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      {machine && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Machine #"
              value={`#${machine.machineNumber}`}
              icon={<Hash className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Floor"
              value={floorDisplay}
              icon={<Building2 className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Timer Duration"
              value={`${machine.timerDuration} min`}
              icon={<Timer className="h-4 w-4" />}
              variant="brand"
            />
            <StatCard
              title="Status"
              value={machine.status.replace(/_/g, ' ')}
              icon={<WashingMachine className="h-4 w-4" />}
              variant={
                statusVariant === 'success'
                  ? 'success'
                  : statusVariant === 'warning'
                    ? 'warning'
                    : statusVariant === 'danger'
                      ? 'danger'
                      : 'default'
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DetailCard title="Machine Information" icon={<WashingMachine />}>
              <DetailList>
                <DetailRow label="Name / Label" value={machine.label || '—'} />
                <DetailRow label="Machine Number" value={`#${machine.machineNumber}`} />
                <DetailRow label="Floor" value={floorDisplay} />
                <DetailRow label="Timer Duration" value={`${machine.timerDuration} minutes`} />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge variant={statusVariant} label={machine.status.replace(/_/g, ' ')} />
                  }
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Usage Details" icon={<Clock />}>
              <DetailList>
                <DetailRow
                  label="Currently Claimed"
                  value={
                    machine.currentUser ? (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {machine.currentUser.name} (Room {machine.currentUser.room})
                      </span>
                    ) : (
                      'No'
                    )
                  }
                />
                <DetailRow label="Claimed At" value={formatDateTime(machine.claimedAt)} />
                <DetailRow label="Timer Ends At" value={formatDateTime(machine.timerEndsAt)} />
                <DetailRow label="Last Used" value={formatDateTime(machine.lastUsedAt)} />
              </DetailList>
            </DetailCard>
          </div>

          {machine.notes && (
            <DetailCard title="Notes" variant="warning">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {machine.notes}
              </p>
            </DetailCard>
          )}
        </div>
      )}
    </FormPage>
  );
}
