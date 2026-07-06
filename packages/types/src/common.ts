// ── Pagination ─────────────────────────────────────────
export interface IPaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface IPaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── API Response Wrappers ──────────────────────────────
export interface IApiSuccess<T> {
  success: true;
  data: T;
}

export interface IApiError {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, string[]>;
  };
}

export type IApiResponse<T> = IApiSuccess<T> | IApiError;

// ── Domain Types ───────────────────────────────────────
export type MonthString = string; // YYYY-MM format
export type INR = number; // Amount in Indian Rupees

export interface IAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ISocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  youtube?: string;
}
