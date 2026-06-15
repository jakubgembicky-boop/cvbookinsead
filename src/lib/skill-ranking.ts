import type { EnrichedProfile, CvEntry } from '@/types'
import { normalizeSkill, parseYearsStr } from '@/lib/search'

/**
 * Expected learning curve / mastery thresholds (in years).
 * We group skills by their inherent complexity/nature.
 */
const THRESHOLDS = {
  Hard_Skills: { normal: 3, strong: 6 },
  Soft_Skills: { normal: 5, strong: 8 },
  Tools_Technologies: { normal: 2, strong: 4 },
}

export type SkillProficiency = 'strong' | 'normal' | 'beginner'

export function calculateSkillProficiencies(
  profile: EnrichedProfile,
  rawSkillsCategoryEntry: Record<string, string[]> | null
): Record<string, SkillProficiency> {
  const result: Record<string, SkillProficiency> = {}

  // 1. Gather all actual skills from the profile (CV + LinkedIn)
  const baseSkills = Array.from(new Set([...(profile.skills ?? []), ...(profile.li_skills ?? [])]))
  
  if (!baseSkills.length) return result

  // 2. Identify the category of each skill from the global categorized dictionary
  const skillCategoryMap: Record<string, keyof typeof THRESHOLDS> = {}
  if (rawSkillsCategoryEntry) {
    for (const [cat, skills] of Object.entries(rawSkillsCategoryEntry)) {
      if (cat in THRESHOLDS) {
        for (const skill of skills) {
          skillCategoryMap[skill] = cat as keyof typeof THRESHOLDS
        }
      }
    }
  }

  // 3. Scan the CV timeline to calculate total years of exposure for each skill
  const skillExposureYears: Record<string, number> = {}
  
  const entries = (profile.timeline?.length ? profile.timeline : profile.experience ?? []) as CvEntry[]
  
  for (const entry of entries) {
    let startYear: number | null = null
    let endYear: number | null = null
    
    // Find the earliest start and latest end from roles
    for (const r of entry.roles ?? []) {
      const { start, end } = parseYearsStr(r.years ?? r.dates)
      if (start !== null && (startYear === null || start < startYear)) startYear = start
      if (end !== null && (endYear === null || end > endYear)) endYear = end
    }

    if (!startYear || !endYear || endYear < startYear) continue
    
    const durationYears = endYear - startYear

    // Build the corpus of text for this job
    const corpusParts = [
      entry.entity,
      entry.location,
      ...(entry.roles ?? []).map(r => r.role),
      ...(entry.description ?? [])
    ].filter(Boolean) as string[]
    
    const corpusText = corpusParts.join(' ').toLowerCase()

    // Cross-reference all user skills against this job's text
    for (const rawSkill of baseSkills) {
      const normalizedForms = normalizeSkill(rawSkill)
      
      // If the skill name (or a normalized form) appears in the job description,
      // or if it broadly applies, they get the tenure
      let matched = false
      for (const form of normalizedForms) {
        // exact word boundary match for the skill
        const regex = new RegExp(`\\b${escapeRegExp(form)}\\b`, 'i')
        if (regex.test(corpusText)) {
          matched = true
          break
        }
      }
      
      // Fallback: if the skill is not explicitly mentioned, but they have the skill overall
      // we might give them a fraction of their total experience if it matches their function.
      // But for simplicity, if it's explicitly mentioned, they get 100% of the job duration.
      // If not mentioned, they get a baseline 0.5 years (implied passive experience).
      if (matched) {
        skillExposureYears[rawSkill] = (skillExposureYears[rawSkill] ?? 0) + durationYears
      } else {
        skillExposureYears[rawSkill] = (skillExposureYears[rawSkill] ?? 0) + (durationYears * 0.2)
      }
    }
  }

  // 4. Score and Rank
  for (const skill of baseSkills) {
    const category = skillCategoryMap[skill] || 'Hard_Skills' // default to medium curve
    const threshold = THRESHOLDS[category]
    const years = skillExposureYears[skill] ?? 0

    if (years >= threshold.strong) {
      result[skill] = 'strong'
    } else if (years >= threshold.normal) {
      result[skill] = 'normal'
    } else {
      result[skill] = 'beginner'
    }
  }

  return result
}

function parseYear(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.match(/\b(19|20)\d{2}\b/)
  if (m) return parseInt(m[0], 10)
  if (s.toLowerCase().includes('present')) return 2024
  return null
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
