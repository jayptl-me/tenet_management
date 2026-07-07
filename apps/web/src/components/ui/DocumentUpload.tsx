'use client';

import { useState, useRef } from 'react';
import { FileUp, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

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

    // Reset error
    setError('');

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File must be under ${MAX_SIZE_MB}MB`);
      toast.error(`File too large — must be under ${MAX_SIZE_MB}MB`);
      // Reset input so the same file can be re-selected
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
      // Reset input so the same file can be re-selected after an error
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const label = docType === 'aadhaar' ? 'Aadhaar' : 'Photo';

  return (
    <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-surface-800 font-display mb-2 text-sm font-semibold">
        <FileText className="text-surface-400 mr-1 inline h-3.5 w-3.5" />
        {label}
      </p>

      {currentUrl ? (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:text-brand-800 mb-2 block text-sm underline"
        >
          View {label}
        </a>
      ) : (
        <p className="text-surface-400 mb-2 text-sm">Not uploaded</p>
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
        <p className="text-danger-600 mt-2 text-xs font-semibold">{error}</p>
      )}
    </div>
  );
}