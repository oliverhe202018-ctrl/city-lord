/**
 * Admin Pagination Utility
 *
 * Generic pagination helpers used by all admin Server Actions
 * that return list data (territories, users, logs, etc.).
 */

// ==============================================================
// Types
// ==============================================================

export interface PaginationParams {
  /** 1-based page number. Defaults to 1. */
  page?: number
  /** Rows per page. Max 100, default 20. */
  pageSize?: number
  /** Column name to sort by. Caller must whitelist valid values. */
  sortBy?: string
  /** Sort direction. Defaults to 'desc'. */
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationMeta
  error?: string
}

// ==============================================================
// Constants
// ==============================================================

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// ==============================================================
// Helpers
// ==============================================================

/**
 * Normalizes and validates raw pagination params coming from
 * Server Action arguments (which are often partially typed).
 */
export function normalizePaginationParams(params: PaginationParams = {}): Required<PaginationParams> {
  const page = Math.max(1, Math.floor(params.page ?? 1))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? DEFAULT_PAGE_SIZE)))
  const sortBy = params.sortBy ?? 'created_at'
  const sortOrder: 'asc' | 'desc' = params.sortOrder === 'asc' ? 'asc' : 'desc'
  return { page, pageSize, sortBy, sortOrder }
}

/**
 * Calculates the `skip` value for Prisma `findMany`.
 */
export function calcSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize
}

/**
 * Builds a `PaginationMeta` object from raw values.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  pageSize: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

/**
 * Convenience wrapper: wraps data + meta into a standard
 * `PaginatedResponse` success envelope.
 */
export function paginatedSuccess<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: buildPaginationMeta(total, page, pageSize),
  }
}

/**
 * Convenience wrapper for error responses that still conform
 * to the `PaginatedResponse` envelope.
 */
export function paginatedError<T>(error: string): PaginatedResponse<T> {
  return {
    success: false,
    data: [],
    pagination: buildPaginationMeta(0, 1, DEFAULT_PAGE_SIZE),
    error,
  }
}
