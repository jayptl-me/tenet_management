'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Mail, User, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 rounded-lg border-[length:var(--bw-strong)] p-6 text-center">
          <p className="font-display text-danger-800 text-lg font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (!guardian) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 rounded-lg border-[length:var(--bw-strong)] p-6 text-center">
          <p className="font-display text-danger-800 text-lg font-semibold">Guardian not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">{guardian.name}</h2>
          <p className="text-surface-500 text-sm">Guardian Details</p>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Personal Info Section */}
          <section className="space-y-4">
            <h3 className="font-display text-surface-900 border-surface-200 border-b-2 pb-2 text-lg font-bold">
              Personal Information
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Full Name
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {guardian.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Phone
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {guardian.phone}
                  </p>
                </div>
              </div>

              {guardian.email && (
                <div className="flex items-center gap-3">
                  <Mail className="text-surface-400 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                      Email
                    </p>
                    <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                      {guardian.email}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <User className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Relation
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold capitalize">
                    {guardian.relation}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Status & Linked Info Section */}
          <section className="space-y-4">
            <h3 className="font-display text-surface-900 border-[color:var(--color-surface-200)] border-b-2 pb-2 text-lg font-bold">
              Status & Linked Info
            </h3>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div>
                  <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                    Account Status
                  </p>
                  <StatusBadge
                    variant={statusToVariant(guardian.isActive ? 'active' : 'inactive')}
                    label={guardian.isActive ? 'Active' : 'Inactive'}
                  />
                </div>
                <div>
                  <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                    Emergency Contact
                  </p>
                  <StatusBadge
                    variant={guardian.isEmergencyContact ? 'success' : 'neutral'}
                    label={guardian.isEmergencyContact ? 'Emergency' : 'Standard'}
                  />
                </div>
              </div>

              {guardian.tenant && (
                <div className="border-surface-200 bg-surface-50 rounded-md border-[length:var(--bw-default)] p-4">
                  <p className="font-display text-surface-400 mb-2 text-xs uppercase tracking-wide">
                    Linked Tenant
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {guardian.tenant.user?.name ?? 'N/A'}
                  </p>
                  {guardian.tenant.room && (
                    <p className="text-surface-500 mt-0.5 text-sm">
                      Room {guardian.tenant.room.roomNumber}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Notes Section */}
        {guardian.notes && (
          <section className="border-surface-200 mt-6 border-t-2 pt-4">
            <h4 className="font-display text-surface-700 mb-2 text-sm font-bold">Notes</h4>
            <p className="text-surface-600 font-[family:var(--font-body)] text-sm leading-relaxed">
              {guardian.notes}
            </p>
          </section>
        )}
      </div>

      {/* Metadata */}
      <p className="text-surface-400 text-right text-xs">
        Created{' '}
        {new Date(guardian.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        • Updated{' '}
        {new Date(guardian.updatedAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
}
