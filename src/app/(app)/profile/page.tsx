import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEnrichedForProfile } from '@/lib/enriched-data'
import { asProfile } from '@/lib/supabase/helpers'
import { ProfileTabs } from './ProfileTabs'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const typedProfile = asProfile(profile)!
  const enriched = getEnrichedForProfile(typedProfile, user.id)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500">{typedProfile.insead_email}</p>
      </div>
      <ProfileTabs enriched={enriched!} inseadEmail={typedProfile.insead_email} />
    </div>
  )
}
