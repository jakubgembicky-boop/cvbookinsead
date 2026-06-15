import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findProfileByEmail } from '@/lib/cv-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Find matching CV data
  const cvData = findProfileByEmail(profile.insead_email)

  const exportData = {
    profile: {
      id: profile.id,
      insead_email: profile.insead_email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      display_name: profile.display_name,
      phone: profile.phone,
      personal_email: profile.personal_email,
      linkedin_url: profile.linkedin_url,
      photo_url: profile.photo_url,
      li_headline: profile.li_headline,
      li_location: profile.li_location,
      li_about: profile.li_about,
      languages: profile.languages,
      nationalities: profile.nationalities,
      work_permits: profile.work_permits,
      profile_completed_at: profile.profile_completed_at,
      created_at: profile.created_at,
    },
    cv_data: cvData,
    exported_at: new Date().toISOString(),
  }

  const jsonString = JSON.stringify(exportData, null, 2)

  return new NextResponse(jsonString, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="insead-26d-profile-export.json"',
    },
  })
}
