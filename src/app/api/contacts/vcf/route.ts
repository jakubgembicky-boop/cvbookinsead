import { createClient } from '@/lib/supabase/server'
import { getEnrichedProfiles } from '@/lib/enriched-data'
import { makeVcf } from '@/lib/vcf'
import { asProfiles } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/contacts/vcf        → personal VCF from the user's selections
 * GET /api/contacts/vcf?all=1  → the full cohort
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Not authenticated', { status: 401 })

  const all = new URL(request.url).searchParams.get('all') === '1'

  const { data: profiles } = await supabase.from('profiles').select('*')
  const enriched = getEnrichedProfiles(asProfiles(profiles), user.id)

  let picked = enriched
  let filename = 'insead_26d_contacts.vcf'
  if (!all) {
    const { data: sel } = await supabase
      .from('contact_selections')
      .select('contact_email')
      .eq('user_id', user.id)
    const set = new Set((sel ?? []).map((r) => (r.contact_email as string).toLowerCase()))
    picked = enriched.filter((p) => set.has(p.inseadEmail.toLowerCase()))
    filename = 'my_insead_contacts.vcf'
    if (picked.length === 0) {
      return new Response('No contacts selected', { status: 404 })
    }
  }

  return new Response(makeVcf(picked), {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
