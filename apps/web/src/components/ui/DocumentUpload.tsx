'use client';

import { useState, useRef } from 'react';
import { FileUp, FileText, Loader2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

interface DocumentUploadProps {
  tenantId: string;
  docType: 'aadhaar' | 'photo';
  currentUrl?: string;
  onUploaded: (url: string) => void;
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function DocumentUpload({ tenantId, docType, currentUrl, onUploaded }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);

      const res = await api
        .post(`tenants/${tenantId}/documents`, { body: formData })
        .json<{ success: boolean; data: { url: string } }>();

      toast.success(`${docType === 'aadhaar' ? 'Aadhaar' : 'Photo'} uploaded successfully`);
      onUploaded(res.data.url);
    } catch {
      setError('Failed to upload document');
      toast.error(`Failed to upload ${docType === 'aadhaar' ? 'Aadhaar' : 'Photo'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const label = docType === 'aadhaar' ? 'Aadhaar' : 'Photo';

  return (
    <div className={clsx(surfaceNestedClass, 'p-4')}>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">
        <FileText className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
        {label}
      </p>

      {currentUrl ? (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
        >
          View {label}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className="mb-3 text-sm text-[color:var(--color-text-muted)]">Not uploaded</p>
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
        variant="outline"
        size="sm"
        loading={isUploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <FileUp className="h-3.5 w-3.5" />
            {currentUrl ? 'Replace' : 'Upload'} {label}
          </>
        )}
      </Button>

      {error && (
        <p className="mt-2 text-xs font-semibold text-[color:var(--color-danger-600)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
