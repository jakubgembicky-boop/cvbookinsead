import 'server-only'
import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from './supabase/admin'
import { asProfiles } from './supabase/helpers'
import type {
  CvProfile,
  CvEntry,
  LinkedInEntry,
  Profile,
  ProfileOverrides,
  EnrichedProfile,
  TimelineEntry,
} from '@/types'
import { classifyJob, parentOf, impliedSkills } from '@/lib/taxonomy2'

function resolveDataPath(file: string): string {
  const webPath = path.join(process.cwd(), 'data', file)
  if (fs.existsSync(webPath)) return webPath
  // Fallback: sibling insead-cvbook/ where the Python pipeline writes its output
  return path.join(process.cwd(), '..', 'insead-cvbook', file)
}

let _cv: CvProfile[] | null = null
let _li: Record<string, LinkedInEntry> | null = null
let _canon: CanonMaps | null = null

interface CanonMaps {
  nationalities: Record<string, string[]>
  companies: Record<string, string>
  skills: Record<string, string>
}

/** canon.json (built by insead-cvbook/build_canon.py) — canonical countries/companies/skills. */
function loadCanon(): CanonMaps {
  if (!_canon) {
    try {
      _canon = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'canon.json'), 'utf-8')) as CanonMaps
    } catch {
      _canon = { nationalities: {}, companies: {}, skills: {} }
    }
  }
  return _canon
}

function canonCompany(name: string): string {
  return loadCanon().companies[name?.trim()] ?? name
}

function canonSkills(skills: string[]): string[] {
  const map = loadCanon().skills
  const out: string[] = []
  for (const s of skills) {
    const c = map[s?.trim()] ?? s
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}

let _derivedSkills: Record<string, string[]> | null = null

/** skills_derived.json — extracted from each person's own CV text (no invention). */
function loadDerivedSkills(): Record<string, string[]> {
  if (!_derivedSkills) {
    try {
      _derivedSkills = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data', 'skills_derived.json'), 'utf-8')
      ) as Record<string, string[]>
    } catch {
      _derivedSkills = {}
    }
  }
  return _derivedSkills
}

let _clubRoles: Record<string, { club: string; role: string }[]> | null = null

/** club_roles.json — INSEAD club leadership positions keyed by insead email. */
function loadClubRoles(): Record<string, { club: string; role: string }[]> {
  if (!_clubRoles) {
    try {
      _clubRoles = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data', 'club_roles.json'), 'utf-8')
      ) as Record<string, { club: string; role: string }[]>
    } catch {
      _clubRoles = {}
    }
  }
  return _clubRoles
}

let _categorizedSkills: Record<string, Record<string, 'strong' | 'normal' | 'beginner'>> | null = null

/**
 * Load skills_categorized.json and transform from category-based format
 * { Hard_Skills: [...], Soft_Skills: [...], Tools_Technologies: [...] }
 * into per-skill strength levels { "Python": "strong", "Leadership": "normal" }.
 */
function loadCategorizedSkills(): Record<string, Record<string, 'strong' | 'normal' | 'beginner'>> {
  if (!_categorizedSkills) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data', 'skills_categorized.json'), 'utf-8')
      ) as Record<string, Record<string, string[]> | Record<string, 'strong' | 'normal' | 'beginner'>>

      _categorizedSkills = {}
      const CATEGORY_TO_LEVEL: Record<string, 'strong' | 'normal' | 'beginner'> = {
        Hard_Skills: 'strong',
        Soft_Skills: 'normal',
        Tools_Technologies: 'beginner',
      }

      for (const [email, entry] of Object.entries(raw)) {
        const mapped: Record<string, 'strong' | 'normal' | 'beginner'> = {}
        // Check if it's the category-based format (has Hard_Skills key)
        if (entry && typeof entry === 'object' && ('Hard_Skills' in entry || 'Soft_Skills' in entry || 'Tools_Technologies' in entry)) {
          for (const [category, level] of Object.entries(CATEGORY_TO_LEVEL)) {
            const skills = (entry as Record<string, string[]>)[category] ?? []
            for (const skill of skills) {
              if (skill && typeof skill === 'string') mapped[skill] = level
            }
          }
        } else {
          // Already in the expected format (skill → level)
          Object.assign(mapped, entry)
        }
        _categorizedSkills[email] = mapped
      }
    } catch {
      _categorizedSkills = {}
    }
  }
  return _categorizedSkills
}

function canonNationalities(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw
  if (!raw) return []
  const parts = raw.split(/[;,]/).map(p => p.trim()).filter(Boolean)
  const mapped = parts.flatMap(p => loadCanon().nationalities[p] || p)
  return Array.from(new Set(mapped))
}

// ─────────────────────────────────────────────
// Unified timeline (CV ⊕ LinkedIn)
// CV wins everything; LinkedIn contributes only jobs whose company is
// completely absent from the CV (tagged source:'linkedin').
// ─────────────────────────────────────────────

function normName(s: string): string {
  return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}

function looseMatch(a: string, b: string): boolean {
  const na = normName(a)
  const nb = normName(b)
  return !!na && !!nb && (na.includes(nb) || nb.includes(na))
}

function isInseadName(s: string): boolean {
  const l = s.toLowerCase()
  return l.includes('insead') || l.trim() === 'mba' || l.trim() === 'mba candidate'
}

/** Last end-year mentioned in an entry, for ordering LI-only insertions. */
function entryEndYear(e: CvEntry): number {
  const CURRENT = new Date().getFullYear()
  let best = -1
  for (const r of e.roles ?? []) {
    const s = `${r.years ?? ''} ${r.dates ?? ''}`.toLowerCase()
    if (/present|current|now/.test(s)) return CURRENT
    for (const m of s.matchAll(/(19|20)\d{2}/g)) best = Math.max(best, parseInt(m[0]))
  }
  return best
}

/** First start-year mentioned in an entry. */
function entryStartYear(e: CvEntry): number {
  let earliest = 9999
  for (const r of e.roles ?? []) {
    const s = `${r.years ?? ''} ${r.dates ?? ''}`.toLowerCase()
    for (const m of s.matchAll(/(19|20)\d{2}/g)) earliest = Math.min(earliest, parseInt(m[0]))
  }
  return earliest === 9999 ? -1 : earliest
}

function buildTimeline(
  cvExperience: CvEntry[],
  liExperience: [string, string, string, string?][]
): TimelineEntry[] {
  const timeline: TimelineEntry[] = cvExperience.map((e) => ({ ...e, source: 'cv' as const }))

  for (const [title, companyRaw, dates, desc] of liExperience) {
    const company = canonCompany(companyRaw ?? '')
    if (!company || isInseadName(company)) continue
    const match = timeline.find((t) => looseMatch(t.entity, company))
    if (match) {
      match.liConfirmed = true
      continue
    }
    timeline.push({
      entity: company,
      location: '',
      roles: [{ role: title ?? '', years: dates ?? '' }],
      description: desc ? [desc] : [],
      source: 'linkedin',
    })
  }

  // Most recent first; sort by end year descending, then start year descending
  const ordered = timeline
    .map((e, i) => ({ e, i, end: entryEndYear(e), start: entryStartYear(e) }))
    .sort((a, b) => {
      if (b.end !== a.end) return b.end - a.end
      if (b.start !== a.start) return b.start - a.start
      return a.i - b.i
    })
    .map((x) => x.e)

  // Attach per-job taxonomy (primary = company's business; secondary = bullets)
  for (const e of ordered) {
    if (!e.entity || isInseadName(e.entity)) continue
    const c = classifyJob(e)
    e.primaryIndustry = c.primary
    e.primaryParent = c.primary ? parentOf(c.primary) : null
    e.secondaryIndustries = c.secondary
    e.primaryFunction = c.primaryFunction
    e.secondaryFunctions = c.secondaryFunctions
  }
  return ordered
}


/**
 * Unified education: CV schools win; LinkedIn contributes only schools whose
 * name is completely absent from the CV (tagged source:'linkedin'). Mirrors
 * buildTimeline so the modal shows ONE education list, not two.
 */
function buildEducation(
  cvEducation: CvEntry[],
  liEducation: [string, string, string?][]
): TimelineEntry[] {
  const out: TimelineEntry[] = cvEducation
    .filter((e) => e.entity)
    .map((e) => ({ ...e, source: 'cv' as const }))

  for (const [school, degree, dates] of liEducation) {
    const name = (school ?? '').trim()
    if (!name) continue
    const match = out.find((t) => looseMatch(t.entity, name))
    if (match) {
      match.liConfirmed = true
      continue
    }
    out.push({
      entity: name,
      location: '',
      roles: degree || dates ? [{ role: degree ?? '', years: dates ?? '' }] : [],
      description: [],
      source: 'linkedin',
    })
  }
  return out
}

/** Same per-profile key as the Python tooling: insead email → first email → name:<Name>. */
function fixKey(cv: CvProfile): string {
  const insead = cv.emails?.find((e) => e.toLowerCase().includes('@insead.edu'))
  if (insead) return insead.toLowerCase()
  const first = (cv.emails?.[0] ?? '').toLowerCase()
  return first || `name:${cv.name ?? ''}`
}

/** Overlay cv_fixes.json (generated by insead-cvbook/repair_cvs.py) onto raw CV data. */
function applyCvFixes(cvs: CvProfile[]): CvProfile[] {
  let fixes: Record<string, Partial<CvProfile>> = {}
  try {
    fixes = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'cv_fixes.json'), 'utf-8'))
  } catch {
    return cvs
  }
  return cvs.map((cv) => {
    const patch = fixes[fixKey(cv)]
    return patch ? { ...cv, ...patch } : cv
  })
}

function loadCv(): CvProfile[] {
  if (!_cv) {
    try {
      _cv = applyCvFixes(
        JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'cvdata.json'), 'utf-8')) as CvProfile[]
      )
    } catch {
      _cv = []
    }
  }
  return _cv
}

function loadLi(): Record<string, LinkedInEntry> {
  if (!_li) {
    try {
      _li = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data', 'linkedin_enrichment.json'), 'utf-8')
      ) as Record<string, LinkedInEntry>
    } catch {
      _li = {}
    }
  }
  return _li
}

function usernameFromUrl(url: string | undefined | null): string | null {
  if (!url) return null
  const m = url.match(/linkedin\.com\/in\/([^/?#\s]+)/i)
  return m ? m[1].replace(/\/$/, '').toLowerCase() : null
}

function inseadEmailOf(cv: CvProfile): string {
  return (
    cv.emails?.find((e) => e.toLowerCase().includes('@insead.edu')) ??
    cv.emails?.[0] ??
    ''
  )
}

/**
 * Build the merged display record for one CV entry, overlaying LinkedIn data
 * and the matching Supabase profile (typed columns + overrides jsonb).
 */
function mergeOne(
  cv: CvProfile,
  li: LinkedInEntry | undefined,
  profile: Profile | undefined,
  currentUserId: string | null
): EnrichedProfile {
  const ov: ProfileOverrides = profile?.overrides ?? {}

  // helper: overrides win, then typed column, then base
  const pick = <T>(over: T | undefined, col: T | null | undefined, base: T): T =>
    over !== undefined && over !== null
      ? over
      : col !== undefined && col !== null
        ? col
        : base

  const inseadEmail = inseadEmailOf(cv)

  // Emails: override list, else CV list; append personal email for contact
  const baseEmails = (ov.emails ?? cv.emails ?? []).slice()
  const personal = ov.personal_email ?? profile?.personal_email ?? null
  const emails = personal && !baseEmails.includes(personal) ? [...baseEmails, personal] : baseEmails

  // Phones: override list, else single profile phone, else CV phones
  const phones =
    ov.phones ?? (profile?.phone ? [profile.phone] : cv.phones ?? [])

  const liPhoto = li?.li_photo_url ?? null
  const photo = pick<string | null>(ov.photo, profile?.photo_url, cv.photo ?? null)

  // canonical company names on experience entities (display + matching consistency)
  const canonExperience = (entries: typeof cv.experience) =>
    (entries ?? []).map((e) => ({ ...e, entity: canonCompany(e.entity ?? '') }))

  const experience = canonExperience(ov.experience ?? cv.experience ?? [])
  const liExperience = (li?.li_experience ?? []).map(
    (x) => [x[0], canonCompany(x[1] ?? ''), x[2], x[3]] as [string, string, string, string?]
  )

  const timeline = buildTimeline(experience, liExperience)

  // Skills: stated + text-derived + implied-by-job (a McKinsey consultant gets
  // Consulting/Strategy/Stakeholder Management). Overrides, if set, win outright.
  const skills = ov.skills
    ? canonSkills(ov.skills)
    : canonSkills([
        ...(cv.skills ?? []),
        ...(loadDerivedSkills()[fixKey(cv)] ?? []),
        ...impliedSkills(timeline),
      ])
      
  const catSkillsDict = loadCategorizedSkills()[fixKey(cv)]
  const categorized_skills = catSkillsDict ?? {}

  return {
    profileId: profile?.id ?? null,
    inseadEmail,
    isSelf: !!(profile && currentUserId && profile.user_id === currentUserId),

    name: pick(ov.name, profile?.display_name, cv.name),
    linkedin: pick(ov.linkedin, profile?.linkedin_url, cv.linkedin ?? ''),
    emails,
    phones,
    nationalities: pick(ov.nationalities, profile?.nationalities, canonNationalities(cv.nationality ?? '')),
    languages: pick(ov.languages, profile?.languages?.length ? profile.languages : undefined, cv.languages ?? []),
    skills,
    categorized_skills,
    work_permits: pick(ov.work_permits, profile?.work_permits, cv.work_auth ?? []),
    photo: photo || liPhoto,

    education: ov.education ?? cv.education ?? [],
    experience,
    timeline,
    educationTimeline: buildEducation(ov.education ?? cv.education ?? [], li?.li_education ?? []),
    clubRoles: loadClubRoles()[inseadEmail.toLowerCase()] ?? [],
    extra_curricular: ov.extra_curricular ?? cv.extra_curricular ?? [],

    li_headline: pick(ov.li_headline, profile?.li_headline, li?.li_headline ?? ''),
    li_location: pick(ov.li_location, profile?.li_location, li?.li_location ?? ''),
    li_about: pick(ov.li_about, profile?.li_about, li?.li_about ?? ''),
    li_photo_url: liPhoto,
    li_languages: li?.li_languages ?? [],
    li_experience: liExperience,
    li_education: li?.li_education ?? [],
    li_skills: canonSkills(li?.li_skills ?? []),
    li_certifications: li?.li_certifications ?? [],
    li_current_title: pick(ov.li_current_title, li?.li_current_title, ''),
    li_current_company: pick(ov.li_current_company, li?.li_current_company, ''),
    li_enriched_at: li?.scraped_at ?? '',
  }
}


export function getEnrichedProfiles(
  supabaseProfiles: Profile[],
  currentUserId: string | null
): EnrichedProfile[] {
  const cvs = loadCv()
  const li = loadLi()

  // Index Supabase profiles by lowercased insead_email
  const profByEmail = new Map<string, Profile>()
  for (const p of supabaseProfiles) {
    if (p.insead_email) profByEmail.set(p.insead_email.toLowerCase(), p)
  }

  return cvs
    .map((cv) => {
      const uname = usernameFromUrl(cv.linkedin)
      const liEntry = uname ? li[uname] : undefined
      const email = inseadEmailOf(cv).toLowerCase()
      const profile = email ? profByEmail.get(email) : undefined
      return mergeOne(cv, liEntry, profile, currentUserId)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The merged record for a single user (by their Supabase profile). */
export function getEnrichedForProfile(
  profile: Profile,
  currentUserId: string | null
): EnrichedProfile | null {
  const cvs = loadCv()
  const li = loadLi()
  const email = profile.insead_email.toLowerCase()
  const cv = cvs.find((c) => inseadEmailOf(c).toLowerCase() === email)
  if (!cv) {
    // No CV match — build a minimal record from the Supabase profile alone
    const empty: CvProfile = {
      name: profile.display_name, linkedin: profile.linkedin_url ?? '',
      emails: [profile.insead_email], phones: profile.phone ? [profile.phone] : [],
      education: [], experience: [], extra_curricular: [],
      languages: profile.languages ?? [], skills: [],
      nationality: profile.nationalities?.[0] ?? '', work_auth: profile.work_permits ?? [], photo: profile.photo_url, page: 0,
    }
    return mergeOne(empty, undefined, profile, currentUserId)
  }
  const uname = usernameFromUrl(cv.linkedin)
  const liEntry = uname ? li[uname] : undefined
  return mergeOne(cv, liEntry, profile, currentUserId)
}

let _cachedCohort: EnrichedProfile[] | null = null
let _cachedCohortAt = 0

/** 
 * Cached cohort profiles wrapper to prevent fetching all from Supabase on every route load.
 * Using a module-level variable to bypass Next.js 2MB unstable_cache limits.
 */
export async function getCachedEnrichedProfiles(): Promise<EnrichedProfile[]> {
  const now = Date.now()
  if (_cachedCohort && now - _cachedCohortAt < 5 * 60 * 1000) {
    return _cachedCohort
  }
  const { data } = await supabaseAdmin.from('profiles').select('*')
  _cachedCohort = getEnrichedProfiles(asProfiles(data), null)
  _cachedCohortAt = now
  return _cachedCohort
}
