// =============================================================
// BRANCH TYPES
// =============================================================

export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBranchInput {
  name: string;
  address?: string;
}

export interface CreateBranchResponse {
  branch: Branch;
  schemaName: string;
}
