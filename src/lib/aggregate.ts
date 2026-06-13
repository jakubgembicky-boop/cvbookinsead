// ============================================================================
// Aggregation layer — per-job career steps and transitions.
//
// Feeds the /stats analytics page and the /switch career assistant. Unlike the
// search index (which optimizes for matching), this layer classifies each
// experience entry individually so we can reason about sequences: which
// industry/function/country a person was in at each step, and what changed
// between consecutive steps.
// ============================================================================

import type { CvEntry, EnrichedProfile } from '@/types'
import { INDUSTRIES, FUNCTIONS } from '@/lib/taxonomy'
import { classifyJob, isJunkEntity, parentOf, canonicalizeCompany } from '@/lib/taxonomy2'
import { parseYearsStr, isInseadEntity } from '@/lib/search'

// ─────────────────────────────────────────────
// Location → country resolver
// ─────────────────────────────────────────────

/** Canonical country detection: alias → canonical name. Checked longest-first. */
const COUNTRY_ALIASES: Record<string, string> = {
  // canonical names map to themselves; aliases/cities map to canonical
  'united kingdom': 'United Kingdom', uk: 'United Kingdom', england: 'United Kingdom',
  scotland: 'United Kingdom', britain: 'United Kingdom', london: 'United Kingdom',
  edinburgh: 'United Kingdom', manchester: 'United Kingdom',
  'united states': 'United States', usa: 'United States', 'u.s.': 'United States',
  'new york': 'United States', 'san francisco': 'United States', boston: 'United States',
  chicago: 'United States', 'los angeles': 'United States', seattle: 'United States',
  houston: 'United States', miami: 'United States', washington: 'United States',
  france: 'France', paris: 'France', lyon: 'France', fontainebleau: 'France',
  germany: 'Germany', berlin: 'Germany', munich: 'Germany', frankfurt: 'Germany',
  hamburg: 'Germany', dusseldorf: 'Germany', düsseldorf: 'Germany', cologne: 'Germany',
  switzerland: 'Switzerland', zurich: 'Switzerland', zürich: 'Switzerland',
  geneva: 'Switzerland', basel: 'Switzerland',
  austria: 'Austria', vienna: 'Austria',
  netherlands: 'Netherlands', amsterdam: 'Netherlands', rotterdam: 'Netherlands',
  'the hague': 'Netherlands',
  belgium: 'Belgium', brussels: 'Belgium', antwerp: 'Belgium',
  luxembourg: 'Luxembourg',
  spain: 'Spain', madrid: 'Spain', barcelona: 'Spain',
  italy: 'Italy', milan: 'Italy', rome: 'Italy',
  portugal: 'Portugal', lisbon: 'Portugal', porto: 'Portugal',
  ireland: 'Ireland', dublin: 'Ireland',
  greece: 'Greece', athens: 'Greece',
  sweden: 'Sweden', stockholm: 'Sweden',
  norway: 'Norway', oslo: 'Norway',
  denmark: 'Denmark', copenhagen: 'Denmark',
  finland: 'Finland', helsinki: 'Finland',
  poland: 'Poland', warsaw: 'Poland', krakow: 'Poland',
  'czech republic': 'Czechia', czechia: 'Czechia', czech: 'Czechia',
  prague: 'Czechia', brno: 'Czechia',
  slovakia: 'Slovakia', bratislava: 'Slovakia',
  hungary: 'Hungary', budapest: 'Hungary',
  romania: 'Romania', bucharest: 'Romania',
  bulgaria: 'Bulgaria', sofia: 'Bulgaria',
  ukraine: 'Ukraine', kyiv: 'Ukraine', kiev: 'Ukraine',
  russia: 'Russia', moscow: 'Russia', 'st petersburg': 'Russia',
  turkey: 'Turkey', istanbul: 'Turkey', ankara: 'Turkey',
  'united arab emirates': 'UAE', uae: 'UAE', dubai: 'UAE', 'abu dhabi': 'UAE',
  'saudi arabia': 'Saudi Arabia', riyadh: 'Saudi Arabia', jeddah: 'Saudi Arabia',
  qatar: 'Qatar', doha: 'Qatar',
  kuwait: 'Kuwait', bahrain: 'Bahrain', oman: 'Oman', muscat: 'Oman',
  israel: 'Israel', 'tel aviv': 'Israel',
  lebanon: 'Lebanon', beirut: 'Lebanon',
  jordan: 'Jordan', amman: 'Jordan',
  egypt: 'Egypt', cairo: 'Egypt',
  morocco: 'Morocco', casablanca: 'Morocco', rabat: 'Morocco',
  tunisia: 'Tunisia', tunis: 'Tunisia',
  algeria: 'Algeria',
  nigeria: 'Nigeria', lagos: 'Nigeria', abuja: 'Nigeria',
  kenya: 'Kenya', nairobi: 'Kenya',
  ghana: 'Ghana', accra: 'Ghana',
  'south africa': 'South Africa', johannesburg: 'South Africa', 'cape town': 'South Africa',
  ethiopia: 'Ethiopia', tanzania: 'Tanzania', uganda: 'Uganda', rwanda: 'Rwanda',
  senegal: 'Senegal', cameroon: 'Cameroon', angola: 'Angola',
  india: 'India', mumbai: 'India', delhi: 'India', 'new delhi': 'India',
  bangalore: 'India', bengaluru: 'India', hyderabad: 'India', chennai: 'India',
  gurgaon: 'India', gurugram: 'India', pune: 'India', kolkata: 'India',
  pakistan: 'Pakistan', karachi: 'Pakistan', lahore: 'Pakistan', islamabad: 'Pakistan',
  bangladesh: 'Bangladesh', dhaka: 'Bangladesh',
  'sri lanka': 'Sri Lanka', colombo: 'Sri Lanka',
  nepal: 'Nepal',
  china: 'China', shanghai: 'China', beijing: 'China', shenzhen: 'China',
  guangzhou: 'China',
  'hong kong': 'Hong Kong',
  taiwan: 'Taiwan', taipei: 'Taiwan',
  japan: 'Japan', tokyo: 'Japan', osaka: 'Japan',
  'south korea': 'South Korea', korea: 'South Korea', seoul: 'South Korea',
  singapore: 'Singapore',
  malaysia: 'Malaysia', 'kuala lumpur': 'Malaysia',
  thailand: 'Thailand', bangkok: 'Thailand',
  vietnam: 'Vietnam', hanoi: 'Vietnam', 'ho chi minh': 'Vietnam', saigon: 'Vietnam',
  indonesia: 'Indonesia', jakarta: 'Indonesia',
  philippines: 'Philippines', manila: 'Philippines',
  myanmar: 'Myanmar', yangon: 'Myanmar',
  cambodia: 'Cambodia', laos: 'Laos',
  australia: 'Australia', sydney: 'Australia', melbourne: 'Australia',
  'new zealand': 'New Zealand', auckland: 'New Zealand',
  canada: 'Canada', toronto: 'Canada', montreal: 'Canada', vancouver: 'Canada',
  mexico: 'Mexico', 'mexico city': 'Mexico',
  brazil: 'Brazil', 'sao paulo': 'Brazil', 'são paulo': 'Brazil', rio: 'Brazil',
  argentina: 'Argentina', 'buenos aires': 'Argentina',
  chile: 'Chile', santiago: 'Chile',
  colombia: 'Colombia', bogota: 'Colombia', bogotá: 'Colombia', medellin: 'Colombia',
  peru: 'Peru', lima: 'Peru',
  ecuador: 'Ecuador', uruguay: 'Uruguay', venezuela: 'Venezuela', panama: 'Panama',
  'costa rica': 'Costa Rica', guatemala: 'Guatemala',
  kazakhstan: 'Kazakhstan', uzbekistan: 'Uzbekistan', georgia: 'Georgia',
  armenia: 'Armenia', azerbaijan: 'Azerbaijan',
  iran: 'Iran', tehran: 'Iran', iraq: 'Iraq',
  iceland: 'Iceland', malta: 'Malta', cyprus: 'Cyprus', croatia: 'Croatia',
  serbia: 'Serbia', slovenia: 'Slovenia', estonia: 'Estonia', latvia: 'Latvia',
  lithuania: 'Lithuania',
}

// Longest aliases first so "new york" wins over "york"-style partials
const ALIAS_KEYS = Object.keys(COUNTRY_ALIASES).sort((a, b) => b.length - a.length)

/** Resolve a free-text location ("Greater London Area", "Prague, Czechia") to a country. */
export function locationToCountry(location: string | null | undefined): string | null {
  if (!location) return null
  const l = ` ${location.toLowerCase().replace(/[(),/|-]/g, ' ').replace(/\s+/g, ' ').trim()} `
  for (const alias of ALIAS_KEYS) {
    if (l.includes(` ${alias} `)) return COUNTRY_ALIASES[alias]
  }
  return null
}

// ─────────────────────────────────────────────
// Per-entry taxonomy classification
// ─────────────────────────────────────────────

function classifyText(corpus: string, cats: typeof INDUSTRIES): string[] {
  return cats
    .filter(({ keywords }) => keywords.some((kw) => corpus.includes(kw.toLowerCase())))
    .map(({ label }) => label)
}

// ─────────────────────────────────────────────
// Career steps
// ─────────────────────────────────────────────

export interface CareerStep {
  company: string
  role: string
  /** legacy keyword-derived view (primary + secondary union) */
  industries: string[]
  functions: string[]
  /** taxonomy v2: the company's own (sub-)industry */
  primaryIndustry: string | null
  /** taxonomy v2: top-level bucket of primaryIndustry */
  primaryParent: string | null
  /** sector exposure from the job's own bullets, ≤3 */
  secondaryIndustries: string[]
  primaryFunction: string | null
  secondaryFunctions: string[]
  country: string | null
  startYear: number | null
  endYear: number | null
  durationYears: number
  isInternship: boolean
}

/**
 * Ordered career steps (most recent first, matching CV order), excluding
 * INSEAD/MBA entries. Each step classified individually against the taxonomy.
 */
export function extractCareerSteps(cv: EnrichedProfile): CareerStep[] {
  const steps: CareerStep[] = []

  // Prefer the unified CV⊕LinkedIn timeline (more jobs, canonical companies)
  const entries = (cv.timeline?.length ? cv.timeline : cv.experience ?? []) as CvEntry[]
  for (const e of entries) {
    if (!e.entity || isInseadEntity(e.entity) || isJunkEntity(e.entity)) continue

    const corpus = [
      e.entity,
      e.location,
      ...(e.roles ?? []).map((r) => r.role),
      ...(e.description ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    let startYear: number | null = null
    let endYear: number | null = null
    for (const r of e.roles ?? []) {
      const { start, end } = parseYearsStr(r.years ?? r.dates)
      if (start !== null && (startYear === null || start < startYear)) startYear = start
      if (end !== null && (endYear === null || end > endYear)) endYear = end
    }
    const durationYears =
      startYear !== null && endYear !== null ? Math.max(0, endYear - startYear) : 0

    const v2 = classifyJob(e)
    const roleTitle = e.roles?.[0]?.role ?? ''
    const isInternship = /intern|trainee/i.test(roleTitle) || durationYears === 0

    steps.push({
      company: canonicalizeCompany(e.entity),
      role: roleTitle,
      industries: classifyText(corpus, INDUSTRIES),
      functions: classifyText(corpus, FUNCTIONS),
      primaryIndustry: v2.primary,
      primaryParent: v2.primary ? parentOf(v2.primary) : null,
      secondaryIndustries: v2.secondary,
      primaryFunction: v2.primaryFunction,
      secondaryFunctions: v2.secondaryFunctions,
      country: locationToCountry(e.location),
      startYear,
      endYear,
      durationYears,
      isInternship,
    })
  }

  return steps
}

// ─────────────────────────────────────────────
// Transitions
// ─────────────────────────────────────────────

export interface Transition {
  /** earlier job */
  from: CareerStep
  /** later job */
  to: CareerStep
  changedCountry: boolean
  changedIndustry: boolean
  changedFunction: boolean
  /** number of dimensions that changed (1 = single move, 3 = triple) */
  degree: number
}

/**
 * Consecutive job-pair transitions, oriented from earlier → later job.
 * Steps come in CV order (most recent first), so pair i+1 → i.
 * A dimension "changed" only when both sides are known and share nothing.
 */
export function extractTransitions(steps: CareerStep[]): Transition[] {
  const out: Transition[] = []
  for (let i = 0; i + 1 < steps.length; i++) {
    const to = steps[i]
    const from = steps[i + 1]

    const changedCountry = !!(from.country && to.country && from.country !== to.country)
    // industry change = the specific sub-industry changed
    const changedIndustry = !!(
      from.primaryIndustry && to.primaryIndustry && from.primaryIndustry !== to.primaryIndustry
    )
    const changedFunction = !!(
      from.primaryFunction && to.primaryFunction && from.primaryFunction !== to.primaryFunction
    )

    const degree = [changedCountry, changedIndustry, changedFunction].filter(Boolean).length
    out.push({ from, to, changedCountry, changedIndustry, changedFunction, degree })
  }
  return out
}

// ─────────────────────────────────────────────
// Shared counting helpers
// ─────────────────────────────────────────────

export function countMap(items: (string | null | undefined)[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const item of items) if (item) map[item] = (map[item] ?? 0) + 1
  return map
}

export function topN(obj: Record<string, number>, n: number): [string, number][] {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}
