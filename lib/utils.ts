import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { Prisma } from '@prisma/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely converts a value that might be a Prisma.Decimal, string, or number into a standard JavaScript number.
 * This is crucial for passing data from Server Components to Client Components, as Decimal objects cause serialization errors.
 */
export function mapDecimalToNumber(
  val: Prisma.Decimal | number | string | null | undefined,
  fallback: number = 0
): number {
  if (val === null || val === undefined) return fallback

  if (typeof val === 'number') return val

  if (typeof val === 'string') {
    const parsed = parseFloat(val)
    return isNaN(parsed) ? fallback : parsed
  }

  if (typeof val === 'object' && 'toNumber' in val && typeof val.toNumber === 'function') {
    try {
      return val.toNumber()
    } catch {
      return fallback
    }
  }

  return fallback
}
