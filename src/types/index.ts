// ─────────────────────────────────────────────
// CV (from cvdata.json)
// ─────────────────────────────────────────────
export interface CvRole {
  role: string
  years?: string
  dates?: string
}

export interface CvEntry {
  entity: string
  location: string
  roles: CvRole[]
  description?: string[]
}

export interface CvProfile {
  name: string
  linkedin: string
  emails: string[]
  phones: string[]
  education: CvEntry[]
  experience: CvEntry[]
  extra_curricular?: CvEntry[]
  languages: string[]
  skills: string[]
  nationality: string
  work_auth?: string[]
  photo?: string | null
  page: number
}

// Back-compat aliases
export type Education = CvEntry
export type Experience = CvEntry

/**
 * One job in the unified CV ⊕ LinkedIn timeline. CV wins everything; LinkedIn
 * only contributes jobs whose company is completely absent from the CV.
 */
export interface TimelineEntry extends CvEntry {
  source: 'cv' | 'linkedin'
  /** CV entry also confirmed by a matching LinkedIn position */
  liConfirmed?: boolean
  // ── taxonomy v2 (attached for experience entries; absent for education) ──
  /** the company's own (sub-)industry */
  primaryIndustry?: string | null
  /** top-level bucket of primaryIndustry */
  primaryParent?: string | null
  /** sector exposure from the job's own bullets, ≤3 */
  secondaryIndustries?: string[]
  /** function tied to the role/title */
  primaryFunction?: string | null
  /** functions implied by the description bullets, ≤3 */
  secondaryFunctions?: string[]
}

// ─────────────────────────────────────────────
// LinkedIn enrichment (from linkedin_enrichment.json)
// ─────────────────────────────────────────────
export interface LinkedInEntry {
  url: string
  scraped_at: string
  li_name: string
  li_headline: string | null
  li_about: string | null
  li_location: string | null
  li_photo_url: string | null
  li_languages: string[]
  li_experience: [string, string, string, string?][]
  li_education?: [string, string, string?][]
  li_skills?: string[]
  li_certifications?: string[]
  li_current_title?: string | null
  li_current_company?: string | null
}

// ─────────────────────────────────────────────
// Supabase profiles row
// ─────────────────────────────────────────────
export interface Profile {
  id: string
  user_id: string
  insead_email: string
  first_name: string
  last_name: string
  display_name: string
  phone: string | null
  personal_email: string | null
  linkedin_url: string | null
  photo_url: string | null
  li_headline: string | null
  li_location: string | null
  li_about: string | null
  languages: string[]
  nationalities: string[]
  work_permits: string[]
  profile_completed_at: string | null
  onboarding_step: number
  overrides?: ProfileOverrides
  created_at: string
  updated_at: string
}

// Any field a user may override on their own profile
export interface ProfileOverrides {
  name?: string
  nationalities?: string[]
  work_permits?: string[]
  languages?: string[]
  skills?: string[]
  phones?: string[]
  emails?: string[]
  personal_email?: string
  linkedin?: string
  photo?: string | null
  li_headline?: string
  li_about?: string
  li_location?: string
  li_current_title?: string
  li_current_company?: string
  experience?: CvEntry[]
  education?: CvEntry[]
  extra_curricular?: CvEntry[]
  [key: string]: unknown
}

/** A leadership position held in an INSEAD student club. */
export interface ClubRole {
  club: string
  role: string
}

// ─────────────────────────────────────────────
// Merged display record (CV ⊕ LinkedIn ⊕ user overrides)
// This is the shape the directory, search engine, and modal operate on.
// ─────────────────────────────────────────────
export interface EnrichedProfile {
  // linkage / meta
  profileId: string | null
  inseadEmail: string
  isSelf: boolean

  // identity
  name: string
  linkedin: string
  emails: string[]
  phones: string[]
  nationalities: string[]
  languages: string[]
  skills: string[]
  categorized_skills?: Record<string, 'strong' | 'normal' | 'beginner'>
  work_permits: string[]
  photo: string | null

  // structured CV
  education: CvEntry[]
  experience: CvEntry[]
  extra_curricular: CvEntry[]
  /** Unified job history: CV entries (canonical companies) + LinkedIn-only jobs */
  timeline: TimelineEntry[]
  /** Unified education: CV schools + LinkedIn-only schools (deduped) */
  educationTimeline: TimelineEntry[]
  /** INSEAD club leadership positions (from the Junior Leadership Teams list) */
  clubRoles: ClubRole[]

  // LinkedIn
  li_headline: string
  li_location: string
  li_about: string
  li_photo_url: string | null
  li_languages: string[]
  li_experience: [string, string, string, string?][]
  li_education: [string, string, string?][]
  li_skills: string[]
  li_certifications: string[]
  li_current_title: string
  li_current_company: string
  li_enriched_at: string
}
