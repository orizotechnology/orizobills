import { http } from "@/lib/axios";
import type { Branch } from "@/store/branch.store";

// =============================================================
// BRANCH SERVICE — Frontend API calls
// =============================================================

export interface CreateBranchPayload {
  name: string;
  address?: string;
}

export interface CreateBranchResult {
  branch: Branch;
  schemaName: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const branchService = {
  /** List all active branches */
  list: () => http.get<ApiResponse<Branch[]>>("/branches"),

  /** Create a new branch */
  create: (payload: CreateBranchPayload) =>
    http.post<ApiResponse<CreateBranchResult>>("/branches", payload),

  /** Set a branch as default */
  setDefault: (id: string) =>
    http.patch<ApiResponse<Branch>>(`/branches/${id}/default`),

  /** Soft delete a branch */
  delete: (id: string) =>
    http.delete<ApiResponse<Branch>>(`/branches/${id}`),
};
