// =============================================================
// GLOBAL SHARED TYPES
// =============================================================

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// Pagination
export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Common entity base
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Status types
export type Status = "active" | "inactive" | "pending" | "archived";

// ID type
export type EntityId = string;
