// ── Export ─────────────────────────────────────────────
export type IExportFormat = 'csv' | 'json';

export type ExportResource =
  | 'tenants'
  | 'payments'
  | 'invoices'
  | 'complaints'
  | 'enquiries'
  | 'visitors'
  | 'attendance'
  | 'electricity'
  | 'assets'
  | 'leaves'
  | 'floors'
  | 'rooms'
  | 'guardians'
  | 'notices'
  | 'menus'
  | 'laundry-slots'
  | 'washing-machines';

export interface IExportRequest {
  resource: ExportResource;
  format: IExportFormat;
  filters?: Record<string, string>;
}

export interface IExportLogPayload {
  resource: ExportResource;
  recordCount?: number;
  format?: IExportFormat;
}
