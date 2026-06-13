import type { Profile } from '@/types'

/**
 * Type-narrow Supabase's untyped `profiles` query results.
 * Centralises the assertion so switching to generated DB types
 * later only requires changing this file.
 */
export function asProfiles(rows: unknown): Profile[] {
  if (!Array.isArray(rows)) return []
  return rows as Profile[]
}

export function asProfile(row: unknown): Profile | null {
  if (!row || typeof row !== 'object') return null
  return row as Profile
}
