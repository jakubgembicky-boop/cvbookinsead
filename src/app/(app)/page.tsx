import { createClient } from '@/lib/supabase/server'
import { getCachedEnrichedProfiles } from '@/lib/enriched-data'
import { DirectoryClient } from '@/components/app/DirectoryClient'

export const dynamic = 'force-dynamic'

export default async function DirectoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cached = await getCachedEnrichedProfiles()
  const enriched = cached.map(p => ({
    ...p,
    isSelf: !!(user && p.profileId === user.id)
  }))

  const { data: selections } = user
    ? await supabase.from('contact_selections').select('contact_email').eq('user_id', user.id)
    : { data: null }
  const selectedEmails = (selections ?? []).map((r) => r.contact_email as string)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Class Directory</h1>
        <p className="text-sm text-gray-500 mt-1">
          {enriched.length} members · INSEAD MBA Class of December 2026
        </p>
      </div>

      <DirectoryClient profiles={enriched} initialSelected={selectedEmails} />
    </div>
  )
}
