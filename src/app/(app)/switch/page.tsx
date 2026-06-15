import { createClient } from '@/lib/supabase/server'
import { getCachedEnrichedProfiles, getSelfInseadEmail, markSelf } from '@/lib/enriched-data'
import { SwitchClient } from '@/components/app/SwitchClient'
import { buildStepsIndex } from '@/lib/switch-model'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export default async function SwitchPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const cached = await getCachedEnrichedProfiles()
  const selfEmail = await getSelfInseadEmail(user?.id)
  const enriched = markSelf(cached, selfEmail)

  let marketSkills = {}
  try {
    let marketPath = path.join(process.cwd(), 'data', 'market_skills.json')
    if (!fs.existsSync(marketPath)) {
      marketPath = path.join(process.cwd(), '..', 'insead-cvbook', 'market_skills.json')
    }
    if (fs.existsSync(marketPath)) {
      marketSkills = JSON.parse(fs.readFileSync(marketPath, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to load market_skills.json', e)
  }

  const index = buildStepsIndex(enriched)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Career Switch Assistant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pick the move you&apos;re considering — see who in the cohort already made it, what they
          had, and who to talk to. Evidence from {enriched.length} classmates&apos; careers.
        </p>
      </div>

      <SwitchClient profiles={enriched} marketSkills={marketSkills} index={index} />
    </div>
  )
}
