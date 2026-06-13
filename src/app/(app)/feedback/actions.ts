'use server'

import { createClient } from '@/lib/supabase/server'

export interface FeedbackInput {
  page: string
  sessionSeconds: number
  comment: string
  featureRequest: string
  userAgent: string
}

/** Store one piece of beta-test feedback, attributed to the current user. */
export async function submitFeedback(
  input: FeedbackInput
): Promise<{ ok: boolean; error?: string }> {
  const comment = (input.comment ?? '').trim()
  const feature = (input.featureRequest ?? '').trim()
  if (!comment && !feature) {
    return { ok: false, error: 'Please add a comment or a feature idea first.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    page: (input.page ?? '').slice(0, 200) || null,
    session_seconds: Number.isFinite(input.sessionSeconds)
      ? Math.max(0, Math.round(input.sessionSeconds))
      : null,
    comment: comment.slice(0, 4000) || null,
    feature_request: feature.slice(0, 4000) || null,
    user_agent: (input.userAgent ?? '').slice(0, 400) || null,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
