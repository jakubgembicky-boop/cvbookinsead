import { createClient } from '@/lib/supabase/server'
import { getCachedEnrichedProfiles } from '@/lib/enriched-data'
import { parseAllLanguages } from '@/lib/search'
import {
  extractCareerSteps,
  extractTransitions,
  countMap,
  topN,
  type CareerStep,
} from '@/lib/aggregate'
import { Card } from '@/components/ui/Card'

import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

/** Last successful LinkedIn refresh (written by refresh_linkedin.py). */
function lastRefresh(): string | null {
  try {
    const p = path.join(process.cwd(), 'data', 'refresh_log.json')
    const log = JSON.parse(fs.readFileSync(p, 'utf-8')) as { ran_at?: string; cookie_ok?: boolean }[]
    const ok = log.find((e) => e.cookie_ok !== false && e.ran_at)
    return ok?.ran_at ? new Date(ok.ran_at).toLocaleDateString('en-GB') : null
  } catch {
    return null
  }
}

function normalizeNationalities(raw: string[]): string[] {
  return raw
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !['EU', 'US', 'UK', 'Student Pass', 'Singapore Student Pass'].some((tag) =>
          s.includes(tag)
        )
    )
    .map((s) => s.split('(')[0].trim())
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------
export default async function StatsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const cached = await getCachedEnrichedProfiles()
  const profiles = cached.map(p => ({
    ...p,
    isSelf: !!(user && p.profileId === user.id)
  }))

  const liCount = profiles.filter((p) => p.li_enriched_at).length

  // Per-profile career steps (taxonomy-classified, INSEAD excluded)
  const allSteps: CareerStep[][] = profiles.map((p) => extractCareerSteps(p))

  // Nationalities
  const natMap: Record<string, number> = {}
  for (const p of profiles) {
    if (!p.nationalities?.length) continue
    for (const nat of normalizeNationalities(p.nationalities)) {
      if (nat) natMap[nat] = (natMap[nat] ?? 0) + 1
    }
  }
  const topNationalities = topN(natMap, 20)

  // Languages
  const langMap: Record<string, number> = {}
  for (const p of profiles) {
    const raw = p.languages?.length ? p.languages : p.li_languages
    for (const parsed of parseAllLanguages(raw)) {
      langMap[parsed.lang] = (langMap[parsed.lang] ?? 0) + 1
    }
  }
  const topLanguages = topN(langMap, 20)

  // Current (most recent non-INSEAD job) industry & function — one vote per
  // person per category so multi-tag jobs don't double-count people.
  const currentIndMap: Record<string, number> = {}
  const currentFnMap: Record<string, number> = {}
  // All-career industries: any industry a person ever worked in (unique per person)
  const everIndMap: Record<string, number> = {}
  // Geography of experience: countries a person worked in (unique per person)
  const geoMap: Record<string, number> = {}
  // Tenure
  const jobDurations: number[] = []
  const totalSpans: number[] = []

  for (const steps of allSteps) {
    const current = steps.find((s) => !s.isInternship) || steps[0]
    if (current) {
      // taxonomy v2: one vote for the company's primary (sub-)industry
      if (current.primaryIndustry)
        currentIndMap[current.primaryIndustry] = (currentIndMap[current.primaryIndustry] ?? 0) + 1
      if (current.primaryFunction)
        currentFnMap[current.primaryFunction] = (currentFnMap[current.primaryFunction] ?? 0) + 1
    }
    const everInd = new Set(steps.filter(s => !s.isInternship).flatMap((s) => s.industries))
    for (const ind of everInd) everIndMap[ind] = (everIndMap[ind] ?? 0) + 1
    const countries = new Set(steps.map((s) => s.country).filter(Boolean) as string[])
    for (const c of countries) geoMap[c] = (geoMap[c] ?? 0) + 1

    for (const s of steps) {
      if (!s.isInternship && s.durationYears > 0) jobDurations.push(s.durationYears)
    }
    const nonInternSteps = steps.filter((s) => !s.isInternship)
    const years = nonInternSteps.flatMap((s) => [s.startYear, s.endYear]).filter((y) => y !== null) as number[]
    if (years.length >= 2) totalSpans.push(Math.max(...years) - Math.min(...years))
  }

  const currentIndustries = topN(currentIndMap, Object.keys(currentIndMap).length)
  const currentFunctions = topN(currentFnMap, Object.keys(currentFnMap).length)
  const topGeo = topN(geoMap, 20)

  // Top employers (most recent non-INSEAD company)
  const employerMap = countMap(
    allSteps
      .map((steps) => (steps.find((s) => !s.isInternship) || steps[0])?.company)
      .filter(Boolean) as string[]
  )
  const topEmployers = topN(employerMap, 20)

  // Industry transition flows (earlier → later job, single-tag pairs to keep it crisp)
  const flowMap: Record<string, number> = {}
  for (const steps of allSteps) {
    for (const t of extractTransitions(steps)) {
      if (!t.changedIndustry) continue
      const from = t.from.primaryIndustry
      const to = t.to.primaryIndustry
      if (from && to) flowMap[`${from} → ${to}`] = (flowMap[`${from} → ${to}`] ?? 0) + 1
    }
  }
  const topFlows = topN(flowMap, 15)

  // Averages
  const avgLangs = profiles.length
    ? (
        profiles.reduce(
          (sum, p) =>
            sum + parseAllLanguages(p.languages?.length ? p.languages : p.li_languages).length,
          0
        ) / profiles.length
      ).toFixed(1)
    : '0'
  const medJob = median(jobDurations)
  const medSpan = median(totalSpans)

  const total = profiles.length
  const maxNat = topNationalities[0]?.[1] ?? 1
  const maxLang = topLanguages[0]?.[1] ?? 1
  const maxInd = currentIndustries[0]?.[1] ?? 1
  const maxFn = currentFunctions[0]?.[1] ?? 1
  const maxGeo = topGeo[0]?.[1] ?? 1
  const maxEmp = topEmployers[0]?.[1] ?? 1
  const maxFlow = topFlows[0]?.[1] ?? 1

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Class Statistics</h1>
      <p className="text-sm text-gray-500 mb-8">
        Computed from CV data and LinkedIn enrichment ({total} classmates, {liCount}{' '}
        LinkedIn-enriched). Industry and function use the same taxonomy as search.
        {lastRefresh() && (
          <span className="text-gray-400"> · LinkedIn data refreshed {lastRefresh()}</span>
        )}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { value: total, label: 'Total classmates' },
          { value: avgLangs, label: 'Avg. languages' },
          { value: `${medJob.toFixed(1)}y`, label: 'Median time per job' },
          { value: `${medSpan.toFixed(0)}y`, label: 'Median career span' },
        ].map(({ value, label }) => (
          <Card key={label} className="text-center py-6">
            <p className="text-4xl font-bold text-[#003781]">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* Current industries */}
      <Card padding="md" className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#003781] mb-1 pb-2 border-b border-gray-100">
          Industries — Most Recent Role
        </h2>
        <p className="text-[11px] text-gray-400 mb-4">
          Where people worked just before INSEAD. A person can appear in more than one industry.
        </p>
        <div className="space-y-1.5">
          {currentIndustries.map(([industry, count]) => (
            <BarRow key={industry} label={industry} count={count} max={maxInd} color="#E4002B" />
          ))}
        </div>
      </Card>

      {/* Current functions */}
      <Card padding="md" className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#003781] mb-1 pb-2 border-b border-gray-100">
          Functions — Most Recent Role
        </h2>
        <p className="text-[11px] text-gray-400 mb-4">
          What people actually did in their last role (strategy, ops, finance, …).
        </p>
        <div className="space-y-1.5">
          {currentFunctions.map(([fn, count]) => (
            <BarRow key={fn} label={fn} count={count} max={maxFn} />
          ))}
        </div>
      </Card>

      {/* Industry switches */}
      {topFlows.length > 0 && (
        <Card padding="md" className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#003781] mb-1 pb-2 border-b border-gray-100">
            Industry Switches (Top {topFlows.length})
          </h2>
          <p className="text-[11px] text-gray-400 mb-4">
            Most common moves between consecutive jobs across all classmates&apos; careers.
          </p>
          <div className="space-y-1.5">
            {topFlows.map(([flow, count]) => (
              <BarRow key={flow} label={flow} count={count} max={maxFlow} color="#E4002B" wide />
            ))}
          </div>
        </Card>
      )}

      {/* Geography of experience */}
      <Card padding="md" className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#003781] mb-1 pb-2 border-b border-gray-100">
          Countries Worked In (Top 20)
        </h2>
        <p className="text-[11px] text-gray-400 mb-4">
          From job locations across full careers — not nationality.
        </p>
        <div className="space-y-1.5">
          {topGeo.map(([country, count]) => (
            <BarRow key={country} label={country} count={count} max={maxGeo} />
          ))}
        </div>
      </Card>

      {/* Nationalities */}
      <Card padding="md" className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#003781] mb-4 pb-2 border-b border-gray-100">
          Countries of Origin (Top 20)
        </h2>
        <div className="space-y-1.5">
          {topNationalities.map(([country, count]) => (
            <BarRow key={country} label={country} count={count} max={maxNat} />
          ))}
        </div>
      </Card>

      {/* Languages */}
      <Card padding="md" className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#003781] mb-4 pb-2 border-b border-gray-100">
          Languages of the Class (Top 20)
        </h2>
        <div className="space-y-1.5">
          {topLanguages.map(([lang, count]) => (
            <BarRow key={lang} label={lang} count={count} max={maxLang} />
          ))}
        </div>
      </Card>

      {/* Top Employers */}
      <Card padding="md" className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#003781] mb-4 pb-2 border-b border-gray-100">
          Pre-INSEAD Top Employers (Top 20)
        </h2>
        <div className="space-y-1.5">
          {topEmployers.map(([employer, count]) => (
            <BarRow key={employer} label={employer} count={count} max={maxEmp} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function BarRow({
  label,
  count,
  max,
  color = '#003781',
  wide = false,
}: {
  label: string
  count: number
  max: number
  color?: string
  wide?: boolean
}) {
  const pct = Math.round((count / max) * 100)
  return (
    <div className="flex items-center gap-3">
      <span
        className={`${wide ? 'w-64 min-w-[16rem]' : 'w-40 min-w-[10rem]'} text-xs text-gray-700 text-right truncate`}
        title={label}
      >
        {label}
      </span>
      <div className="flex-1 h-4 rounded bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded flex items-center justify-end pr-1.5"
          style={{ width: `${pct}%`, backgroundColor: color }}
        >
          {pct > 15 && <span className="text-[10px] font-bold text-white">{count}</span>}
        </div>
      </div>
      {pct <= 15 && <span className="text-xs font-semibold text-gray-500 w-6">{count}</span>}
    </div>
  )
}
