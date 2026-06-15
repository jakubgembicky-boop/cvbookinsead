'use client'

import { Star, Award } from 'lucide-react'
import type { EnrichedProfile } from '@/types'
import { parseAllLanguages, type StrengthTier } from '@/lib/search'
import { Highlight } from './Highlight'
import { PhotoAvatar } from './PhotoAvatar'

// Match-strength badge shown on cards during a search.
const STRENGTH_CFG: Record<StrengthTier, { dots: string; cls: string; label: string }> = {
  strong: { dots: '●●●', cls: 'bg-green-50 text-green-700 ring-green-200', label: 'Strong match' },
  good: { dots: '●●○', cls: 'bg-amber-50 text-amber-600 ring-amber-200', label: 'Good match' },
  weak: { dots: '●○○', cls: 'bg-gray-100 text-gray-400 ring-gray-200', label: 'Weak match' },
}

function StrengthBadge({ tier }: { tier: StrengthTier }) {
  const c = STRENGTH_CFG[tier]
  return (
    <span
      title={c.label}
      className={`absolute top-2 right-2 z-10 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none tracking-tight ring-1 ${c.cls}`}
    >
      {c.dots}
    </span>
  )
}

export function nationalityToFlag(nationality: string | null): string {
  if (!nationality) return ''
  const flagMap: Record<string, string> = {
    french: '🇫🇷', france: '🇫🇷', german: '🇩🇪', germany: '🇩🇪',
    british: '🇬🇧', 'united kingdom': '🇬🇧', uk: '🇬🇧',
    american: '🇺🇸', 'united states': '🇺🇸', usa: '🇺🇸',
    indian: '🇮🇳', india: '🇮🇳', chinese: '🇨🇳', china: '🇨🇳',
    singaporean: '🇸🇬', singapore: '🇸🇬', australian: '🇦🇺', australia: '🇦🇺',
    canadian: '🇨🇦', canada: '🇨🇦', swedish: '🇸🇪', sweden: '🇸🇪',
    norwegian: '🇳🇴', norway: '🇳🇴', danish: '🇩🇰', denmark: '🇩🇰',
    dutch: '🇳🇱', netherlands: '🇳🇱', swiss: '🇨🇭', switzerland: '🇨🇭',
    italian: '🇮🇹', italy: '🇮🇹', spanish: '🇪🇸', spain: '🇪🇸',
    portuguese: '🇵🇹', portugal: '🇵🇹', greek: '🇬🇷', greece: '🇬🇷',
    polish: '🇵🇱', poland: '🇵🇱', russian: '🇷🇺', russia: '🇷🇺',
    turkish: '🇹🇷', turkey: '🇹🇷', japanese: '🇯🇵', japan: '🇯🇵',
    korean: '🇰🇷', korea: '🇰🇷', thai: '🇹🇭', thailand: '🇹🇭',
    indonesian: '🇮🇩', indonesia: '🇮🇩', malaysian: '🇲🇾', malaysia: '🇲🇾',
    vietnamese: '🇻🇳', vietnam: '🇻🇳', philippine: '🇵🇭', philippines: '🇵🇭',
    mexican: '🇲🇽', mexico: '🇲🇽', brazilian: '🇧🇷', brazil: '🇧🇷',
    argentinian: '🇦🇷', argentina: '🇦🇷', nigerian: '🇳🇬', nigeria: '🇳🇬',
    'south african': '🇿🇦', 'south africa': '🇿🇦', kenyan: '🇰🇪', kenya: '🇰🇪',
    egyptian: '🇪🇬', egypt: '🇪🇬', emirati: '🇦🇪', uae: '🇦🇪',
    saudi: '🇸🇦', 'saudi arabia': '🇸🇦', lebanese: '🇱🇧', lebanon: '🇱🇧',
    israeli: '🇮🇱', israel: '🇮🇱', iranian: '🇮🇷', iran: '🇮🇷',
    pakistani: '🇵🇰', pakistan: '🇵🇰', bangladeshi: '🇧🇩', bangladesh: '🇧🇩',
    'sri lankan': '🇱🇰', 'sri lanka': '🇱🇰', austrian: '🇦🇹', austria: '🇦🇹',
    belgian: '🇧🇪', belgium: '🇧🇪', finnish: '🇫🇮', finland: '🇫🇮',
    hungarian: '🇭🇺', hungary: '🇭🇺', czech: '🇨🇿', slovak: '🇸🇰', slovakia: '🇸🇰',
    romanian: '🇷🇴', romania: '🇷🇴', ukrainian: '🇺🇦', ukraine: '🇺🇦',
    colombian: '🇨🇴', colombia: '🇨🇴', chilean: '🇨🇱', chile: '🇨🇱',
    peruvian: '🇵🇪', peru: '🇵🇪', moroccan: '🇲🇦', morocco: '🇲🇦',
    irish: '🇮🇪', ireland: '🇮🇪', 'new zealand': '🇳🇿',
  }
  const lower = nationality.toLowerCase()
  for (const [key, flag] of Object.entries(flagMap)) {
    if (lower.includes(key)) return flag
  }
  return '🌍'
}

// Return true if a company name looks like INSEAD (student / MBA entry)
function isInsead(name: string): boolean {
  const l = name.toLowerCase().trim()
  return l.includes('insead') || l === 'mba' || l === 'mba candidate'
}

// Strip parenthetical notes like "(Golden Visa holder)", "(Citizenship)"
// and take only the first nationality when multiple are listed.
export function cleanNationality(raw: string | null | undefined): string {
  if (!raw) return ''
  const first = raw.split(/[,/]/)[0].trim()
  return first.replace(/\s*\([^)]*\)/g, '').trim()
}

// Show the most recent non-INSEAD role so the card shows their actual job,
// not "MBA Candidate · INSEAD" (which describes everyone in the cohort).
function preInseadRole(cv: EnrichedProfile): { company: string; role: string } {
  // LI current company — use unless it's INSEAD itself
  if (cv.li_current_company && !isInsead(cv.li_current_company)) {
    return { company: cv.li_current_company, role: cv.li_current_title || '' }
  }

  // CV experience — first entry that isn't INSEAD
  const cvNonInsead = (cv.experience ?? []).find(
    (e) => e.entity && !isInsead(e.entity)
  )
  if (cvNonInsead) {
    return {
      company: cvNonInsead.entity || '',
      role: cvNonInsead.roles?.[0]?.role || '',
    }
  }

  // LI experience — first non-INSEAD entry (format: [role, company, dates])
  const liNonInsead = (cv.li_experience ?? []).find(
    (e) => e[1] && !isInsead(e[1])
  )
  if (liNonInsead) {
    return { company: liNonInsead[1] || '', role: liNonInsead[0] || '' }
  }

  // Last resort: LinkedIn headline
  return { company: cv.li_headline || '', role: '' }
}

// CEFR-based language chip color
export function langChipClass(cefr: string | null): string {
  if (!cefr) return 'bg-gray-100 text-gray-500'
  const level = cefr.toUpperCase()
  if (level === 'C1' || level === 'C2') return 'bg-green-100 text-green-700'
  if (level === 'B1' || level === 'B2') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-400'
}

export function ProfileCard({
  cv,
  terms,
  strength,
  activeClubs,
  onClick,
  isSelected,
  onToggleSelect,
}: {
  cv: EnrichedProfile
  terms: string[]
  strength?: StrengthTier
  /** Canonical club names in the active query — shows this person's position. */
  activeClubs?: string[]
  onClick: () => void
  /** Contact-book star state; star hidden when onToggleSelect is undefined */
  isSelected?: boolean
  onToggleSelect?: () => void
}) {
  const photo = cv.photo || cv.li_photo_url
  const { company, role } = preInseadRole(cv)

  // When searching for a specific club, surface this person's position in it.
  const clubMatches =
    activeClubs?.length && cv.clubRoles?.length
      ? cv.clubRoles.filter((cr) =>
          activeClubs.some((c) => c.toLowerCase() === cr.club.toLowerCase())
        )
      : []

  // Top 3 languages with CEFR for colour-coding (compound entries split out)
  // Sort by proficiency: C2 > C1 > B2 > B1 > A2 > A1 > unknown
  const CEFR_ORDER: Record<string, number> = { C2: 6, C1: 5, B2: 4, B1: 3, A2: 2, A1: 1 }
  const rawLangs = cv.languages?.length ? cv.languages : cv.li_languages
  const langs = parseAllLanguages(rawLangs)
    .sort((a, b) => (CEFR_ORDER[a.cefr?.toUpperCase() ?? ''] ?? 0) - (CEFR_ORDER[b.cefr?.toUpperCase() ?? ''] ?? 0))
    .reverse()
    .slice(0, 3)

  return (
    // div+role rather than <button> so the star can be a real nested button
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="group relative flex flex-col items-center text-center rounded-xl border border-gray-100 bg-white p-4 shadow-sm cursor-pointer hover:shadow-md hover:border-[#003781]/30 transition-all focus:outline-none focus:ring-2 focus:ring-[#003781]"
    >
      {strength && <StrengthBadge tier={strength} />}
      {onToggleSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          title={isSelected ? 'Remove from my contact book' : 'Add to my contact book'}
          aria-label={isSelected ? 'Remove from my contact book' : 'Add to my contact book'}
          className={`absolute top-2 left-2 z-10 rounded-full p-1 transition-colors ${
            isSelected
              ? 'text-amber-400 hover:text-amber-500'
              : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'
          }`}
        >
          <Star className="h-4 w-4" fill={isSelected ? 'currentColor' : 'none'} />
        </button>
      )}
      <PhotoAvatar src={photo} name={cv.name} size={72} />

      <div className="mt-3 text-sm font-semibold text-gray-900 leading-tight">
        <Highlight text={cv.name} terms={terms} />
      </div>

      {(company || role) && (
        <div className="mt-1 text-xs text-gray-500 leading-snug line-clamp-2">
          {role && <Highlight text={role} terms={terms} />}
          {role && company && <span className="text-gray-300"> · </span>}
          {company && (
            <span className="text-gray-700 font-medium">
              <Highlight text={company} terms={terms} />
            </span>
          )}
        </div>
      )}

      {clubMatches.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {clubMatches.map((cr, i) => (
            <span
              key={i}
              title={`${cr.club} — ${cr.role}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#E4002B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#E4002B]"
            >
              <Award className="h-2.5 w-2.5" aria-hidden />
              {cr.role}
            </span>
          ))}
        </div>
      )}

      {langs.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {langs.map((parsed, i) => (
            <span
              key={i}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${langChipClass(parsed.cefr)}`}
            >
              <Highlight text={parsed.lang} terms={terms} />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
