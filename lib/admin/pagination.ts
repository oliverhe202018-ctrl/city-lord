export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  error?: string
}

export function getPaginationParams(
  params: PaginationParams = {}
): { skip: number; take: number; page: number; pageSize: number } {
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 20))
  const skip = (page - 1) * pageSize
  return { skip, take, page, pageSize }
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams = {}
): PaginatedResponse<T> {
  const { page, pageSize } = getPaginationParams(params)
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}
