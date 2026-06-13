import { Fragment, type ReactNode } from 'react'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Renders `text` with any occurrence of the given search `terms` wrapped in a
 * <mark>. Mirrors the original app's highlight() but produces React nodes
 * instead of raw HTML (no dangerouslySetInnerHTML).
 */
export function Highlight({
  text,
  terms,
}: {
  text: string | null | undefined
  terms: string[]
}): ReactNode {
  const value = text ?? ''
  if (!terms.length || !value) return value

  const cleaned = [...new Set(terms.filter((t) => t && t.length > 0))]
  if (!cleaned.length) return value

  // Longest first so multi-word terms win over their sub-words
  cleaned.sort((a, b) => b.length - a.length)
  // Single capturing group → String.split yields matches at odd indices
  const re = new RegExp(`(${cleaned.map(escapeRegex).join('|')})`, 'gi')

  const parts = value.split(re)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-200 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}
