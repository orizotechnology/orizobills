import type { ApiResponse, ApiErrorResponse, PaginatedResult } from "../types/common.types";

// =============================================================
// RESPONSE UTILITIES
// Standardised API response builders
// =============================================================

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
}

export function errorResponse(
  message: string,
  statusCode = 500,
  code?: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    success: false,
    error: {
      message,
      statusCode,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    },
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): ApiResponse<PaginatedResult<T>> {
  return successResponse({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
