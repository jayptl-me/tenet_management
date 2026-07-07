/**
 * Production-grade API error parser.
 *
 * Parses JSON error responses from the backend into human-readable messages
 * with appropriate context for different user scenarios.
 *
 * All API errors follow the contract: { success: false, error: { code, message, details?, requestId? } }
 */

export interface ParsedError {
  /** Machine-readable error code (e.g. 'CLOUDINARY_UPLOAD_FAILED') */
  code: string;
  /** Human-readable message suitable for toast/alert display */
  message: string;
  /** Field-level validation errors, if any */
  fieldErrors?: Record<string, string[]>;
  /** Request ID for support escalation */
  requestId?: string;
}

/**
 * Standard HTTP status codes mapped to user-friendly default messages.
 */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was invalid. Please check your input and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This action conflicts with existing data. Please refresh and try again.',
  422: 'The request could not be processed. Please check your input.',
  429: 'You have made too many requests. Please wait a moment and try again.',
  500: 'An unexpected server error occurred. Our team has been notified.',
  503: 'This service is temporarily unavailable. Please try again later.',
};

/**
 * Service-specific human-readable error context.
 * Maps backend error codes to messages that explain what went wrong
 * in a way that tells the user what to do about it.
 */
const CODE_MESSAGES: Record<string, string> = {
  SERVICE_UNAVAILABLE:
    'This feature is not currently available because a required service is not configured. Please contact your administrator.',
  FEATURE_DISABLED:
    'This feature is currently disabled. You can enable it from the Settings page.',
  INVALID_CREDENTIALS: 'The email or password you entered is incorrect. Please try again.',
  ACCOUNT_DISABLED: 'Your account has been deactivated. Please contact your administrator.',
  TOKEN_REUSE_DETECTED:
    'Your session was terminated as a security precaution. Please log in again.',
  INVALID_TOKEN: 'Your session has expired. Please log in again.',
  NOT_FOUND: 'The requested item was not found. It may have been deleted.',
  DUPLICATE_FLOOR: 'A floor with this number already exists.',
  DUPLICATE_ROOM: 'A room with this number already exists.',
  BED_OCCUPIED: 'This bed is already occupied by another tenant.',
  ALREADY_CHECKED_OUT: 'This tenant has already been checked out.',
  TENANT_NOT_FOUND: 'The tenant could not be found.',
  ROOM_NOT_FOUND: 'The room could not be found. It may have been deleted.',
  FLOOR_NOT_FOUND: 'The floor could not be found. It may have been deleted.',
  VALIDATION_ERROR: 'Please check the highlighted fields and correct any errors.',
  INVALID_INPUT: 'The value you entered is not valid. Please check and try again.',
};

/**
 * Parse any error thrown during an API call and return a structured ParsedError.
 *
 * Usage:
 *   try {
 *     const data = await api.get('tenants').json();
 *   } catch (err) {
 *     const parsed = parseApiError(err);
 *     toast.error(parsed.message);
 *   }
 */
export async function parseApiError(error: unknown): Promise<ParsedError> {
  // HTTP errors from ky (has response property)
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response instanceof Response
  ) {
    const res = error.response as Response;
    const status = res.status;

    try {
      const body = (await res.json()) as {
        success: boolean;
        error?: { code?: string; message?: string; details?: { fields?: Record<string, string[]> }; requestId?: string };
      };

      if (body?.error) {
        const code = body.error.code ?? `HTTP_${status}`;
        const backendMessage = body.error.message;
        // Use context-aware message: specific code translation → backend message → status default
        const message =
          CODE_MESSAGES[code] ??
          backendMessage ??
          STATUS_MESSAGES[status] ??
          'An unexpected error occurred. Please try again.';

        return {
          code,
          message,
          fieldErrors: body.error.details?.fields,
          requestId: body.error.requestId,
        };
      }
    } catch {
      // JSON parsing failed — use status-based fallback
    }

    return {
      code: `HTTP_${status}`,
      message: STATUS_MESSAGES[status] ?? `Request failed with status ${status}.`,
    };
  }

  // Network errors (fetch throws TypeError)
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return {
      code: 'NETWORK_ERROR',
      message:
        'Unable to connect to the server. Please check your internet connection and try again.',
    };
  }

  // ky TimeoutError
  if (error instanceof Error && error.name === 'TimeoutError') {
    return {
      code: 'TIMEOUT',
      message:
        'The request timed out. The server may be waking up from sleep mode. Please wait a moment and try again.',
    };
  }

  // Generic fallback
  return {
    code: 'UNKNOWN_ERROR',
    message:
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred. Please try again.',
  };
}
