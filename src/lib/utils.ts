import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build a set of trigrams from a string (lowercased, padded).
 */
function getTrigrams(str: string): Set<string> {
  const s = '  ' + str.toLowerCase() + '  '
  const trigrams = new Set<string>()
  for (let i = 0; i < s.length - 2; i++) {
    trigrams.add(s.slice(i, i + 3))
  }
  return trigrams
}

/**
 * Dice coefficient similarity between two strings using trigrams.
 * Returns a value between 0 and 1.
 */
function trigramSimilarity(a: string, b: string): number {
  const trigramsA = getTrigrams(a)
  const trigramsB = getTrigrams(b)
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0
  let intersection = 0
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++
  }
  return (2 * intersection) / (trigramsA.size + trigramsB.size)
}

/**
 * Fuzzy match a query against an array of candidate strings.
 * Returns up to 5 matches sorted by descending similarity score.
 */
export function fuzzyMatch(
  query: string,
  candidates: string[]
): { name: string; score: number }[] {
  const q = query.trim()
  if (!q) return []

  const scored = candidates.map((name) => ({
    name,
    score: trigramSimilarity(q, name),
  }))

  return scored
    .filter((r) => r.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

/**
 * Format an ISO date string to a human-readable form.
 * e.g. "2024-01-15T10:00:00Z" → "January 15, 2024"
 */
export function formatDate(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Get initials from a display name (up to 2 characters).
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Normalize a LinkedIn URL to ensure it starts with https://.
 */
export function normalizeLinkedIn(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return 'https://' + url
}
