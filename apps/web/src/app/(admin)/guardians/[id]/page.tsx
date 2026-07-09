'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Phone, Mail, User, Pencil, FileText, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

interface GuardianDetail {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
  tenant?: {
    _id: string;
    user?: { _id: string; name: string; email: string; phone: string };
    room?: { _id: string; roomNumber: string };
  };
  isEmergencyContact: boolean;
  isActive: boolean;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
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

export default function GuardianDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [guardian, setGuardian] = useState<GuardianDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`guardians/${id}`)
      .json<{ success: boolean; data: GuardianDetail }>()
      .then((res) => setGuardian(res.data))
      .catch(() => setError('Failed to load guardian details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!isLoading && (error || !guardian)) {
    return (
      <FormPage
        title="Guardian Details"
        description="View guardian information"
        backHref="/guardians"
        error={error || 'Guardian not found'}
        maxWidth="4xl"
      />
    );
  }

  return (
    <FormPage
      title={guardian?.name ?? 'Guardian Details'}
      description="Guardian details"
      backHref="/guardians"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        guardian ? (
          <StatusBadge
            variant={statusToVariant(guardian.isActive ? 'active' : 'inactive')}
            label={guardian.isActive ? 'Active' : 'Inactive'}
          />
        ) : undefined
      }
      actions={
        guardian ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/guardians/${guardian._id}/edit`)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {guardian.tenant?._id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/tenants/${guardian.tenant!._id}`)}
              >
                View Tenant
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {guardian && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DetailCard title="Personal Information" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Full Name"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {guardian.name}
                    </span>
                  }
                />
                <DetailRow
                  label="Phone"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {guardian.phone}
                    </span>
                  }
                />
                {guardian.email && (
                  <DetailRow
                    label="Email"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {guardian.email}
                      </span>
                    }
                  />
                )}
                <DetailRow
                  label="Relation"
                  value={<span className="capitalize">{guardian.relation}</span>}
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Status & Linked Info" icon={<Shield />}>
              <DetailList>
                <DetailRow
                  label="Account"
                  value={
                    <StatusBadge
                      variant={guardian.isActive ? 'success' : 'neutral'}
                      label={guardian.isActive ? 'Active' : 'Inactive'}
                    />
                  }
                />
                <DetailRow
                  label="Emergency"
                  value={
                    <StatusBadge
                      variant={guardian.isEmergencyContact ? 'danger' : 'neutral'}
                      label={guardian.isEmergencyContact ? 'Emergency' : 'Standard'}
                    />
                  }
                />
                {guardian.tenant && (
                  <DetailRow
                    label="Linked Tenant"
                    value={
                      <span className="flex flex-col items-end gap-0.5">
                        <span>{guardian.tenant.user?.name ?? 'N/A'}</span>
                        {guardian.tenant.room && (
                          <span className="text-xs font-medium text-[color:var(--color-text-muted)]">
                            Room {guardian.tenant.room.roomNumber}
                          </span>
                        )}
                      </span>
                    }
                  />
                )}
              </DetailList>
            </DetailCard>
          </div>

          {guardian.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {guardian.notes}
              </p>
            </DetailCard>
          )}

          <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
            Created {formatDateTime(guardian.createdAt)} · Updated{' '}
            {formatDateTime(guardian.updatedAt)}
          </p>
        </div>
      )}
    </FormPage>
  );
}
