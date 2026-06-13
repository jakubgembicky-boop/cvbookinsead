'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, X, ChevronDown, Star } from 'lucide-react'
import { toggleContactSelection, addContactSelections } from '@/app/(app)/contacts/actions'
import type { EnrichedProfile } from '@/types'
import {
  parseQuery,
  buildSearchIndex,
  matchesAll,
  buildMatchers,
  scoreStrength,
  highlightTerms,
  type SearchField,
  type Token,
  type IndexedProfile,
  type StrengthResult,
} from '@/lib/search'
import { ProfileCard } from './ProfileCard'
import { ProfileModal } from './ProfileModal'

interface DirectoryClientProps {
  profiles: EnrichedProfile[]
  /** The current user's contact-book selections (lowercased INSEAD emails) */
  initialSelected?: string[]
}

const SCOPES: { key: SearchField; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'company', label: 'Companies & Roles' },
  { key: 'university', label: 'Schools' },
  { key: 'skill', label: 'Skills' },
  { key: 'language', label: 'Languages' },
  { key: 'location', label: 'Locations' },
  { key: 'nationality', label: 'Nationality' },
]

/** A profile paired with its computed match strength for the current query. */
interface ScoredEntry {
  entry: IndexedProfile
  strength: StrengthResult
}

// ─── Partial match helpers ─────────────────────────────────────────────────

interface PartialGroup {
  /** Sorted matched-token indices joined as string, e.g. "0,2" */
  key: string
  /** Human-readable label, e.g. "supply chain + France" */
  label: string
  scored: ScoredEntry[]
  /** 1 = N-1 tokens matched, 2 = N-2 tokens matched */
  layer: 1 | 2
}

function buildPartialGroups(rest: ScoredEntry[], tokens: Token[]): PartialGroup[] {
  const N = tokens.length
  if (N < 2) return []

  const map = new Map<string, PartialGroup>()

  for (const sc of rest) {
    const matched = sc.strength.matched
    const count = matched.length
    if (count === 0) continue

    const isLayer1 = count === N - 1
    const isLayer2 = N >= 3 && count === N - 2
    if (!isLayer1 && !isLayer2) continue

    const key = matched.join(',')
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: matched.map((i) => tokens[i].display).join(' + '),
        scored: [],
        layer: isLayer1 ? 1 : 2,
      })
    }
    map.get(key)!.scored.push(sc)
  }

  // Strongest profile first within each group
  for (const g of map.values()) g.scored.sort((a, b) => b.strength.score - a.strength.score)

  // Layer 1 first, then by group size descending
  return Array.from(map.values()).sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer
    return b.scored.length - a.scored.length
  })
}

// ─── Collapsible partial-match section ────────────────────────────────────

function PartialSection({
  group,
  tokens,
  terms,
  setSelected,
  selectedEmails,
  toggleSelect,
}: {
  group: PartialGroup
  tokens: Token[]
  terms: string[]
  setSelected: (cv: EnrichedProfile) => void
  selectedEmails: Set<string>
  toggleSelect: (cv: EnrichedProfile) => void
}) {
  const [open, setOpen] = useState(false)
  const N = tokens.length
  const matchCount = group.layer === 1 ? N - 1 : N - 2

  return (
    <div className="border-t border-gray-100 pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left group"
      >
        <ChevronDown
          className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
          {group.label}
        </span>
        <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {group.scored.length} {group.scored.length === 1 ? 'person' : 'people'}
        </span>
        <span className="ml-auto text-[10px] text-gray-400">
          {matchCount}/{N} criteria
        </span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {group.scored.map((sc, i) => (
            <ProfileCard
              key={`${sc.entry.cv.profileId || sc.entry.cv.inseadEmail || sc.entry.cv.name || 'cv'}-partial-${i}`}
              cv={sc.entry.cv}
              terms={terms}
              strength={sc.strength.tier}
              onClick={() => setSelected(sc.entry.cv)}
              isSelected={selectedEmails.has(sc.entry.cv.inseadEmail.toLowerCase())}
              onToggleSelect={() => toggleSelect(sc.entry.cv)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function DirectoryClient({ profiles, initialSelected = [] }: DirectoryClientProps) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchField>('all')
  const [selected, setSelected] = useState<EnrichedProfile | null>(null)

  // Contact-book selections — optimistic Set of lowercased INSEAD emails
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(
    () => new Set(initialSelected.map((e) => e.toLowerCase()))
  )
  const [bulkAdding, setBulkAdding] = useState(false)

  const toggleSelect = useCallback((cv: EnrichedProfile) => {
    const email = cv.inseadEmail.toLowerCase()
    if (!email) return
    setSelectedEmails((prev) => {
      const next = new Set(prev)
      const nowSelected = !next.has(email)
      if (nowSelected) next.add(email)
      else next.delete(email)
      toggleContactSelection(email, nowSelected).then((res) => {
        if (!res.ok) {
          // Revert on failure
          setSelectedEmails((p) => {
            const reverted = new Set(p)
            if (nowSelected) reverted.delete(email)
            else reverted.add(email)
            return reverted
          })
        }
      })
      return next
    })
  }, [])

  // Pre-build the search index once per profile set
  const indexed = useMemo(
    () => profiles.map((cv) => ({ cv, idx: buildSearchIndex(cv) })),
    [profiles]
  )

  const tokens = useMemo(() => parseQuery(query), [query])
  const terms = useMemo(() => highlightTerms(tokens), [tokens])
  const matchers = useMemo(() => buildMatchers(tokens), [tokens])

  // Full vs partial matches, each scored for strength and ordered strongest-first
  const { full, rest } = useMemo(() => {
    const full: ScoredEntry[] = []
    const rest: ScoredEntry[] = []
    if (tokens.length === 0) return { full, rest }
    for (const entry of indexed) {
      const strength = scoreStrength(entry, matchers)
      const allMatch = matchesAll(entry, tokens, scope)
      // For multi-token queries require at least "good" tier — weak means one
      // token is only incidentally present (old taxonomy tag, brief mention) so
      // surface it in partial sections rather than inflating the full count.
      const meetsBar = tokens.length <= 1 || strength.tier !== 'weak'
      if (allMatch && meetsBar) full.push({ entry, strength })
      else if (strength.matched.length > 0) rest.push({ entry, strength })
    }
    full.sort((a, b) => b.strength.score - a.strength.score)
    rest.sort((a, b) => b.strength.score - a.strength.score)
    return { full, rest }
  }, [indexed, tokens, scope, matchers])

  // Top 3 pinned. Prefer full matches; if none, surface the closest partials.
  const pinned = useMemo(() => (full.length > 0 ? full : rest).slice(0, 3), [full, rest])
  const pinnedFromFull = full.length > 0
  const pinnedSet = useMemo(() => new Set(pinned.map((s) => s.entry)), [pinned])

  // Full-match grid excludes the pinned top matches to avoid duplication
  const gridFull = useMemo(
    () => full.filter((s) => !pinnedSet.has(s.entry)),
    [full, pinnedSet]
  )

  // Partial sections — exclude anything already pinned
  const partialGroups = useMemo(() => {
    if (tokens.length < 2) return []
    const pool = rest.filter((s) => !pinnedSet.has(s.entry))
    return buildPartialGroups(pool, tokens)
  }, [rest, tokens, pinnedSet])

  const partialTotal = useMemo(
    () => partialGroups.reduce((s, g) => s + g.scored.length, 0),
    [partialGroups]
  )

  // Add a term to the search bar (clicking a tag/company in a card or modal)
  function addTerm(term: string) {
    const t = term.trim()
    if (!t) return
    setQuery((q) => {
      const has = parseQuery(q).some((tok) => tok.value === t.toLowerCase())
      if (has) return q
      return q ? `${q} ${t}` : t
    })
  }

  // Remove a token chip by rebuilding the query without it
  function removeToken(idx: number) {
    const remaining = tokens.filter((_, i) => i !== idx)
    setQuery(
      remaining
        .map((tok) =>
          tok.type === 'phrase' || tok.type === 'multiword'
            ? `"${tok.value}"`
            : tok.value
        )
        .join(' ')
    )
  }

  const hasQuery = tokens.length > 0

  // Add every currently shown full/pinned match to the contact book
  async function addAllShown() {
    const shown = hasQuery ? [...pinned, ...gridFull].map((s) => s.entry.cv) : profiles
    const emails = shown.map((cv) => cv.inseadEmail.toLowerCase()).filter(Boolean)
    if (emails.length === 0) return
    setBulkAdding(true)
    const res = await addContactSelections(emails)
    if (res.ok) {
      setSelectedEmails((prev) => new Set([...prev, ...emails]))
    }
    setBulkAdding(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          autoComplete="off"
          placeholder='Try "supply chain Czechia", "private equity France", or "speaks Arabic"…'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-12 rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003781] focus:border-transparent shadow-sm"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#E4002B]"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Token chips */}
      {tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tokens.map((tok, i) => (
            <span
              key={`${tok.type}-${tok.value}-${i}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                tok.type === 'geo'
                  ? 'bg-[#E4002B]/10 text-[#E4002B]'
                  : tok.type === 'multiword'
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-[#003781]/10 text-[#003781]'
              }`}
            >
              {tok.type === 'geo' && <span aria-hidden>📍</span>}
              {tok.type === 'multiword' && <span aria-hidden>🔗</span>}
              {tok.display}
              <button
                onClick={() => removeToken(i)}
                className="hover:opacity-70"
                aria-label={`Remove ${tok.display}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Field scope selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-gray-400 mr-1">Search in:</span>
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              scope === s.key
                ? 'bg-[#003781] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-[#003781]/40 hover:text-[#003781]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Legends row */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400">
          <span className="font-medium">Language proficiency:</span>
          <span className="inline-flex items-center gap-1">
            <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 font-medium">English</span>
            C1 / C2 — fluent / native
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">French</span>
            B1 / B2 — working / good
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="rounded-full bg-gray-100 text-gray-400 px-2 py-0.5 font-medium">Arabic</span>
            A1 / A2 — basic
          </span>
        </div>
        {hasQuery && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400">
            <span className="font-medium">Match strength:</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-green-600 font-bold tracking-tight">●●●</span> strong — core role / field
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-amber-500 font-bold tracking-tight">●●○</span> good — solid mention
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-gray-400 font-bold tracking-tight">●○○</span> weak — incidental / related
            </span>
          </div>
        )}
      </div>

      {/* Results count + bulk select */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {!hasQuery
            ? `${profiles.length} members`
            : full.length === 0
              ? `No exact matches`
              : `${full.length} of ${profiles.length} — full match`}
          {hasQuery && partialTotal > 0 && (
            <span className="text-gray-400"> · {partialTotal} partial</span>
          )}
        </p>
        {hasQuery && full.length > 0 && (
          <button
            onClick={addAllShown}
            disabled={bulkAdding}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:border-amber-300 hover:text-amber-600 transition-colors disabled:opacity-50"
          >
            <Star className="h-3 w-3" />
            {bulkAdding ? 'Adding…' : 'Add all shown to contacts'}
          </button>
        )}
      </div>

      {/* No-query: full directory */}
      {!hasQuery ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {indexed.map((entry, i) => (
            <ProfileCard
              key={`${entry.cv.profileId || entry.cv.inseadEmail || entry.cv.name || 'cv'}-${i}`}
              cv={entry.cv}
              terms={terms}
              onClick={() => setSelected(entry.cv)}
              isSelected={selectedEmails.has(entry.cv.inseadEmail.toLowerCase())}
              onToggleSelect={() => toggleSelect(entry.cv)}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Pinned top matches */}
          {pinned.length > 0 && (
            <div className="rounded-xl border border-[#003781]/15 bg-[#003781]/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#003781]">
                  {pinnedFromFull ? 'Top matches' : 'Closest matches'}
                </span>
                <span className="text-[10px] text-gray-400">
                  best {pinned.length} for “{tokens.map((t) => t.display).join(' ')}”
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {pinned.map((sc, i) => (
                  <ProfileCard
                    key={`pin-${sc.entry.cv.profileId || sc.entry.cv.name || i}`}
                    cv={sc.entry.cv}
                    terms={terms}
                    strength={sc.strength.tier}
                    onClick={() => setSelected(sc.entry.cv)}
                    isSelected={selectedEmails.has(sc.entry.cv.inseadEmail.toLowerCase())}
                    onToggleSelect={() => toggleSelect(sc.entry.cv)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Remaining full-match grid */}
          {gridFull.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {gridFull.map((sc, i) => (
                <ProfileCard
                  key={`${sc.entry.cv.profileId || sc.entry.cv.inseadEmail || sc.entry.cv.name || 'cv'}-${i}`}
                  cv={sc.entry.cv}
                  terms={terms}
                  strength={sc.strength.tier}
                  onClick={() => setSelected(sc.entry.cv)}
                  isSelected={selectedEmails.has(sc.entry.cv.inseadEmail.toLowerCase())}
                  onToggleSelect={() => toggleSelect(sc.entry.cv)}
                />
              ))}
            </div>
          ) : full.length === 0 && partialGroups.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-gray-400 text-sm">No matches.</p>
              <button
                onClick={() => setQuery('')}
                className="mt-2 text-sm text-[#003781] hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : null}
        </>
      )}

      {/* Partial match sections */}
      {hasQuery && partialGroups.length > 0 && (
        <div className="flex flex-col gap-4 mt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Partial matches
          </p>
          {partialGroups.map((group) => (
            <PartialSection
              key={group.key}
              group={group}
              tokens={tokens}
              terms={terms}
              setSelected={setSelected}
              selectedEmails={selectedEmails}
              toggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <ProfileModal
          cv={selected}
          terms={terms}
          onClose={() => setSelected(null)}
          onAddTerm={addTerm}
        />
      )}
    </div>
  )
}
