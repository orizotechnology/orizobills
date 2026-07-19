import type { PaginatedResult, PaginationQuery } from "../types/common.types";

// =============================================================
// BASE REPOSITORY
// All feature repositories extend this abstract class.
// Provides consistent pagination and CRUD patterns via Prisma.
// =============================================================

export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  /**
   * Find all records with optional pagination.
   */
  abstract findMany(params?: PaginationQuery): Promise<PaginatedResult<T>>;

  /**
   * Find a single record by its primary key.
   */
  abstract findById(id: string): Promise<T | null>;

  /**
   * Create a new record.
   */
  abstract create(data: CreateInput): Promise<T>;

  /**
   * Update an existing record by ID.
   */
  abstract update(id: string, data: UpdateInput): Promise<T>;

  /**
   * Soft or hard delete a record by ID.
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Build a standard Prisma pagination object from query params.
   */
  protected buildPagination(params?: PaginationQuery): { skip: number; take: number } {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));
    return {
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  }

  /**
   * Build a standard paginated result wrapper.
   */
  protected toPaginatedResult(
    data: T[],
    total: number,
    params?: PaginationQuery
  ): PaginatedResult<T> {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
