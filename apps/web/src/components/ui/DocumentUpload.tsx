'use client';

import { useState, useRef } from 'react';
import {
  FileUp,
  FileText,
  Loader2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Lock,
  Camera,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

export type GovIdType = 'aadhaar' | 'passport' | 'voter_id' | 'driving_license';

interface DocumentUploadProps {
  tenantId: string;
  docType: 'photo' | GovIdType | string;
  currentUrl?: string;
  idNumberMasked?: string;
  isVerified?: boolean;
  onUploaded: (data: { url: string; docType: string; idNumberMasked?: string }) => void;
}

const ID_OPTIONS: { value: GovIdType; label: string }[] = [
  { value: 'aadhaar', label: 'Masked Aadhaar Card' },
  { value: 'passport', label: 'Indian Passport' },
  { value: 'voter_id', label: 'Voter ID (EPIC)' },
  { value: 'driving_license', label: 'Driving License' },
];

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function DocumentUpload({
  tenantId,
  docType: initialDocType,
  currentUrl,
  idNumberMasked: initialMaskedId,
  isVerified = false,
  onUploaded,
}: DocumentUploadProps) {
  const isPhoto = initialDocType === 'photo';
  const initialSelectedType: GovIdType =
    !isPhoto && ['aadhaar', 'passport', 'voter_id', 'driving_license'].includes(initialDocType)
      ? (initialDocType as GovIdType)
      : 'aadhaar';

  const [selectedIdType, setSelectedIdType] = useState<GovIdType>(initialSelectedType);
  const [maskedId, setMaskedId] = useState(initialMaskedId || '');
  const [consentGiven, setConsentGiven] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDocType = isPhoto ? 'photo' : selectedIdType;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (file.size > MAX_SIZE_BYTES) {
      setError(`File must be under ${MAX_SIZE_MB}MB`);
      toast.error(`File too large — must be under ${MAX_SIZE_MB}MB`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!isPhoto && !consentGiven) {
      setError('Statutory resident consent is required for Indian compliance');
      toast.error('Please confirm resident consent');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', activeDocType);
      if (!isPhoto && maskedId.trim()) {
        formData.append('idNumberMasked', maskedId.trim());
      }
      if (!isPhoto) {
        formData.append('consentGiven', 'true');
      }

      const res = await api
        .post(`tenants/${tenantId}/documents`, { body: formData })
        .json<{
          success: boolean;
          data: { url: string; docType: string; idNumberMasked?: string; message: string };
        }>();

      toast.success(res.data?.message || 'Document uploaded securely');
      onUploaded({
        url: res.data.url,
        docType: res.data.docType,
        idNumberMasked: res.data.idNumberMasked || maskedId,
      });
    } catch {
      setError('Failed to upload document');
      toast.error(`Failed to upload ${isPhoto ? 'Photo' : selectedIdType}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleViewSecureDocument = async () => {
    setIsViewing(true);
    try {
      const res = await api
        .get(`tenants/${tenantId}/documents/${activeDocType}`)
        .json<{ success: boolean; data: { url: string } }>();

      if (res.data?.url) {
        window.open(res.data.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Document URL not found');
      }
    } catch {
      toast.error('Failed to generate secure document access link');
    } finally {
      setIsViewing(false);
    }
  };

  const title = isPhoto ? 'Resident Profile Photo' : 'Government Identity Document (OVD)';

  return (
    <div
      className={clsx(
        surfaceNestedClass,
        'p-4 rounded-[var(--radius-lg)] border border-[color:var(--border-color)]',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">
          {isPhoto ? (
            <Camera className="h-4 w-4 text-[color:var(--color-brand-600)]" />
          ) : (
            <Lock className="h-4 w-4 text-[color:var(--color-brand-600)]" />
          )}
          {title}
        </p>
        {isVerified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-50)] px-2 py-0.5 text-xs font-semibold text-[color:var(--color-success-700)] border border-[color:var(--color-success-200)]">
            <ShieldCheck className="h-3 w-3" />
            Verified
          </span>
        )}
      </div>

      {!isPhoto && (
        <div className="mb-3 space-y-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
                Document Type
              </label>
              <select
                value={selectedIdType}
                onChange={(e) => setSelectedIdType(e.target.value as GovIdType)}
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-text-primary)] focus:border-[color:var(--color-brand-500)] focus:outline-none"
              >
                {ID_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
                Masked ID Number
              </label>
              <input
                type="text"
                value={maskedId}
                onChange={(e) => setMaskedId(e.target.value)}
                placeholder={selectedIdType === 'aadhaar' ? 'XXXX-XXXX-1234' : 'Masked ID #'}
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2.5 py-1.5 text-xs font-mono text-[color:var(--color-text-primary)] focus:border-[color:var(--color-brand-500)] focus:outline-none"
              />
            </div>
          </div>

          {selectedIdType === 'aadhaar' && (
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]/70 p-2 text-[11px] text-[color:var(--color-brand-900)]">
              <span className="font-semibold">UIDAI Advisory:</span> Upload a Masked Aadhaar (first 8 digits hidden). Residents can download this at{' '}
              <a
                href="https://myaadhaar.uidai.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline hover:text-[color:var(--color-brand-700)]"
              >
                myaadhaar.uidai.gov.in
              </a>
              .
            </div>
          )}

          <label className="flex items-start gap-2 pt-0.5 text-[11px] text-[color:var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-0.5 rounded border-[color:var(--border-color)] text-[color:var(--color-brand-600)] focus:ring-[color:var(--color-brand-500)]"
            />
            <span>
              Resident provided statutory consent under Aadhaar Act & DPDP Act 2023 for police verification records.
            </span>
          </label>
        </div>
      )}

      {currentUrl ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="h-4 w-4 shrink-0 text-[color:var(--color-brand-600)]" />
            <span className="truncate text-xs font-mono font-medium text-[color:var(--color-text-primary)]">
              {maskedId ? `${maskedId}` : isPhoto ? 'Profile Photo' : 'Identity Document'}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={isViewing}
            onClick={handleViewSecureDocument}
            className="text-xs shrink-0 text-[color:var(--color-brand-600)] hover:text-[color:var(--color-brand-700)]"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            View Secure
          </Button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-[color:var(--color-text-muted)]">
          No document uploaded yet. Stored with 10-minute expiring signed security.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={isUploading}
        onClick={() => fileInputRef.current?.click()}
        className="w-full justify-center"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            Encrypting & Uploading...
          </>
        ) : (
          <>
            <FileUp className="h-3.5 w-3.5 mr-1.5" />
            {currentUrl ? 'Replace Document' : 'Upload Document'}
          </>
        )}
      </Button>

      {error && (
        <p
          className="mt-2 flex items-center gap-1 text-xs font-medium text-[color:var(--color-danger-600)]"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
