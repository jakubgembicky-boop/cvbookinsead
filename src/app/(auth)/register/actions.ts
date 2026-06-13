'use server'

export interface CandidateLite {
  name: string
  klass: string
}

const CLASS_LABEL = 'INSEAD MBA 26D'

/**
 * Search for profiles by name. Returns ONLY name + class — no emails,
 * nationality, or other PII is sent to the client. This prevents the
 * registration search from leaking the cohort's contact details.
 */
export async function searchProfilesAction(query: string): Promise<CandidateLite[]> {
  const { findProfileByName } = await import('@/lib/cv-data')
  const matches = findProfileByName(query)
  return matches.map((p) => ({ name: p.name, klass: CLASS_LABEL }))
}

/**
 * Resolve the INSEAD email for an EXACT profile name. Called only after the
 * user has selected their own profile from the list. Returns the registrant's
 * own INSEAD email so the verification code can be sent — the email is fixed
 * and cannot be substituted by the user.
 */
export async function resolveInseadEmailAction(
  name: string
): Promise<{ email: string | null; error?: string }> {
  const { getAllProfiles, extractInseadEmail } = await import('@/lib/cv-data')
  const profile = getAllProfiles().find((p) => p.name === name)
  if (!profile) {
    return { email: null, error: 'Profile not found.' }
  }
  const email = extractInseadEmail(profile.emails)
  if (!email) {
    return {
      email: null,
      error:
        'No INSEAD email is on file for your profile. Please contact the administrator.',
    }
  }
  return { email }
}
