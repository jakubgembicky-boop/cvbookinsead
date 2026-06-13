'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Add or remove a single classmate (by INSEAD email) from the user's contact book. */
export async function toggleContactSelection(
  contactEmail: string,
  selected: boolean
): Promise<{ ok: boolean; error?: string }> {
  const email = contactEmail.trim().toLowerCase()
  if (!email) return { ok: false, error: 'Missing contact email' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { error } = selected
    ? await supabase
        .from('contact_selections')
        .upsert({ user_id: user.id, contact_email: email }, { onConflict: 'user_id,contact_email' })
    : await supabase
        .from('contact_selections')
        .delete()
        .eq('user_id', user.id)
        .eq('contact_email', email)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/contacts')
  return { ok: true }
}

/** Bulk add (e.g. "select all currently shown" in the directory). */
export async function addContactSelections(
  contactEmails: string[]
): Promise<{ ok: boolean; error?: string }> {
  const emails = [...new Set(contactEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (emails.length === 0) return { ok: true }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const rows = emails.map((contact_email) => ({ user_id: user.id, contact_email }))
  const { error } = await supabase
    .from('contact_selections')
    .upsert(rows, { onConflict: 'user_id,contact_email' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/contacts')
  return { ok: true }
}

/** The current user's selected contact emails (lowercased). */
export async function getContactSelections(): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('contact_selections')
    .select('contact_email')
    .eq('user_id', user.id)
  return (data ?? []).map((r) => r.contact_email as string)
}
