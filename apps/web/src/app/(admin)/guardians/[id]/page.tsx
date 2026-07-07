'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Mail, User } from 'lucide-react';
import { api } from '@/lib/api';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          {error}
        </div>
      </div>
    );
  }

  if (!guardian) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          Guardian not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <h2 className="font-black text-2xl text-gray-900 tracking-tight">{guardian.name}</h2>
          <p className="text-sm text-gray-500">Guardian Details</p>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Personal Info Section */}
          <section className="space-y-4">
            <h3 className="border-b-2 border-gray-200 pb-2 font-black text-lg text-gray-900">
              Personal Information
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Full Name
                  </p>
                  <p className="text-base font-black text-gray-900">
                    {guardian.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Phone
                  </p>
                  <p className="text-base font-black text-gray-900">
                    {guardian.phone}
                  </p>
                </div>
              </div>

              {guardian.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Email
                    </p>
                    <p className="text-base font-black text-gray-900">
                      {guardian.email}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <User className="h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Relation
                  </p>
                  <p className="text-base font-black capitalize text-gray-900">
                    {guardian.relation}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Status & Linked Info Section */}
          <section className="space-y-4">
            <h3 className="border-b-2 border-gray-200 pb-2 font-black text-lg text-gray-900">
              Status & Linked Info
            </h3>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Account Status
                  </p>
                  {guardian.isActive ? (
                    <span className="inline-flex rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-0.5 text-xs font-black text-emerald-700 shadow-[2px_2px_0px_0px_#a7f3d0]">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border-2 border-red-400 bg-red-50 px-3 py-0.5 text-xs font-black text-red-700 shadow-[2px_2px_0px_0px_#fca5a5]">
                      Inactive
                    </span>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Emergency Contact
                  </p>
                  {guardian.isEmergencyContact ? (
                    <span className="inline-flex rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-0.5 text-xs font-black text-emerald-700 shadow-[2px_2px_0px_0px_#a7f3d0]">
                      Emergency
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border-2 border-gray-300 bg-gray-50 px-3 py-0.5 text-xs font-black text-gray-600">
                      Standard
                    </span>
                  )}
                </div>
              </div>

              {guardian.tenant && (
                <div className="rounded-md border-2 border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Linked Tenant
                  </p>
                  <p className="text-base font-black text-gray-900">
                    {guardian.tenant.user?.name ?? 'N/A'}
                  </p>
                  {guardian.tenant.room && (
                    <p className="mt-0.5 text-sm text-gray-500">
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
          <section className="mt-6 border-t-2 border-gray-200 pt-4">
            <h4 className="mb-2 font-black text-sm text-gray-700">Notes</h4>
            <p className="text-sm leading-relaxed text-gray-600">
              {guardian.notes}
            </p>
          </section>
        )}
      </div>

      {/* Metadata */}
      <p className="text-right text-xs text-gray-400">
        Created {formatDateTime(guardian.createdAt)} • Updated {formatDateTime(guardian.updatedAt)}
      </p>
    </div>
  );
}