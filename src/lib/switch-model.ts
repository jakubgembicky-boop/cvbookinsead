// ============================================================================
// Career switch engine v2 — case-based evidence from the cohort.
//
// v2 upgrades:
//  - PRIMARY-industry transitions (taxonomy2): a consultant with retail
//    projects is never counted as having been IN retail; secondary exposure
//    is surfaced as an asset instead.
//  - "Abroad" country option: any country different from the other side.
//  - Time-connectedness: from-job ≥6 months, gap to next ≤3 years; short
//    to-jobs accepted only as internships (badged).
//  - Country similarity groups (DACH, Nordics, …) for a "similar moves"
//    second tier when exact precedent is thin.
//
// Client-safe: pure functions over EnrichedProfile, no server imports.
// ============================================================================

import type { EnrichedProfile } from '@/types'
import { extractCareerSteps, type CareerStep } from '@/lib/aggregate'
import { parentOf, impliedSkills } from '@/lib/taxonomy2'
import { normalizeSkill } from '@/lib/search'

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

export const TIME_RULES = {
  /** minimum years in the from-job for it to count as real experience */
  minFromTenure: 0.5,
  /** maximum years between leaving the from-job and starting the to-job */
  maxGapYears: 3,
  /** to-jobs shorter than this count only when they look like internships */
  minToTenure: 0.25,
}

/** Special value for country selects: anywhere except the other side. */
export const ABROAD = '__abroad__'

/** Country similarity groups for the "similar moves" tier. */
export const COUNTRY_GROUPS: Record<string, string[]> = {
  Germany: ['Austria', 'Switzerland'],
  Austria: ['Germany', 'Switzerland'],
  Switzerland: ['Germany', 'Austria'],
  Sweden: ['Norway', 'Denmark', 'Finland'],
  Norway: ['Sweden', 'Denmark', 'Finland'],
  Denmark: ['Sweden', 'Norway', 'Finland'],
  Finland: ['Sweden', 'Norway', 'Denmark'],
  Netherlands: ['Belgium', 'Luxembourg'],
  Belgium: ['Netherlands', 'Luxembourg', 'France'],
  Luxembourg: ['Belgium', 'Netherlands', 'France'],
  Spain: ['Portugal'],
  Portugal: ['Spain'],
  Czechia: ['Slovakia', 'Poland', 'Hungary', 'Austria'],
  Slovakia: ['Czechia', 'Poland', 'Hungary'],
  Poland: ['Czechia', 'Slovakia', 'Hungary'],
  Hungary: ['Czechia', 'Slovakia', 'Poland'],
  UAE: ['Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'],
  'Saudi Arabia': ['UAE', 'Qatar', 'Kuwait', 'Bahrain'],
  Qatar: ['UAE', 'Saudi Arabia', 'Kuwait', 'Bahrain'],
  Singapore: ['Hong Kong'],
  'Hong Kong': ['Singapore'],
  Australia: ['New Zealand'],
  'New Zealand': ['Australia'],
  'United Kingdom': ['Ireland'],
  Ireland: ['United Kingdom'],
  'United States': ['Canada'],
  Canada: ['United States'],
  Brazil: ['Argentina', 'Chile', 'Colombia'],
  Argentina: ['Brazil', 'Chile', 'Uruguay'],
  Chile: ['Argentina', 'Peru', 'Colombia'],
  Colombia: ['Peru', 'Chile', 'Mexico'],
  Mexico: ['Colombia', 'Peru'],
  Peru: ['Chile', 'Colombia'],
  France: ['Belgium', 'Switzerland', 'Luxembourg'],
  Italy: ['Spain', 'France'],
  Japan: ['South Korea'],
  'South Korea': ['Japan'],
  India: ['Singapore', 'UAE'],
  China: ['Hong Kong', 'Singapore'],
}

/** Primary language(s) per country, for the language lens. */
export const COUNTRY_LANGS: Record<string, string[]> = {
  'United Kingdom': ['English'], 'United States': ['English'], Ireland: ['English'],
  Australia: ['English'], 'New Zealand': ['English'], Canada: ['English', 'French'],
  Singapore: ['English'], 'Hong Kong': ['English', 'Chinese'],
  France: ['French'], Belgium: ['French', 'Dutch'], Luxembourg: ['French', 'German'],
  Switzerland: ['German', 'French', 'Italian'],
  Germany: ['German'], Austria: ['German'],
  Netherlands: ['Dutch', 'English'],
  Spain: ['Spanish'], Mexico: ['Spanish'], Colombia: ['Spanish'], Chile: ['Spanish'],
  Argentina: ['Spanish'], Peru: ['Spanish'],
  Portugal: ['Portuguese'], Brazil: ['Portuguese'],
  Italy: ['Italian'],
  Sweden: ['Swedish', 'English'], Norway: ['Norwegian', 'English'],
  Denmark: ['Danish', 'English'], Finland: ['Finnish', 'English'],
  Poland: ['Polish'], Czechia: ['Czech'], Slovakia: ['Slovak'], Hungary: ['Hungarian'],
  Japan: ['Japanese'], 'South Korea': ['Korean'], China: ['Chinese'], Taiwan: ['Chinese'],
  UAE: ['English', 'Arabic'], 'Saudi Arabia': ['Arabic', 'English'],
  Qatar: ['English', 'Arabic'], Kuwait: ['Arabic', 'English'],
  Egypt: ['Arabic'], Lebanon: ['Arabic', 'French'], Jordan: ['Arabic'],
  Morocco: ['French', 'Arabic'], Tunisia: ['French', 'Arabic'],
  Turkey: ['Turkish'], Israel: ['Hebrew', 'English'],
  India: ['English'], Pakistan: ['English'], Indonesia: ['Indonesian', 'English'],
  Thailand: ['Thai', 'English'], Vietnam: ['Vietnamese', 'English'],
  Malaysia: ['English'], Philippines: ['English'],
  Russia: ['Russian'], Ukraine: ['Ukrainian', 'Russian'],
  Greece: ['Greek'], Nigeria: ['English'], Kenya: ['English'], Ghana: ['English'],
  'South Africa': ['English'],
}

// ─────────────────────────────────────────────
// Query / result types
// ─────────────────────────────────────────────

export interface SwitchQuery {
  /** country name, ABROAD, or null = any */
  fromCountry: string | null
  /** sub-industry or top-level bucket label */
  fromIndustry: string | null
  fromFunction: string | null
  toCountry: string | null
  toIndustry: string | null
  toFunction: string | null
}

export type Confidence = 'strong' | 'moderate' | 'limited' | 'none'

export interface Mover {
  profile: EnrichedProfile
  fromStep: CareerStep
  toStep: CareerStep
  tenureBefore: number
  /** to-job shorter than the normal bar but looks like an internship */
  viaInternship: boolean
  skillsBeforeMove: string[]
}

export interface SwitchResult {
  movers: Mover[]
  confidence: Confidence
  commonSkills: [string, number][]
  destinationEmployers: [string, number][]
  originEmployers: [string, number][]
  medianTenureBefore: number
  /** confidence === 'none'/'limited': one relaxed dimension at a time */
  nearestNeighbors: { relaxed: string; movers: Mover[] }[]
  /** country-similarity tier: same move from/to a similar country */
  similarMoves: { label: string; movers: Mover[] }[]
}

export interface ProfileWithSteps {
  profile: EnrichedProfile
  steps: CareerStep[]
}

// ─────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────

export function buildStepsIndex(profiles: EnrichedProfile[]): ProfileWithSteps[] {
  return profiles.map((profile) => ({ profile, steps: extractCareerSteps(profile) }))
}

/** Industry constraint matches the job's PRIMARY industry only (sub or parent). */
function industryMatches(step: CareerStep, wanted: string): boolean {
  if (!step.primaryIndustry) return false
  return step.primaryIndustry === wanted || parentOf(step.primaryIndustry) === wanted
}

function stepMatches(
  step: CareerStep,
  country: string | null,
  industry: string | null,
  fn: string | null,
  abroadRelativeTo: string | null
): boolean {
  if (country === ABROAD) {
    if (!step.country) return false
    if (abroadRelativeTo && step.country === abroadRelativeTo) return false
  } else if (country && step.country !== country) {
    return false
  }
  if (industry && !industryMatches(step, industry)) return false
  if (fn && step.primaryFunction !== fn && !step.secondaryFunctions.includes(fn)) return false
  return true
}

function isInternRole(step: CareerStep): boolean {
  return /\bintern(ship)?\b|\bstagiaire\b|\bpraktikant\b/i.test(step.role)
}

/** Time-connectedness: real from-tenure, bounded gap, internship exception. */
function timeConnected(from: CareerStep, to: CareerStep): { ok: boolean; viaInternship: boolean } {
  if (from.durationYears < TIME_RULES.minFromTenure && !isInternRole(from)) {
    // from-jobs that are themselves internships still count as a starting point
    if (from.durationYears <= 0) return { ok: false, viaInternship: false }
  }
  if (from.durationYears < TIME_RULES.minFromTenure) return { ok: false, viaInternship: false }

  if (from.endYear !== null && to.startYear !== null) {
    const gap = to.startYear - from.endYear
    if (gap > TIME_RULES.maxGapYears) return { ok: false, viaInternship: false }
  }

  const viaInternship = isInternRole(to)
  if (to.durationYears < TIME_RULES.minToTenure && !viaInternship && to.durationYears > 0) {
    return { ok: false, viaInternship: false }
  }
  return { ok: true, viaInternship }
}

function findMovers(index: ProfileWithSteps[], q: SwitchQuery): Mover[] {
  const movers: Mover[] = []

  for (const { profile, steps } of index) {
    let best: Mover | null = null

    for (let i = 0; i < steps.length && !best; i++) {
      const toStep = steps[i]

      for (let j = i + 1; j < steps.length; j++) {
        const fromStep = steps[j]

        if (!stepMatches(fromStep, q.fromCountry, q.fromIndustry, q.fromFunction, toStep.country))
          continue
        if (!stepMatches(toStep, q.toCountry, q.toIndustry, q.toFunction, fromStep.country))
          continue

        // constrained target dimensions must represent a real change
        if (q.toCountry === ABROAD) {
          if (!fromStep.country || !toStep.country || fromStep.country === toStep.country) continue
        } else if (q.toCountry && fromStep.country === q.toCountry) continue
        if (q.toIndustry && industryMatches(fromStep, q.toIndustry)) continue
        if (q.toFunction && fromStep.primaryFunction === q.toFunction) continue

        const t = timeConnected(fromStep, toStep)
        if (!t.ok) continue

        // Calculate skills accumulated BEFORE the move
        const pastSteps = steps.slice(i + 1) // Steps are ordered newest to oldest, so anything after `i` is older
        const pastImplied = impliedSkills(pastSteps)
        
        // Combine base skills from CV (which aren't dated) + implied skills from past jobs
        const baseSkills = new Set<string>()
        for (const raw of [...(profile.skills ?? []), ...(profile.li_skills ?? [])]) {
          for (const s of normalizeSkill(raw)) baseSkills.add(s)
        }
        for (const s of pastImplied) {
          for (const ns of normalizeSkill(s)) baseSkills.add(ns)
        }

        best = {
          profile,
          fromStep,
          toStep,
          tenureBefore: fromStep.durationYears,
          viaInternship: t.viaInternship,
          skillsBeforeMove: [...baseSkills],
        }
        break
      }
    }

    if (best) movers.push(best)
  }

  return movers
}

function aggregateMovers(movers: Mover[]): Pick<
  SwitchResult,
  'commonSkills' | 'destinationEmployers' | 'originEmployers' | 'medianTenureBefore'
> {
  const skillMap: Record<string, number> = {}
  const destMap: Record<string, number> = {}
  const origMap: Record<string, number> = {}
  const tenures: number[] = []

  const display: Record<string, string> = {}
  const companyKey = (name: string) => {
    const k = name.trim().toLowerCase()
    if (!display[k] || (display[k] === display[k].toUpperCase() && name !== name.toUpperCase())) {
      display[k] = name.trim()
    }
    return k
  }

  for (const m of movers) {
    for (const s of m.skillsBeforeMove) {
      skillMap[s] = (skillMap[s] ?? 0) + 1
    }

    if (m.toStep.company) {
      const k = companyKey(m.toStep.company)
      destMap[k] = (destMap[k] ?? 0) + 1
    }
    if (m.fromStep.company) {
      const k = companyKey(m.fromStep.company)
      origMap[k] = (origMap[k] ?? 0) + 1
    }
    if (m.tenureBefore > 0) tenures.push(m.tenureBefore)
  }

  const sortTop = (map: Record<string, number>, n: number): [string, number][] =>
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
  const withDisplay = (pairs: [string, number][]): [string, number][] =>
    pairs.map(([k, n]) => [display[k] ?? k, n])

  const sorted = [...tenures].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const medianTenureBefore =
    sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

  return {
    commonSkills: sortTop(skillMap, 12).filter(([, n]) => n >= 2 || movers.length === 1),
    destinationEmployers: withDisplay(sortTop(destMap, 8)),
    originEmployers: withDisplay(sortTop(origMap, 8)),
    medianTenureBefore,
  }
}

function confidenceFor(n: number): Confidence {
  if (n >= 15) return 'strong'
  if (n >= 5) return 'moderate'
  if (n >= 2) return 'limited'
  return 'none'
}

export function querySwitch(index: ProfileWithSteps[], q: SwitchQuery): SwitchResult {
  const hasTarget = !!(q.toCountry || q.toIndustry || q.toFunction)
  const emptyResult: SwitchResult = {
    movers: [],
    confidence: 'none',
    commonSkills: [],
    destinationEmployers: [],
    originEmployers: [],
    medianTenureBefore: 0,
    nearestNeighbors: [],
    similarMoves: [],
  }
  if (!hasTarget) return emptyResult

  const movers = findMovers(index, q)
  const confidence = confidenceFor(movers.length)
  const moverIds = new Set(movers.map((m) => m.profile))

  // Country-similarity tier: rerun with similar countries on the constrained
  // side(s); shown whenever the exact match is below "strong".
  const similarMoves: SwitchResult['similarMoves'] = []
  if (movers.length < 15) {
    const variants: { label: string; patch: Partial<SwitchQuery> }[] = []
    if (q.toCountry && q.toCountry !== ABROAD) {
      for (const c of COUNTRY_GROUPS[q.toCountry] ?? []) {
        variants.push({ label: `to ${c} (similar to ${q.toCountry})`, patch: { toCountry: c } })
      }
    }
    if (q.fromCountry && q.fromCountry !== ABROAD) {
      for (const c of COUNTRY_GROUPS[q.fromCountry] ?? []) {
        variants.push({ label: `from ${c} (similar to ${q.fromCountry})`, patch: { fromCountry: c } })
      }
    }
    for (const { label, patch } of variants) {
      const vm = findMovers(index, { ...q, ...patch }).filter((m) => !moverIds.has(m.profile))
      if (vm.length) similarMoves.push({ label, movers: vm })
    }
    similarMoves.sort((a, b) => b.movers.length - a.movers.length)
  }

  // Nearest neighbors: relax one constrained dimension entirely
  const nearestNeighbors: SwitchResult['nearestNeighbors'] = []
  if (movers.length <= 1) {
    const relaxations: { relaxed: string; patch: Partial<SwitchQuery> }[] = []
    if (q.toCountry) relaxations.push({ relaxed: 'any country', patch: { toCountry: null } })
    if (q.toIndustry) relaxations.push({ relaxed: 'any industry', patch: { toIndustry: null } })
    if (q.toFunction) relaxations.push({ relaxed: 'any function', patch: { toFunction: null } })
    if (q.fromCountry || q.fromIndustry || q.fromFunction)
      relaxations.push({
        relaxed: 'any starting point',
        patch: { fromCountry: null, fromIndustry: null, fromFunction: null },
      })

    for (const { relaxed, patch } of relaxations) {
      const rq = { ...q, ...patch }
      if (!rq.toCountry && !rq.toIndustry && !rq.toFunction) continue
      const nn = findMovers(index, rq).filter((m) => !moverIds.has(m.profile))
      if (nn.length > 0) nearestNeighbors.push({ relaxed, movers: nn })
    }
    nearestNeighbors.sort((a, b) => b.movers.length - a.movers.length)
  }

  return {
    movers,
    confidence,
    ...aggregateMovers(movers),
    nearestNeighbors: nearestNeighbors.slice(0, 2),
    similarMoves: similarMoves.slice(0, 3),
  }
}

// ─────────────────────────────────────────────
// Gap analysis vs the user's own profile
// ─────────────────────────────────────────────

export function gapAnalysis(
  self: EnrichedProfile | null,
  commonSkills: [string, number][]
): { has: string[]; missing: string[] } {
  if (!self) return { has: [], missing: commonSkills.map(([s]) => s) }
  const own = new Set<string>()
  for (const raw of [...(self.skills ?? []), ...(self.li_skills ?? [])]) {
    for (const s of normalizeSkill(raw)) own.add(s)
  }
  const has: string[] = []
  const missing: string[] = []
  for (const [skill] of commonSkills) {
    if (own.has(skill)) has.push(skill)
    else missing.push(skill)
  }
  return { has, missing }
}

// ─────────────────────────────────────────────
// Language lens
// ─────────────────────────────────────────────

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function cefrRank(cefr: string | null | undefined): number {
  return cefr ? CEFR_ORDER.indexOf(cefr.toUpperCase()) : -1
}

/** Languages relevant to the target country (empty for ABROAD/null). */
export function targetLanguages(toCountry: string | null): string[] {
  if (!toCountry || toCountry === ABROAD) return []
  return COUNTRY_LANGS[toCountry] ?? []
}
