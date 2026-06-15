// ============================================================================
// Taxonomy v2 — LinkedIn-Industries-style categorization with sub-industries.
//
// Big buckets (Consulting, Finance, Technology) are split into standard
// sub-industries; every sub knows its parent so stats can roll up. Per-job
// classification distinguishes PRIMARY (what the company is) from SECONDARY
// (sector exposure from the job's description bullets, ≤3).
// ============================================================================

import type { CvEntry } from '@/types'
import { INDUSTRIES, FUNCTIONS } from '@/lib/taxonomy'
import companyKb from '../../data/company_kb.json'

// ─────────────────────────────────────────────
// Industry tree
// ─────────────────────────────────────────────

export interface IndustryNode {
  label: string
  /** top-level bucket; equals label for flat industries */
  parent: string
  keywords: string[]
}

export const INDUSTRY_TREE: IndustryNode[] = [
  // Consulting
  { label: 'Strategy & Management Consulting', parent: 'Consulting', keywords: ['strategy consulting', 'management consulting', 'corporate strategy advisory', 'growth strategy'] },
  { label: 'Operations & Implementation Consulting', parent: 'Consulting', keywords: ['operations consulting', 'implementation', 'transformation program', 'pmo', 'operational excellence'] },
  { label: 'Financial & Transaction Advisory', parent: 'Consulting', keywords: ['transaction advisory', 'transaction services', 'financial advisory', 'commercial due diligence', 'restructuring advisory', 'valuation advisory', 'deal advisory'] },
  { label: 'Technology & Digital Consulting', parent: 'Consulting', keywords: ['technology consulting', 'it consulting', 'digital consulting', 'systems integration'] },
  { label: 'Economic & Public Sector Consulting', parent: 'Consulting', keywords: ['economic consulting', 'public sector consulting', 'policy advisory', 'government advisory'] },
  
  // Finance
  { label: 'Finance', parent: 'Finance', keywords: ['investment banking', 'm&a advisory', 'capital markets', 'ecm', 'dcm', 'leveraged finance', 'private equity', 'buyout', 'lbo', 'growth equity', 'venture capital', 'seed investing', 'early-stage investing', 'accelerator', 'asset management', 'wealth management', 'portfolio management', 'fund management', 'private banking', 'hedge fund', 'prop trading', 'quantitative trading', 'sales and trading', 'retail banking', 'commercial banking', 'corporate banking', 'credit analysis', 'lending', 'insurance', 'reinsurance', 'actuarial', 'underwriting', 'fintech', 'payments', 'digital banking', 'crypto', 'blockchain'] },
  
  // Technology & Telecom
  { label: 'Technology & Telecom', parent: 'Technology & Telecom', keywords: ['software', 'saas', 'enterprise software', 'cloud computing', 'marketplace', 'e-commerce platform', 'consumer app', 'social media', 'ride-hailing', 'delivery platform', 'semiconductor', 'chip', 'hardware', 'electronics manufacturing', 'cybersecurity', 'information security', 'telecom', 'telecommunications', 'mobile network', 'broadband', 'it services', 'data analytics services', 'business intelligence', 'outsourcing'] },
  
  // Flat / Consolidated Industries
  { label: 'Healthcare & Pharma', parent: 'Healthcare & Pharma', keywords: ['pharmaceutical', 'biotech', 'medtech', 'hospital', 'clinical', 'healthcare', 'life sciences'] },
  { label: 'Energy, Utilities & Sustainability', parent: 'Energy, Utilities & Sustainability', keywords: ['oil and gas', 'renewables', 'solar', 'wind energy', 'power generation', 'utilities', 'energy transition', 'lng', 'petroleum', 'sustainability', 'esg', 'climate'] },
  { label: 'Consumer Goods, Retail & Hospitality', parent: 'Consumer Goods, Retail & Hospitality', keywords: ['fmcg', 'cpg', 'consumer goods', 'retail', 'brand management', 'luxury', 'fashion', 'food and beverage', 'hotel', 'hospitality', 'tourism', 'restaurant', 'travel'] },
  { label: 'Manufacturing, Industrials & Agriculture', parent: 'Manufacturing, Industrials & Agriculture', keywords: ['manufacturing', 'industrial', 'automotive', 'aerospace', 'chemicals', 'machinery', 'construction materials', 'agriculture', 'agtech', 'farming', 'agribusiness', 'food production'] },
  { label: 'Real Estate & Infrastructure', parent: 'Real Estate & Infrastructure', keywords: ['real estate', 'property development', 'infrastructure', 'construction', 'reit'] },
  { label: 'Transportation & Logistics', parent: 'Transportation & Logistics', keywords: ['logistics', 'shipping', 'airline', 'aviation', 'freight', 'supply chain services', 'rail'] },
  { label: 'Media & Entertainment', parent: 'Media & Entertainment', keywords: ['media', 'entertainment', 'publishing', 'gaming', 'film', 'music', 'sports', 'advertising'] },
  { label: 'Public Sector, NGO & Education', parent: 'Public Sector, NGO & Education', keywords: ['government', 'ministry', 'public administration', 'regulator', 'central bank', 'municipality', 'ngo', 'non-profit', 'development finance', 'humanitarian', 'united nations', 'world bank', 'social impact', 'university', 'education', 'edtech', 'research institute', 'academia'] },
  { label: 'Professional & Legal Services', parent: 'Professional & Legal Services', keywords: ['law firm', 'legal services', 'attorneys', 'litigation', 'arbitration', 'accounting firm', 'audit services'] },
]

export const INDUSTRY_PARENTS = [...new Set(INDUSTRY_TREE.map((n) => n.parent))]
export const INDUSTRY_LABELS = INDUSTRY_TREE.map((n) => n.label)

const NODE_BY_LABEL = new Map(INDUSTRY_TREE.map((n) => [n.label, n]))

export function parentOf(label: string): string {
  return NODE_BY_LABEL.get(label)?.parent ?? label
}

// ─────────────────────────────────────────────
// Company knowledge base (data/company_kb.json)
// ─────────────────────────────────────────────

interface KbRecord {
  primary: string
  secondary?: string[]
  hq?: string
  canonicalName?: string
}

const KB = companyKb as Record<string, KbRecord>

function normCo(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(llp|llc|ltd|limited|inc|gmbh|ag|sa|plc|pte|pvt|co|corp|corporation|group|holdings?)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const KB_BY_NORM = new Map<string, KbRecord>()
for (const [name, rec] of Object.entries(KB)) {
  rec.canonicalName = name
  KB_BY_NORM.set(normCo(name), rec)
}

export function companyKbLookup(company: string): KbRecord | null {
  if (!company) return null
  const n = normCo(company)
  if (!n) return null
  const exact = KB_BY_NORM.get(n)
  if (exact) return exact
  // containment match for suffixed variants ("KPMG LLP Singapore" → "kpmg")
  for (const [key, rec] of KB_BY_NORM) {
    if (key.length >= 4 && (n.startsWith(key + ' ') || n.endsWith(' ' + key) || n.includes(' ' + key + ' '))) {
      return rec
    }
  }
  return null
}

export function canonicalizeCompany(company: string): string {
  if (!company) return ''
  const match = companyKbLookup(company)
  if (match && match.canonicalName) return match.canonicalName
  return company
}

// ─────────────────────────────────────────────
// Company-name pattern fallback (no KB entry)
// ─────────────────────────────────────────────

const NAME_PATTERNS: [RegExp, string][] = [
  [/consult|advisory|advisors/i, 'Strategy & Management Consulting'],
  [/\b(capital|partners|equity|invest(ments?)?)\b/i, 'Finance'],
  [/\bventures?\b|\bvc\b/i, 'Finance'],
  [/\bbank(ing)?\b/i, 'Finance'],
  [/asset management|wealth/i, 'Finance'],
  [/insurance|assurance|seguros/i, 'Finance'],
  [/\b(law|legal|attorneys|abogados|llp)\b/i, 'Professional & Legal Services'],
  [/universit|school|college|institute of technology|polytechnic/i, 'Public Sector, NGO & Education'],
  [/ministry|government|authority|agency|commission|municipal/i, 'Public Sector, NGO & Education'],
  [/foundation|charity|ngo|non-?profit|unicef|undp/i, 'Public Sector, NGO & Education'],
  [/hotel|resort|hospitality/i, 'Consumer Goods, Retail & Hospitality'],
  [/pharma|biotech|health|medical|hospital|clinic/i, 'Healthcare & Pharma'],
  [/energy|petroleum|oil|solar|renewab|power/i, 'Energy, Utilities & Sustainability'],
  [/logistics|shipping|airlines?|cargo|freight/i, 'Transportation & Logistics'],
  [/real estate|properties|realty/i, 'Real Estate & Infrastructure'],
  [/media|studios?|entertainment|publishing/i, 'Media & Entertainment'],
  [/telecom/i, 'Telecom'],
  [/software|tech\b|digital|labs\b|\.com|\.io|\.ai\b/i, 'Software & SaaS'],
]

// ─────────────────────────────────────────────
// Per-job classification
// ─────────────────────────────────────────────

export interface JobClassification {
  /** the company's own industry (sub-industry label) */
  primary: string | null
  /** sector exposure from the work itself, ≤3, never equals primary */
  secondary: string[]
  primaryFunction: string | null
  secondaryFunctions: string[]
}

/** Junk entities that survived repair (section headers with content). */
export function isJunkEntity(entity: string): boolean {
  return /^(leadership|additional|other|selected|professional|volunteer(ing)?|community|extra[- ]?curricular|entrepreneurship|creative)\b.*(experience|activities|engagement|highlights?|leadership)/i.test(
    entity.trim()
  )
}

function descMatches(text: string, nodes: IndustryNode[]): string[] {
  const hits: string[] = []
  for (const node of nodes) {
    if (node.keywords.some((kw) => text.includes(kw))) hits.push(node.label)
  }
  return hits
}

export function classifyJob(entry: CvEntry): JobClassification {
  const company = (entry.entity ?? '').trim()
  const roleText = (entry.roles ?? []).map((r) => r.role).join(' ').toLowerCase()
  const descText = (entry.description ?? []).join(' ').toLowerCase()
  const fullText = `${roleText} ${descText}`

  // primary: KB → name pattern → description keywords
  let primary: string | null = null
  const kb = companyKbLookup(company)
  if (kb) primary = kb.primary
  if (!primary) {
    for (const [re, label] of NAME_PATTERNS) {
      if (re.test(company)) {
        primary = label
        break
      }
    }
  }
  if (!primary) {
    const hit = descMatches(fullText, INDUSTRY_TREE)
    primary = hit[0] ?? null
  }

  // secondary: KB secondary (if echoed by the work) + description-derived
  const secondary: string[] = []
  const descHits = descMatches(descText, INDUSTRY_TREE)
  for (const s of kb?.secondary ?? []) {
    if (s !== primary && !secondary.includes(s)) secondary.push(s)
  }
  for (const s of descHits) {
    if (s !== primary && parentOf(s) !== (primary ? parentOf(primary) : '') && !secondary.includes(s)) {
      secondary.push(s)
    }
  }

  // functions: PRIMARY from the role title (the position itself), SECONDARY
  // from the description bullets (what the work touched). When several function
  // keywords hit the title, the longest/most-specific one wins — so "Talent
  // Acquisition Operations Specialist" is HR, not Operations.
  let primaryFunction: string | null = null
  let bestTitleKw = 0
  const titleHits = new Set<string>()
  const descHitFns = new Set<string>()
  for (const cat of FUNCTIONS) {
    let catBest = 0
    for (const kw of cat.keywords) {
      const k = kw.toLowerCase()
      if (roleText.includes(k)) catBest = Math.max(catBest, k.trim().length)
      if (descText.includes(k)) descHitFns.add(cat.label)
    }
    if (catBest > 0) {
      titleHits.add(cat.label)
      if (catBest > bestTitleKw) {
        bestTitleKw = catBest
        primaryFunction = cat.label
      }
    }
  }
  // a consultant with no functional title defaults to Strategy (never a stray
  // description keyword like "commercial")
  if (!primaryFunction && primary && parentOf(primary) === 'Consulting') {
    primaryFunction = 'Strategy'
  }
  const secondaryFunctions = [
    ...[...titleHits].filter((l) => l !== primaryFunction),
    ...[...descHitFns].filter((l) => l !== primaryFunction && !titleHits.has(l)),
  ]

  return {
    primary,
    secondary: secondary.slice(0, 3),
    primaryFunction,
    secondaryFunctions: secondaryFunctions.slice(0, 3),
  }
}

// ─────────────────────────────────────────────
// Skills implied by job classification
// ─────────────────────────────────────────────

export const SKILLS_BY_INDUSTRY: Record<string, string[]> = {
  Consulting: ['Consulting', 'Strategy', 'Stakeholder Management', 'Problem Solving'],
  Finance: ['Financial Analysis', 'Valuation'],
}
export const SKILLS_BY_FUNCTION: Record<string, string[]> = {
  Strategy: ['Strategy', 'Stakeholder Management'],
  'Finance & Accounting': ['Financial Analysis', 'FP&A'],
  'Corporate Development & M&A': ['M&A', 'Due Diligence', 'Valuation', 'Financial Modeling'],
  'Operations & Supply Chain': ['Operations', 'Supply Chain', 'Stakeholder Management'],
  Marketing: ['Marketing', 'Brand Management'],
  'Sales & Business Development': ['Business Development', 'Negotiation', 'Stakeholder Management'],
  'Data & Analytics': ['Data Analysis'],
  'Product Management': ['Product Management', 'Stakeholder Management'],
  'Human Resources': ['Recruitment', 'Stakeholder Management'],
  'Project Management': ['Project Management', 'Stakeholder Management'],
  'Risk Management': ['Risk Management'],
  'Legal & Compliance': ['Regulatory & Compliance'],
  Entrepreneurship: ['Entrepreneurship', 'Fundraising'],
}
export const SKILLS_BY_SUBINDUSTRY: Record<string, string[]> = {
  'Investment Banking': ['Financial Modeling', 'Valuation', 'M&A', 'DCF'],
  'Private Equity': ['Due Diligence', 'Valuation', 'Financial Modeling', 'Investment Analysis'],
  'Venture Capital': ['Investment Analysis', 'Due Diligence'],
  'Asset & Wealth Management': ['Portfolio Management', 'Investment Analysis'],
}

/** Skills implied by the person's classified jobs (industry + function). */
export function impliedSkills(timeline: { primaryParent?: string | null, primaryIndustry?: string | null, primaryFunction?: string | null }[]): string[] {
  const out = new Set<string>()
  for (const e of timeline) {
    if (e.primaryParent && SKILLS_BY_INDUSTRY[e.primaryParent])
      SKILLS_BY_INDUSTRY[e.primaryParent].forEach((s) => out.add(s))
    if (e.primaryIndustry && SKILLS_BY_SUBINDUSTRY[e.primaryIndustry])
      SKILLS_BY_SUBINDUSTRY[e.primaryIndustry].forEach((s) => out.add(s))
    if (e.primaryFunction && SKILLS_BY_FUNCTION[e.primaryFunction])
      SKILLS_BY_FUNCTION[e.primaryFunction].forEach((s) => out.add(s))
  }
  return [...out]
}

// Re-export v1 keyword classifier inputs for callers that need the legacy view
export { INDUSTRIES, FUNCTIONS }

