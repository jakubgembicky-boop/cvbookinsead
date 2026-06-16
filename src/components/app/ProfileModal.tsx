'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Mail, Phone, ExternalLink, Pencil } from 'lucide-react'
import type { EnrichedProfile, TimelineEntry } from '@/types'
import { parseAllLanguages } from '@/lib/search'
import { Highlight } from './Highlight'
import { nationalityToFlag } from './ProfileCard'
import { PhotoAvatar } from './PhotoAvatar'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#003781] border-b border-gray-100 pb-1.5 mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function ProfileModal({
  cv,
  terms,
  onClose,
  onAddTerm,
}: {
  cv: EnrichedProfile
  terms: string[]
  onClose: () => void
  onAddTerm?: (term: string) => void
}) {
  const [aboutExpanded, setAboutExpanded] = useState(false)


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const photo = cv.photo || cv.li_photo_url
  const meta = [cv.emails?.[0], cv.nationalities?.length ? cv.nationalities.join(', ') : null].filter(Boolean).join(' · ')

  // Unified job timeline (CV ⊕ LinkedIn-only jobs), built server-side
  const timeline: TimelineEntry[] = cv.timeline?.length
    ? cv.timeline
    : (cv.experience || []).map((e) => ({ ...e, source: 'cv' as const }))

  // Unified education (CV ⊕ LinkedIn-only schools), built server-side
  const education: TimelineEntry[] = cv.educationTimeline?.length
    ? cv.educationTimeline
    : (cv.education || []).map((e) => ({ ...e, source: 'cv' as const }))

  // Languages: prefer the richer of CV vs LI, with robust multi-language parsing
  // Sort by proficiency: C2 > C1 > B2 > B1 > A2 > A1 > unknown
  const CEFR_ORDER: Record<string, number> = { C2: 6, C1: 5, B2: 4, B1: 3, A2: 2, A1: 1 }
  const cvLangs = cv.languages || []
  const liLangs = cv.li_languages || []
  const effectiveLangs = cvLangs.length >= liLangs.length ? cvLangs : liLangs
  const langDisplay = parseAllLanguages(effectiveLangs)
    .sort((a, b) => (CEFR_ORDER[b.cefr?.toUpperCase() ?? ''] ?? 0) - (CEFR_ORDER[a.cefr?.toUpperCase() ?? ''] ?? 0))
    .map((p) => p.display)
    .join(', ')

  // Profile-level industries & functions — aggregated from the per-job taxonomy
  // (company's own business + role title), NOT a whole-profile keyword sweep.
  // Primaries first (recency order), then secondaries; deduped.
  const uniq = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))]
  const industries = uniq([
    ...timeline.map((e) => e.primaryIndustry),
    ...timeline.flatMap((e) => e.secondaryIndustries ?? []),
  ])
  const functions = uniq([
    ...timeline.map((e) => e.primaryFunction),
    ...timeline.flatMap((e) => e.secondaryFunctions ?? []),
  ])

  // Skills (CV + LinkedIn) — both already canonicalised server-side, so a plain
  // dedup collapses "PowerPoint"/"MS PowerPoint" etc. into one chip.
  const _skillTags = uniq([
    ...(cv.skills || []), 
    ...(cv.li_skills || []), 
    ...Object.keys(cv.categorized_skills || {})
  ])
  const rankVal = (level: string | undefined) => level === 'strong' ? 3 : level === 'normal' ? 2 : 1
  const skillTags = _skillTags.sort((a, b) => {
    const valA = rankVal(cv.categorized_skills?.[a])
    const valB = rankVal(cv.categorized_skills?.[b])
    if (valA !== valB) return valB - valA
    return a.localeCompare(b)
  })

  const hasTagSection = industries.length > 0 || functions.length > 0 || skillTags.length > 0

  const aboutText = cv.li_about || ''
  const aboutLong = aboutText.length > 400



  const renderEntries = (entries: TimelineEntry[], withTaxonomy = false) => (
    <div className="space-y-4">
      {entries.map((e, i) =>
        !e.entity ? null : (
          <div key={i}>
            <div className="text-sm font-semibold text-gray-900">
              <Highlight text={e.entity} terms={terms} />
              {e.location && (
                <span className="font-normal text-gray-400">
                  {' '}· <Highlight text={e.location} terms={terms} />
                </span>
              )}
              {e.source === 'linkedin' && (
                <span
                  title="From LinkedIn — not on the CV"
                  className="ml-2 align-middle inline-flex items-center rounded-full bg-[#0a66c2]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#0a66c2]"
                >
                  LinkedIn
                </span>
              )}
            </div>
            {(e.roles || []).map((r, j) =>
              !r.role && !r.years ? null : (
                <div key={j} className="text-xs text-gray-600 mt-0.5">
                  {r.role && <Highlight text={r.role} terms={terms} />}
                  {r.years && <span className="text-gray-400"> · {r.years}</span>}
                </div>
              )
            )}
            {/* Per-job taxonomy: how this job was categorised (industry + function) */}
            {withTaxonomy && (e.primaryIndustry || e.primaryFunction) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {e.primaryIndustry && (
                  <span
                    title="Industry (the company's business)"
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#E4002B]/8 text-[#E4002B]"
                  >
                    {e.primaryIndustry}
                  </span>
                )}
                {e.primaryFunction && (
                  <span
                    title="Function (your role)"
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700"
                  >
                    {e.primaryFunction}
                  </span>
                )}
                {(e.secondaryFunctions ?? []).slice(0, 2).map((f, k) => (
                  <span
                    key={k}
                    title="Secondary function (from the description)"
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-50 text-violet-500"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
            {e.description && e.description.length > 0 && (
              <ul className="mt-1.5 space-y-1 list-disc list-inside marker:text-gray-300">
                {e.description.map((d, k) => (
                  <li key={k} className="text-xs text-gray-600 leading-relaxed">
                    <Highlight text={d} terms={terms} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      )}
    </div>
  )

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl my-0 sm:my-8 max-h-screen sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 p-5 bg-[#003781] text-white sm:rounded-t-2xl">
          <PhotoAvatar src={photo} name={cv.name} size={64} ring="ring-2 ring-white/30" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight">
              {cv.nationalities?.[0] && nationalityToFlag(cv.nationalities[0])} {cv.name}
            </h2>
            {meta && <p className="text-xs text-white/70 mt-1 truncate">{meta}</p>}
          </div>
          <div className="flex items-center gap-1">
            {cv.isSelf && (
              <Link
                href="/profile"
                className="inline-flex items-center gap-1 rounded-md bg-white/15 hover:bg-white/25 px-2.5 py-1.5 text-xs font-medium"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/15"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          {/* Contact */}
          {(cv.emails?.length || cv.linkedin || cv.phones?.length) && (
            <Section title="Contact">
              <div className="flex flex-wrap gap-2 text-xs">
                {(cv.emails || []).map((e, i) => (
                  <a
                    key={`${e}-${i}`}
                    href={`mailto:${e}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-gray-700 hover:bg-gray-100"
                  >
                    <Mail className="h-3.5 w-3.5 text-gray-400" /> {e}
                  </a>
                ))}
                {cv.linkedin && (
                  <a
                    href={cv.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#003781]/5 px-2.5 py-1.5 text-[#003781] hover:bg-[#003781]/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
                  </a>
                )}
                {(cv.phones || []).map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-gray-700"
                  >
                    <Phone className="h-3.5 w-3.5 text-gray-400" /> {p}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* LinkedIn live data */}
          {(cv.li_headline || cv.li_current_company || aboutText) && (
            <div className="mb-6 rounded-lg border border-green-100 bg-green-50/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-green-700 mb-2">
                🔗 LinkedIn
              </h3>
              {(cv.li_current_title || cv.li_current_company) && (
                <div className="text-sm font-semibold text-gray-800">
                  <Highlight text={cv.li_current_title} terms={terms} />
                  {cv.li_current_company && (
                    <span className="text-gray-500 font-normal">
                      {' '}@ <Highlight text={cv.li_current_company} terms={terms} />
                    </span>
                  )}
                </div>
              )}
              {cv.li_headline && cv.li_headline !== cv.li_current_title && (
                <div className="text-xs text-gray-600 mt-1">
                  <Highlight text={cv.li_headline} terms={terms} />
                </div>
              )}
              {cv.li_location && (
                <div className="text-xs text-gray-500 mt-1">
                  📍 <Highlight text={cv.li_location} terms={terms} />
                </div>
              )}
              {aboutText && (
                <div className="text-xs text-gray-600 mt-2 leading-relaxed whitespace-pre-line">
                  <Highlight
                    text={aboutLong && !aboutExpanded ? aboutText.slice(0, 400) + '…' : aboutText}
                    terms={terms}
                  />
                  {aboutLong && (
                    <button
                      onClick={() => setAboutExpanded((v) => !v)}
                      className="ml-1 text-[#003781] font-medium hover:underline"
                    >
                      {aboutExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}
              {cv.li_enriched_at && (
                <div className="text-[10px] text-gray-400 mt-2">
                  Last synced: {cv.li_enriched_at.slice(0, 10)}
                </div>
              )}
            </div>
          )}

          {/* INSEAD club leadership */}
          {cv.clubRoles?.length > 0 && (
            <Section title="INSEAD Club Leadership">
              <div className="flex flex-col gap-2">
                {cv.clubRoles.map((cr, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center rounded-full bg-[#E4002B]/10 px-2.5 py-0.5 text-xs font-semibold text-[#E4002B]">
                      {cr.club}
                    </span>
                    <span className="text-gray-600">{cr.role}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Education / Experience / Extra-curricular (each a single merged list) */}
          {education.length > 0 && <Section title="Education">{renderEntries(education)}</Section>}
          {timeline.length > 0 && (
            <Section title="Experience">{renderEntries(timeline, true)}</Section>
          )}
          {cv.extra_curricular?.length > 0 && (
            <Section title="Extra-curricular">
              {renderEntries(
                (cv.extra_curricular || []).map((e) => ({ ...e, source: 'cv' as const }))
              )}
            </Section>
          )}

          {/* Additional Information */}
          {(langDisplay || cv.nationalities?.length || cv.work_permits?.length) && (
            <Section title="Additional Information">
              <div className="space-y-1.5 text-xs text-gray-700">
                {langDisplay && (
                  <div>
                    <strong>Languages:</strong> <Highlight text={langDisplay} terms={terms} />
                  </div>
                )}
                {cv.nationalities?.length > 0 && (
                  <p>
                    <strong>Nationalities:</strong> <Highlight text={cv.nationalities.join(', ')} terms={terms} />
                  </p>
                )}
                {cv.work_permits?.length > 0 && (
                  <p>
                    <strong>Work Permits:</strong> <Highlight text={cv.work_permits.join(', ')} terms={terms} />
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* Industries / Functions / Skills */}
          {hasTagSection && (
            <Section title="Industries, Functions & Skills">
              <div className="space-y-3">
                {/* Industries — red chips */}
                {industries.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                      Industries
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {industries.map((ind, i) => (
                        <button
                          key={i}
                          onClick={() => onAddTerm?.(ind)}
                          className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors bg-[#E4002B]/10 text-[#E4002B] hover:bg-[#E4002B]/20"
                        >
                          <Highlight text={ind} terms={terms} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Functions — violet chips */}
                {functions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                      Functions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {functions.map((fn, i) => (
                        <button
                          key={i}
                          onClick={() => onAddTerm?.(fn)}
                          className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors bg-violet-100 text-violet-800 hover:bg-violet-200"
                        >
                          <Highlight text={fn} terms={terms} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills — filled bubbles with strength colors */}
                {skillTags.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Skills
                      </p>
                      {/* Legend */}
                      <div className="flex items-center gap-2 text-[9px] text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#003781]"></span> Strong</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#003781]/60"></span> Normal</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#003781]/20"></span> Beginner</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skillTags.map((s, i) => {
                        const level = cv.categorized_skills?.[s]
                        
                        let bgClass = 'bg-[#003781]/5 text-[#003781]' // Default/unknown
                        let textClass = 'text-[#003781]'
                        
                        if (level === 'strong') {
                          bgClass = 'bg-[#003781] text-white hover:bg-[#003781]/90'
                          textClass = 'text-white'
                        } else if (level === 'normal') {
                          bgClass = 'bg-[#003781]/60 text-white hover:bg-[#003781]/70'
                          textClass = 'text-white'
                        } else if (level === 'beginner') {
                          bgClass = 'bg-[#003781]/20 text-[#003781] hover:bg-[#003781]/30'
                          textClass = 'text-[#003781]'
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => onAddTerm?.(s)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${bgClass}`}
                          >
                            <span className={textClass}>
                              <Highlight text={s} terms={terms} />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
