'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Users, Briefcase, Clock, Sparkles, Languages, GraduationCap } from 'lucide-react'
import type { EnrichedProfile } from '@/types'
import { INDUSTRY_TREE, INDUSTRY_LABELS } from '@/lib/taxonomy2'
import { FUNCTIONS } from '@/lib/taxonomy'
import { parseAllLanguages } from '@/lib/search'
import {
  querySwitch,
  gapAnalysis,
  targetLanguages,
  cefrRank,
  selectTopSkills,
  priorityGaps,
  expertsForSkill,
  ownedLevel,
  ABROAD,
} from '@/lib/switch-model'
import type {
  SwitchQuery,
  ProfileWithSteps,
  Confidence,
  Mover,
  PriorityGap,
} from '@/lib/switch-model'
import { parentOf } from '@/lib/taxonomy2'
import { ProfileCard } from './ProfileCard'
import { ProfileModal } from './ProfileModal'

const CONFIDENCE_CFG: Record<Confidence, { label: string; cls: string; note: string }> = {
  strong: {
    label: 'Strong evidence',
    cls: 'bg-green-50 text-green-700 ring-green-200',
    note: 'Enough movers for a real pattern.',
  },
  moderate: {
    label: 'Moderate evidence',
    cls: 'bg-amber-50 text-amber-700 ring-amber-200',
    note: 'A handful of movers — patterns are indicative, not conclusive.',
  },
  limited: {
    label: 'Limited evidence',
    cls: 'bg-orange-50 text-orange-700 ring-orange-200',
    note: 'Only a few cases — talk to these people directly rather than relying on patterns.',
  },
  none: {
    label: 'No precedent in cohort',
    cls: 'bg-gray-100 text-gray-500 ring-gray-200',
    note: 'Nobody made exactly this move. Similar and closest alternatives below.',
  },
}

// Industry options are now generated dynamically inside the component
// to filter out 0-count entries.
const ALL_INDUSTRIES_FLAT = INDUSTRY_LABELS

const FUNCTION_LABELS = FUNCTIONS.map((c) => c.label).sort((a, b) => a.localeCompare(b))

function CountrySelect({
  label,
  value,
  countries,
  onChange,
}: {
  label: string
  value: string | null
  countries: string[]
  onChange: (v: string | null) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#003781]"
      >
        <option value="">Any</option>
        <option value={ABROAD}>Abroad (anywhere different)</option>
        <optgroup label="Country">
          {countries.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: { label: string; value: string }[]
  onChange: (v: string | null) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#003781]"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Highlight terms a reviewer should see when opening a mover's profile. */
function moverTerms(m: Mover): string[] {
  return [
    m.fromStep.company,
    m.toStep.company,
    m.fromStep.country ?? '',
    m.toStep.country ?? '',
    m.fromStep.role,
    m.toStep.role,
  ].filter((s) => s && s.length > 1)
}

export function SwitchClient({ 
  profiles, 
  marketSkills = {},
  index,
}: { 
  profiles: EnrichedProfile[]
  marketSkills?: Record<string, Record<string, Record<string, number>>>
  index: ProfileWithSteps[]
}) {
  const self = useMemo(() => profiles.find((p) => p.isSelf) ?? null, [profiles])
  const selfSteps = useMemo(
    () => (self ? index.find((e) => e.profile === self)?.steps ?? [] : []),
    [self, index]
  )

  const { countries, validIndustries, validFunctions } = useMemo(() => {
    const cSet = new Set<string>()
    const iSet = new Set<string>()
    const fSet = new Set<string>()

    for (const e of index) {
      if (e.steps.length > 0) {
        const fromStep = e.steps[0]
        if (fromStep.country) cSet.add(fromStep.country)
        if (fromStep.primaryIndustry) iSet.add(fromStep.primaryIndustry)
        if (fromStep.primaryParent) iSet.add(fromStep.primaryParent)
        if (fromStep.primaryFunction) fSet.add(fromStep.primaryFunction)
        // Ensure "To" targets are also allowed to be selected even if 0-count on "From" 
        // Wait, user explicitly requested: "check if there are any industries, functions with 0 people assigned (on the "From" side) and delete them".
        // So we strictly build this based on the "From" side.
      }
    }
    return {
      countries: [...cSet].sort(),
      validIndustries: iSet,
      validFunctions: fSet
    }
  }, [index])

  const dynamicIndustryOptions = useMemo(() => {
    return ALL_INDUSTRIES_FLAT
      .filter(ind => validIndustries.has(ind))
      .sort((a, b) => a.localeCompare(b))
      .map(ind => ({ label: ind, value: ind }))
  }, [validIndustries])

  const dynamicFunctionOptions = useMemo(() => {
    return FUNCTION_LABELS
      .filter(fn => validFunctions.has(fn))
      .sort((a, b) => a.localeCompare(b))
      .map(fn => ({ label: fn, value: fn }))
  }, [validFunctions])

  const [query, setQuery] = useState<SwitchQuery>(() => {
    const cur = selfSteps[0]
    return {
      fromCountry: cur?.country ?? null,
      fromIndustry: cur?.primaryIndustry ?? null,
      fromFunction: cur?.primaryFunction ?? null,
      toCountry: null,
      toIndustry: null,
      toFunction: null,
    }
  })

  const [selected, setSelected] = useState<{ cv: EnrichedProfile; terms: string[] } | null>(null)

  const hasTarget = !!(query.toCountry || query.toIndustry || query.toFunction)
  const result = useMemo(() => querySwitch(index, query), [index, query])
  const gaps = useMemo(() => gapAnalysis(self, result.commonSkills), [self, result.commonSkills])

  const marketPulseSkills = useMemo(() => {
    const ind = query.toIndustry ? parentOf(query.toIndustry) : 'All'
    const fn = query.toFunction
    if (!fn) return null
    // Fall back to 'All' industries if the specific industry isn't in marketSkills
    const industryDict = marketSkills[ind] || marketSkills['All']
    if (!industryDict || !industryDict[fn]) return null
    return industryDict[fn]
  }, [query.toIndustry, query.toFunction, marketSkills])

  // Skills the target move "demands" — union of market pulse + cohort movers.
  const demandSet = useMemo(() => {
    const s = new Set<string>()
    if (marketPulseSkills) for (const k of Object.keys(marketPulseSkills)) s.add(k)
    for (const [skill] of result.commonSkills) s.add(skill)
    return s
  }, [marketPulseSkills, result.commonSkills])

  // The user's top 15 skills, balanced between strength and target relevance.
  const topSkills = useMemo(() => selectTopSkills(self, demandSet, 15), [self, demandSet])

  // 2–3 priority skills to work on (demanded but missing / only beginner).
  const gapPriorities = useMemo(
    () => priorityGaps(self, marketPulseSkills, result.commonSkills, 3),
    [self, marketPulseSkills, result.commonSkills]
  )

  // For each priority gap, who to contact (movers strong in it, else cohort experts).
  const gapExperts = useMemo(() => {
    const moverProfiles = result.movers.map((m) => m.profile)
    return gapPriorities.map((g) => ({
      gap: g,
      experts: expertsForSkill(g.skill, moverProfiles, profiles, self, 2),
    }))
  }, [gapPriorities, result.movers, profiles, self])

  // Profiles a reviewer should highlight in the mover grid: those strong in a gap skill.
  const moverGapHelp = useMemo(() => {
    const map = new Map<EnrichedProfile, string[]>()
    for (const { gap, experts } of gapExperts) {
      for (const p of experts.movers) {
        map.set(p, [...(map.get(p) ?? []), gap.skill])
      }
    }
    return map
  }, [gapExperts])

  // Language lens — default to English if country unrecognized
  const langInfo = useMemo(() => {
    const langs = targetLanguages(query.toCountry)
    if (!langs.length) langs.push('English') // Fallback
    const ownParsed = self
      ? parseAllLanguages(self.languages?.length ? self.languages : self.li_languages)
      : []
    const ownLevels = langs.map((l) => {
      const p = ownParsed.find((x) => x.lang.toLowerCase() === l.toLowerCase())
      return { lang: l, cefr: p?.cefr ?? null }
    })
    // user's best relevant level (max rank across target languages)
    const ownBest = Math.max(-1, ...ownLevels.map((x) => cefrRank(x.cefr)))
    return { langs, ownLevels, ownBest }
  }, [query.toCountry, self])

  // Which movers made the move at the user's level or lower in a target language?
  const moverAtOrBelow = useMemo(() => {
    const ids = new Set<EnrichedProfile>()
    if (!langInfo) return ids
    for (const m of result.movers) {
      const parsed = parseAllLanguages(
        m.profile.languages?.length ? m.profile.languages : m.profile.li_languages
      )
      const best = Math.max(
        -1,
        ...langInfo.langs.map((l) => {
          const p = parsed.find((x) => x.lang.toLowerCase() === l.toLowerCase())
          return cefrRank(p?.cefr)
        })
      )
      // "with your level or lower" — proof the move is reachable at your proficiency
      if (best >= 0 && best <= langInfo.ownBest) ids.add(m.profile)
      else if (langInfo.ownBest < 0 && best < 0) ids.add(m.profile) // both no skill
    }
    return ids
  }, [langInfo, result.movers])

  const set = (patch: Partial<SwitchQuery>) => setQuery((q) => ({ ...q, ...patch }))
  const cfg = CONFIDENCE_CFG[result.confidence]
  const openMover = (m: Mover) => setSelected({ cv: m.profile, terms: moverTerms(m) })

  return (
    <div className="flex flex-col gap-6">
      {/* Query builder */}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#003781] mb-3">
            Where you are{' '}
            {self && (
              <span className="font-normal normal-case text-gray-400">(pre-filled from your CV)</span>
            )}
          </p>
          <div className="grid gap-3">
            <CountrySelect label="Country" value={query.fromCountry} countries={countries} onChange={(v) => set({ fromCountry: v })} />
            <Select label="Industry" value={query.fromIndustry} options={dynamicIndustryOptions} onChange={(v) => set({ fromIndustry: v })} />
            <Select label="Function" value={query.fromFunction} options={dynamicFunctionOptions} onChange={(v) => set({ fromFunction: v })} />
          </div>
        </div>

        <div className="hidden md:flex h-full items-center">
          <ArrowRight className="h-6 w-6 text-[#E4002B]" />
        </div>

        <div className="rounded-xl border border-[#003781]/20 bg-[#003781]/[0.03] p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#E4002B] mb-3">
            Where you want to go
          </p>
          <div className="grid gap-3">
            <CountrySelect label="Country" value={query.toCountry} countries={countries} onChange={(v) => set({ toCountry: v })} />
            <Select label="Industry" value={query.toIndustry} options={dynamicIndustryOptions} onChange={(v) => set({ toIndustry: v })} />
            <Select label="Function" value={query.toFunction} options={dynamicFunctionOptions} onChange={(v) => set({ toFunction: v })} />
          </div>
        </div>
      </div>

      {!hasTarget ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            Pick at least one target — country, industry, or function — to see who made that move.
          </p>
        </div>
      ) : (
        <>
          {/* Confidence + headline */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${cfg.cls}`}>
                {cfg.label}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                <Users className="h-4 w-4 text-gray-400" />
                <strong>{result.movers.length}</strong>{' '}
                {result.movers.length === 1 ? 'classmate' : 'classmates'} made this move
              </span>
              {result.medianTenureBefore > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                  <Clock className="h-4 w-4 text-gray-400" />
                  median <strong>{result.medianTenureBefore.toFixed(1)}y</strong> in role before moving
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">{cfg.note}</p>
          </div>

          {/* Language lens */}
          {langInfo && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#003781] mb-2">
                <Languages className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                Language for {query.toCountry}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {langInfo.ownLevels.map((x) => (
                  <span key={x.lang} className="rounded-full bg-gray-50 px-2.5 py-1 text-gray-700">
                    {x.lang}: <strong>{x.cefr ?? 'you have none'}</strong>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                Movers flagged{' '}
                <span className="font-semibold text-green-600">✓ reachable</span> made this move with
                your level or lower in {langInfo.langs.join('/')} — proof it&apos;s doable at your
                proficiency.
              </p>
            </div>
          )}

          {/* New Market Gap Analysis */}
          {(result.movers.length > 0 || marketPulseSkills) && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#003781] mb-1">
                Skill Gap Analysis
              </p>
              <p className="text-[11px] text-gray-400 mb-4">
                Comparing what you have, what classmates had, and what the live MBA job market demands.
                Filled badges = Strong, Outline = Normal, Dotted = Beginner.
              </p>
              
              <div className="grid md:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                {/* Column 1: Your Skills (top 15, balanced strength + relevance) */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Your Profile <span className="text-gray-300 normal-case">· top 15</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {!self ? (
                      <p className="text-xs text-gray-400 italic">Profile not linked.</p>
                    ) : topSkills.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No skills listed.</p>
                    ) : (
                      topSkills.map(({ skill, level, demanded }) => {
                        // Green = your skill. Filled = strong, outline = normal, dotted = beginner.
                        const cls =
                          level === 'strong'
                            ? 'bg-green-100 text-green-800 border border-green-100'
                            : level === 'normal'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'border border-dotted border-gray-300 text-gray-500'
                        return (
                          <span
                            key={skill}
                            title={`${level}${demanded ? ' · in demand for this move' : ''}`}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${cls}`}
                          >
                            {skill}
                            {demanded && <span className="text-[9px] text-green-500">●</span>}
                          </span>
                        )
                      })
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">
                    Filled = strong · outline = normal · dotted = beginner ·{' '}
                    <span className="text-green-500">●</span> in demand for this move
                  </p>
                </div>

                {/* Column 2: Cohort Movers */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cohort Movers</p>
                  <div className="flex flex-col gap-1.5">
                    {result.commonSkills.length > 0 ? (
                      result.commonSkills.map(([skill, count]) => {
                        const have = gaps.has.includes(skill)
                        return (
                          <div key={skill} className={`inline-flex items-center justify-between text-xs px-2 py-1 rounded-md w-full max-w-[200px]
                            ${have ? 'bg-green-50 text-green-700 font-medium' : 'bg-gray-50 text-gray-600'}
                          `}>
                            <span>{skill}</span>
                            <span className="opacity-50 text-[10px]">×{count}</span>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-xs text-gray-400 italic">No clear pattern.</p>
                    )}
                  </div>
                </div>

                {/* Column 3: Job Market Pulse */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                    Market Pulse <Sparkles className="h-3 w-3 text-amber-400" />
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {marketPulseSkills ? (
                      Object.entries(marketPulseSkills)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([skill, freq]) => {
                          const lvl = ownedLevel(self, skill)
                          const have = lvl === 'strong' || lvl === 'normal'
                          return (
                            <div key={skill} className={`inline-flex items-center justify-between text-xs px-2 py-1 rounded-md w-full max-w-[200px] border
                              ${have ? 'border-green-200 bg-green-50 text-green-700 font-medium' : 'border-amber-200 bg-amber-50 text-amber-800'}
                            `}>
                              <span className="truncate mr-2">{skill}{have && ' ✓'}</span>
                              <span className="font-semibold text-[10px]">{freq}%</span>
                            </div>
                          )
                        })
                    ) : (
                      <p className="text-xs text-gray-400 italic">Select a targeted function (e.g. Strategy Manager, Product Manager) to view live market data.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Priority skills to work on */}
              {self && gapPriorities.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#E4002B] mb-1">
                    Work on these next
                  </p>
                  <p className="text-[11px] text-gray-400 mb-3">
                    Highest-demand skills for this move that you don&apos;t have yet — in priority order.
                  </p>
                  <div className="flex flex-col gap-2">
                    {gapExperts.map(({ gap, experts }, i) => {
                      const helpers = experts.movers.length ? experts.movers : experts.side
                      const fromMovers = experts.movers.length > 0
                      return (
                        <div
                          key={gap.skill}
                          className="flex flex-wrap items-center gap-2 rounded-lg bg-[#E4002B]/[0.03] border border-[#E4002B]/10 px-3 py-2"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E4002B] text-[10px] font-bold text-white">
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{gap.skill}</span>
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            {gap.demand}% demand
                          </span>
                          {gap.owned === 'beginner' && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                              you: beginner
                            </span>
                          )}
                          {helpers.length > 0 && (
                            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-gray-500">
                              <Users className="h-3 w-3 text-gray-400" />
                              {fromMovers ? 'mover who can help:' : 'ask:'}
                              {helpers.slice(0, 2).map((p) => (
                                <button
                                  key={p.inseadEmail || p.name}
                                  onClick={() => setSelected({ cv: p, terms: [gap.skill] })}
                                  className="font-medium text-[#003781] hover:underline"
                                >
                                  {p.name.split(' ')[0]}
                                </button>
                              ))}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* What movers had + route */}
          {result.movers.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {result.commonSkills.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#003781] mb-1">
                    What movers had
                  </p>
                  <p className="text-[11px] text-gray-400 mb-3">
                    {self
                      ? 'Green = already on your profile · outlined = a gap worth closing'
                      : 'Most common skills among movers'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.commonSkills.map(([skill, n]) => {
                      const have = gaps.has.includes(skill)
                      return (
                        <span
                          key={skill}
                          title={`${n} of ${result.movers.length} movers`}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            have ? 'bg-green-100 text-green-700' : 'border border-dashed border-gray-300 text-gray-500'
                          }`}
                        >
                          {skill} <span className="opacity-50">×{n}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {(result.destinationEmployers.length > 0 || result.originEmployers.length > 0) && (
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#003781] mb-3">
                    <Briefcase className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                    Typical route
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px] mb-1.5">From</p>
                      {result.originEmployers.map(([c, n]) => (
                        <p key={c} className="text-gray-700 truncate" title={c}>
                          {c} <span className="text-gray-400">×{n}</span>
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px] mb-1.5">To</p>
                      {result.destinationEmployers.map(([c, n]) => (
                        <p key={c} className="text-gray-700 truncate" title={c}>
                          {c} <span className="text-gray-400">×{n}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Who to talk to */}
          {result.movers.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Who to talk to
              </p>
              <MoverGrid movers={result.movers} onSelect={openMover} reachable={moverAtOrBelow} gapHelp={moverGapHelp} />
            </div>
          )}

          {/* Similar-country moves */}
          {result.similarMoves.map((sm) => (
            <div key={sm.label}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Similar move — {sm.label}
              </p>
              <p className="text-[11px] text-gray-400 mb-3">
                {sm.movers.length} {sm.movers.length === 1 ? 'classmate' : 'classmates'} · comparable
                market, useful to talk to
              </p>
              <MoverGrid movers={sm.movers.slice(0, 10)} onSelect={openMover} reachable={moverAtOrBelow} />
            </div>
          ))}

          {/* Nearest neighbors */}
          {result.nearestNeighbors.map((nn) => (
            <div key={nn.relaxed}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Closest alternative — same move but {nn.relaxed}
              </p>
              <p className="text-[11px] text-gray-400 mb-3">
                {nn.movers.length} {nn.movers.length === 1 ? 'classmate' : 'classmates'}
              </p>
              <MoverGrid movers={nn.movers.slice(0, 10)} onSelect={openMover} reachable={moverAtOrBelow} />
            </div>
          ))}
        </>
      )}

      {selected && (
        <ProfileModal
          cv={selected.cv}
          terms={selected.terms}
          onClose={() => setSelected(null)}
          onAddTerm={() => {}}
        />
      )}
    </div>
  )
}

function MoverGrid({
  movers,
  onSelect,
  reachable,
  gapHelp,
}: {
  movers: Mover[]
  onSelect: (m: Mover) => void
  reachable: Set<EnrichedProfile>
  gapHelp?: Map<EnrichedProfile, string[]>
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {movers.map((m, i) => {
        const helps = gapHelp?.get(m.profile)
        return (
          <div
            key={`${m.profile.inseadEmail || m.profile.name}-${i}`}
            className={`flex flex-col gap-1 ${helps ? 'rounded-xl ring-2 ring-[#E4002B]/40 ring-offset-2' : ''}`}
          >
            <ProfileCard cv={m.profile} terms={helps ?? []} onClick={() => onSelect(m)} />
            <div className="flex flex-wrap justify-center gap-1 px-1">
              {helps && helps.map((s) => (
                <span key={s} className="inline-flex items-center rounded-full bg-[#E4002B]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#E4002B]">
                  can help: {s}
                </span>
              ))}
              {m.viaInternship && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600">
                  <GraduationCap className="h-2.5 w-2.5" /> via internship
                </span>
              )}
              {reachable.has(m.profile) && (
                <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-600">
                  ✓ reachable
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 text-center leading-tight px-1">
              {m.fromStep.company} → {m.toStep.company}
            </p>
          </div>
        )
      })}
    </div>
  )
}
