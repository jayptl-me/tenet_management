'use client';

import { useState } from 'react';
import { BadgeCheck, Copy, Printer, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { copyToClipboard } from '@/lib/whatsapp';

export interface VisitorGatePassHost {
  name?: string | null;
  roomNumber?: string | null;
  bedId?: string | null;
  floorLabel?: string | null;
}

export interface VisitorGatePassVisit {
  id: string;
  visitorName: string;
  visitorPhone?: string | null;
  purpose?: string | null;
  expectedArrival?: string | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  status: string;
}

export interface VisitorGatePassCardProps {
  visit: VisitorGatePassVisit;
  host?: VisitorGatePassHost | null;
  className?: string;
}

export function visitorPassCode(id: string): string {
  const clean = (id ?? '').trim();
  if (!clean) return '------';
  return clean.length > 6 ? clean.slice(-6).toUpperCase() : clean.toUpperCase();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

/**
 * Printable gate pass card for a visitor (admin parity with the Flutter
 * digital visitor pass). Copy shares pass text; Print isolates the pass
 * via print CSS so gate staff get a clean slip.
 */
export function VisitorGatePassCard({ visit, host, className }: VisitorGatePassCardProps) {
  const [copied, setCopied] = useState(false);
  const passCode = visitorPassCode(visit.id);

  const hostLine = host?.name
    ? `${host.name}${host.roomNumber ? ` (Room ${host.roomNumber}${host.bedId ? `, Bed ${host.bedId}` : ''})` : ''}${host.floorLabel ? `, ${host.floorLabel}` : ''}`
    : '—';

  const passText = [
    'TENET VISITOR PASS',
    `Pass Code: #${passCode}`,
    `Visitor: ${visit.visitorName}`,
    `Phone: ${visit.visitorPhone ?? '--'}`,
    `Purpose: ${visit.purpose ?? 'Visit'}`,
    `Host: ${hostLine}`,
    `Status: ${visit.status.toUpperCase()}`,
  ].join('\n');

  const handleCopy = async () => {
    await copyToClipboard(passText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={className}>
      <div className="visitor-pass-print-area rounded-[var(--radius-lg)] border-[length:var(--bw-default)] border-[color:var(--color-brand-300)] bg-[color:var(--color-card-bg)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.12em] text-[color:var(--color-text-muted)] uppercase">
            <BadgeCheck className="h-4 w-4 text-[color:var(--color-brand-600)]" />
            Visitor Gate Pass
          </p>
          <span className="rounded-[var(--radius-md)] bg-[color:var(--color-field-bg)] px-2.5 py-1 font-mono text-xs font-extrabold tracking-widest text-[color:var(--color-text-primary)]">
            #{passCode}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-lg font-extrabold text-[color:var(--color-brand-700)]"
          >
            {(visit.visitorName ?? 'V').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold text-[color:var(--color-text-primary)]">
              {visit.visitorName}
            </p>
            <p className="text-xs font-semibold text-[color:var(--color-text-secondary)]">
              {visit.visitorPhone ?? '—'} ·{' '}
              <span className="capitalize">{visit.purpose ?? 'Visit'}</span>
            </p>
          </div>
        </div>
        <dl className="mt-4 space-y-2 rounded-[var(--radius-md)] bg-[color:var(--color-field-bg)] p-3 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-[color:var(--color-text-muted)]">Host resident</dt>
            <dd className="text-right font-bold text-[color:var(--color-text-primary)]">
              {hostLine}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-[color:var(--color-text-muted)]">Expected</dt>
            <dd className="text-right font-bold text-[color:var(--color-text-primary)]">
              {formatDateTime(visit.expectedArrival)}
            </dd>
          </div>
          {visit.actualArrival && (
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold text-[color:var(--color-text-muted)]">Checked in</dt>
              <dd className="text-right font-bold text-[color:var(--color-text-primary)]">
                {formatDateTime(visit.actualArrival)}
              </dd>
            </div>
          )}
          {visit.actualDeparture && (
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold text-[color:var(--color-text-muted)]">Checked out</dt>
              <dd className="text-right font-bold text-[color:var(--color-text-primary)]">
                {formatDateTime(visit.actualDeparture)}
              </dd>
            </div>
          )}
        </dl>
        <div className="visitor-pass-no-print mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy pass'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print pass
          </Button>
        </div>
      </div>
    </div>
  );
}
