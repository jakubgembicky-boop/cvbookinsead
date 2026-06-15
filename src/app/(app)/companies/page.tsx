import { createClient } from '@/lib/supabase/server'
import { getCachedEnrichedProfiles, getSelfInseadEmail, markSelf } from '@/lib/enriched-data'
import { CompaniesClient } from '@/components/app/CompaniesClient'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cached = await getCachedEnrichedProfiles()
  const selfEmail = await getSelfInseadEmail(user?.id)
  const enriched = markSelf(cached, selfEmail)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Top Companies</h1>
        <p className="text-sm text-gray-500 mt-1">
          Explore where the INSEAD 26D cohort has worked. Discover classmates by their past or current employers.
        </p>
      </div>

      <CompaniesClient profiles={enriched} />
    </div>
  )
}
