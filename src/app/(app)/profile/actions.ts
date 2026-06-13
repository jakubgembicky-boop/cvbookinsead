'use server'

import { createClient } from '@/lib/supabase/server'
import type { ProfileOverrides } from '@/types'

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

/**
 * Persist the user's profile edits into the `overrides` jsonb column, and keep
 * the typed columns that other features rely on (nav, contacts, stats) in sync.
 */
export async function saveOverrides(
  payload: ProfileOverrides
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!profile) {
    return {
      ok: false,
      error: fetchErr?.message
        ? `Profile not found: ${fetchErr.message}`
        : 'Profile not found — make sure migration 003 has been applied in Supabase.',
    }
  }

  // Sync typed columns from the override payload
  const synced: Record<string, unknown> = {
    overrides: payload,
  }
  if (typeof payload.name === 'string' && payload.name.trim()) {
    const { first, last } = splitName(payload.name)
    synced.first_name = first
    synced.last_name = last
  }
  if (payload.nationality !== undefined) synced.nationality = payload.nationality || null
  if (Array.isArray(payload.languages)) synced.languages = payload.languages
  if (Array.isArray(payload.phones)) synced.phone = payload.phones[0] ?? null
  if (payload.personal_email !== undefined) synced.personal_email = payload.personal_email || null
  if (payload.linkedin !== undefined) synced.linkedin_url = payload.linkedin || null
  if (payload.photo !== undefined) synced.photo_url = payload.photo || null
  if (payload.li_headline !== undefined) synced.li_headline = payload.li_headline || null
  if (payload.li_about !== undefined) synced.li_about = payload.li_about || null
  if (payload.li_location !== undefined) synced.li_location = payload.li_location || null

  const { error } = await supabase.from('profiles').update(synced).eq('id', profile.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
