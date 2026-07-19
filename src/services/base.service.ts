import { http } from "@lib/axios";
import type { ApiResponse, PaginatedResponse, PaginationParams } from "../types/global.types";

// =============================================================
// BASE SERVICE CLASS
// All feature services extend this for consistent HTTP patterns.
// =============================================================

export abstract class BaseService<T> {
  protected abstract readonly endpoint: string;

  protected async getAll(params?: Partial<PaginationParams>): Promise<PaginatedResponse<T>> {
    return http.get<PaginatedResponse<T>>(this.endpoint, { params });
  }

  protected async getById(id: string): Promise<ApiResponse<T>> {
    return http.get<ApiResponse<T>>(`${this.endpoint}/${id}`);
  }

  protected async create(data: unknown): Promise<ApiResponse<T>> {
    return http.post<ApiResponse<T>>(this.endpoint, data);
  }

  protected async update(id: string, data: unknown): Promise<ApiResponse<T>> {
    return http.put<ApiResponse<T>>(`${this.endpoint}/${id}`, data);
  }

  protected async patch(id: string, data: unknown): Promise<ApiResponse<T>> {
    return http.patch<ApiResponse<T>>(`${this.endpoint}/${id}`, data);
  }

  protected async remove(id: string): Promise<ApiResponse<void>> {
    return http.delete<ApiResponse<void>>(`${this.endpoint}/${id}`);
  }
}
