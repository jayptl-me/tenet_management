// ── Export ─────────────────────────────────────────────
export type IExportFormat = 'csv' | 'json';

export type ExportResource = 'tenants' | 'payments' | 'invoices' | 'complaints' | 'enquiries';

export interface IExportRequest {
  resource: ExportResource;
  format: IExportFormat;
  filters?: Record<string, string>;
}
