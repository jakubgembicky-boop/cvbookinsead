// ============================================================================
// Search engine — ported faithfully from the original build_app.py vanilla-JS
// implementation. Provides query parsing (phrases, geo-groups, terms), synonym
// expansion, stemming, a per-profile search index, and multi-token AND matching
// with geo co-location logic.
// ============================================================================

import type { EnrichedProfile, CvEntry } from '@/types'
import { MULTIWORD_TERMS, classifyProfile, INDUSTRIES, FUNCTIONS } from '@/lib/taxonomy'

// ─────────────────────────────────────────────
// Language level → CEFR
// ─────────────────────────────────────────────
const LEVEL_MAP: Record<string, string> = {
  native: 'C2', 'mother tongue': 'C2', bilingual: 'C2', 'first language': 'C2',
  fluent: 'C1', proficient: 'C1', advanced: 'C1', 'full professional': 'C1',
  'upper intermediate': 'B2', 'professional working': 'B2', good: 'B2', practical: 'B2',
  business: 'B2', 'business proficiency': 'B2', 'business proficient': 'B2',
  'professional proficiency': 'B2', 'full proficiency': 'C1',
  'full professional proficiency': 'C1', 'limited working proficiency': 'B1',
  intermediate: 'B1', conversational: 'B1', working: 'B1',
  basic: 'A2', elementary: 'A2', beginner: 'A1', limited: 'A1',
}

export const NATIVE_LANG_NATIONALITY: Record<string, string> = {
  german: 'Germany', french: 'France', italian: 'Italy',
  spanish: 'Spain', catalan: 'Spain',
  dutch: 'Netherlands', flemish: 'Belgium',
  polish: 'Poland', swedish: 'Sweden', norwegian: 'Norway',
  danish: 'Denmark', finnish: 'Finland',
  czech: 'Czech Republic', slovak: 'Slovakia', hungarian: 'Hungary',
  romanian: 'Romania', bulgarian: 'Bulgaria', serbian: 'Serbia',
  greek: 'Greece', turkish: 'Turkey', ukrainian: 'Ukraine',
  russian: 'Russia', chinese: 'China', mandarin: 'China', cantonese: 'China',
  japanese: 'Japan', korean: 'Korea', thai: 'Thailand',
  indonesian: 'Indonesia', malay: 'Malaysia',
  hebrew: 'Israel', hindi: 'India', persian: 'Iran', farsi: 'Iran',
}

export interface ParsedLang {
  lang: string
  levelRaw: string | null
  cefr: string | null
  display: string
}

export function parseLang(raw: string): ParsedLang {
  const s = raw.trim()
  let m = s.match(/^(.+?)\s+([ABC][12])$/i) || s.match(/^(.+?)\s*\(([ABC][12])\)$/i)
  if (m) {
    const lang = m[1].trim(), cefr = m[2].toUpperCase()
    return { lang, levelRaw: cefr, cefr, display: `${lang} (${cefr})` }
  }
  m = s.match(/^(.+?)\s*\(([^)]+)\)$/)
  if (m) {
    const lang = m[1].trim(), levelRaw = m[2].trim()
    const cefr = LEVEL_MAP[levelRaw.toLowerCase()] || null
    return { lang, levelRaw, cefr, display: cefr ? `${lang} (${cefr})` : `${lang} (${levelRaw})` }
  }
  m = s.match(/^(.+?)\s*[–-]\s*(.+)$/)
  if (m) {
    const lang = m[1].trim(), levelRaw = m[2].trim()
    const cefr = LEVEL_MAP[levelRaw.toLowerCase()] || null
    return { lang, levelRaw, cefr, display: cefr ? `${lang} (${cefr})` : s }
  }
  return { lang: s, levelRaw: null, cefr: null, display: s }
}

// ─────────────────────────────────────────────
// Robust multi-language parsing
//
// Real CV language fields are messy: compound strings separated by |, /, ;,
// dashes, or no delimiter at all ("German (Native) English (Proficient)"),
// plus junk prefixes ("fluent English", "Speak English"). A naive split loses
// the inner languages — e.g. only 365/413 classmates were counted as English
// speakers when the true number is 381.
//
// Instead of guessing delimiters, we ANCHOR on a dictionary of known language
// names: find every language mentioned in the raw string, then read the level
// descriptor that follows each one. This is delimiter-agnostic and robust.
// ─────────────────────────────────────────────

// Multi-word language names — matched first so their constituent single words
// (e.g. "Chinese", "Mandarin") don't double-count.
const MULTIWORD_LANGS = [
  'chinese mandarin', 'mandarin chinese', 'brazilian portuguese',
  'modern standard arabic', 'swiss german', 'bahasa indonesia', 'bahasa malaysia',
]
const MULTIWORD_LANG_CANON: Record<string, string> = {
  'chinese mandarin': 'Mandarin', 'mandarin chinese': 'Mandarin',
  'brazilian portuguese': 'Portuguese', 'modern standard arabic': 'Arabic',
}
const SINGLE_LANGS = [
  'english', 'french', 'spanish', 'german', 'arabic', 'italian', 'portuguese',
  'russian', 'mandarin', 'cantonese', 'chinese', 'hokkien', 'hindi', 'urdu',
  'punjabi', 'bengali', 'tamil', 'telugu', 'marathi', 'gujarati', 'japanese',
  'korean', 'dutch', 'flemish', 'polish', 'swedish', 'norwegian', 'danish',
  'finnish', 'icelandic', 'bosnian', 'serbian', 'croatian', 'slovenian',
  'indonesian', 'malay', 'tagalog', 'filipino', 'thai', 'vietnamese', 'khmer',
  'turkish', 'greek', 'hebrew', 'farsi', 'persian', 'catalan', 'basque',
  'galician', 'czech', 'slovak', 'hungarian', 'romanian', 'bulgarian',
  'ukrainian', 'belarusian', 'swahili', 'afrikaans', 'amharic', 'yoruba',
  'igbo', 'hausa', 'zulu', 'xhosa', 'nepali', 'sinhala', 'burmese', 'lao',
  'mongolian', 'kazakh', 'uzbek', 'azerbaijani', 'armenian', 'georgian',
  'albanian', 'macedonian', 'latvian', 'lithuanian', 'estonian', 'maltese',
  'welsh', 'irish', 'luxembourgish',
]
const ALL_LANG_NAMES = [...MULTIWORD_LANGS, ...SINGLE_LANGS]
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const titleCaseLang = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

function cefrFromSegment(seg: string): string | null {
  const cefr = seg.match(/\b([ABC][12])\b/i)
  if (cefr) return cefr[1].toUpperCase()
  const lower = seg.toLowerCase()
  const keys = Object.keys(LEVEL_MAP).sort((a, b) => b.length - a.length)
  for (const k of keys) if (new RegExp(`\\b${reEsc(k)}\\b`).test(lower)) return LEVEL_MAP[k]
  return null
}

/**
 * Parse one raw language field — which may contain several languages — into a
 * list of distinct {@link ParsedLang} records. Anchors on known language names
 * so it survives any delimiter style (|, /, ;, dash, or none).
 */
export function parseLanguages(raw: string): ParsedLang[] {
  if (!raw || !raw.trim()) return []
  const lower = raw.toLowerCase()

  // Collect every language-name occurrence
  const hits: { name: string; start: number; end: number }[] = []
  for (const name of ALL_LANG_NAMES) {
    const re = new RegExp(`\\b${reEsc(name)}\\b`, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(lower))) hits.push({ name, start: m.index, end: m.index + name.length })
  }
  if (!hits.length) {
    // No recognised language name — fall back to single-entry parse so that
    // legitimately unusual labels still surface rather than vanishing.
    const single = parseLang(raw)
    return single.lang ? [single] : []
  }

  // Earliest first; on overlap prefer the longer (multi-word) match
  hits.sort((a, b) => a.start - b.start || b.name.length - a.name.length)
  const chosen: typeof hits = []
  let lastEnd = -1
  for (const h of hits) if (h.start >= lastEnd) { chosen.push(h); lastEnd = h.end }

  const out: ParsedLang[] = []
  const seen = new Set<string>()
  for (let i = 0; i < chosen.length; i++) {
    const h = chosen[i]
    const segEnd = i + 1 < chosen.length ? chosen[i + 1].start : raw.length
    const seg = raw.slice(h.end, segEnd) // descriptor follows the language name
    const lang = MULTIWORD_LANG_CANON[h.name] || titleCaseLang(h.name)
    if (seen.has(lang)) continue
    seen.add(lang)
    const cefr = cefrFromSegment(seg)
    out.push({ lang, levelRaw: cefr, cefr, display: cefr ? `${lang} (${cefr})` : lang })
  }
  return out
}

/** Flatten a profile's raw language list into deduped parsed languages. */
export function parseAllLanguages(rawList: string[] | null | undefined): ParsedLang[] {
  const out: ParsedLang[] = []
  const seen = new Set<string>()
  for (const raw of rawList || []) {
    for (const p of parseLanguages(raw)) {
      if (seen.has(p.lang)) continue
      seen.add(p.lang)
      out.push(p)
    }
  }
  return out
}

// ─────────────────────────────────────────────
// Skill normalization
// ─────────────────────────────────────────────
const SKILL_ALIASES: Record<string, string[]> = {
  'microsoft office': ['Excel', 'PowerPoint', 'Word', 'Outlook'],
  'ms office': ['Excel', 'PowerPoint', 'Word', 'Outlook'],
  'office 365': ['Excel', 'PowerPoint', 'Word', 'Outlook'],
  'google sheets': ['Google Sheets'], 'google docs': ['Google Docs'],
  'microsoft excel': ['Excel'], 'ms excel': ['Excel'],
  'microsoft powerpoint': ['PowerPoint'], 'ms powerpoint': ['PowerPoint'],
  'microsoft word': ['Word'], vba: ['VBA'],
  python: ['Python'], 'r programming': ['R'], rstudio: ['R'],
  sql: ['SQL'], mysql: ['SQL', 'MySQL'], postgresql: ['SQL', 'PostgreSQL'],
  javascript: ['JavaScript'], typescript: ['TypeScript'],
  java: ['Java'], 'c++': ['C++'], 'c#': ['C#'],
  tableau: ['Tableau'], 'power bi': ['Power BI'], powerbi: ['Power BI'],
  stata: ['Stata'], spss: ['SPSS'], matlab: ['MATLAB'],
  'machine learning': ['Machine Learning'], 'deep learning': ['Deep Learning'],
  'data analysis': ['Data Analysis'], 'data science': ['Data Science'],
  'financial modelling': ['Financial Modelling'], 'financial modeling': ['Financial Modelling'],
  'financial modelling and valuation': ['Financial Modelling', 'Valuation'],
  bloomberg: ['Bloomberg'], 'capital iq': ['Capital IQ'], factset: ['FactSet'],
  autocad: ['AutoCAD'], solidworks: ['SolidWorks'],
  salesforce: ['Salesforce'], sap: ['SAP'], oracle: ['Oracle'],
}

const INDUSTRY_KEYWORDS = [
  'Insurance', 'Reinsurance', 'Banking', 'Investment Banking', 'Asset Management',
  'Private Equity', 'Venture Capital', 'Hedge Fund', 'Capital Markets',
  'Corporate Finance', 'M&A', 'Mergers & Acquisitions', 'IPO', 'Due Diligence',
  'Consulting', 'Strategy', 'Operations', 'Supply Chain', 'Logistics',
  'Healthcare', 'Pharmaceuticals', 'MedTech', 'Biotech', 'Life Sciences',
  'Technology', 'Software', 'SaaS', 'FinTech', 'E-commerce', 'Digital Transformation',
  'Energy', 'Oil & Gas', 'Renewables', 'Sustainability', 'ESG',
  'Real Estate', 'Infrastructure', 'Telecom', 'Retail', 'FMCG', 'Consumer Goods',
  'Automotive', 'Manufacturing', 'Industrial', 'Aerospace', 'Defense',
  'Media', 'Entertainment', 'Sports', 'Education', 'NGO', 'Government', 'Public Sector',
  'Procurement', 'HR', 'Talent', 'Recruitment', 'Marketing', 'Sales', 'Business Development',
  'Project Management', 'Change Management', 'Restructuring', 'Turnaround',
  'Valuation', 'Modelling', 'Forecasting', 'Analytics', 'Data', 'AI', 'Machine Learning',
]
const INDUSTRY_KW_LOWER = INDUSTRY_KEYWORDS.map((k) => k.toLowerCase())

export function normalizeSkill(raw: string): string[] {
  const lower = raw.trim().toLowerCase()
  for (const [alias, normalized] of Object.entries(SKILL_ALIASES)) {
    if (lower === alias || lower.startsWith(alias + ' ') || lower.includes(alias)) {
      return normalized
    }
  }
  return [raw.trim().replace(/\b(\w)/g, (c) => c.toUpperCase())]
}

export function extractIndustryTags(descriptions: string[]): string[] {
  const found = new Set<string>()
  const allText = descriptions.join(' ').toLowerCase()
  for (let i = 0; i < INDUSTRY_KW_LOWER.length; i++) {
    if (allText.includes(INDUSTRY_KW_LOWER[i])) found.add(INDUSTRY_KEYWORDS[i])
  }
  return [...found]
}

// ─────────────────────────────────────────────
// Synonyms
// ─────────────────────────────────────────────
const SYNONYMS: Record<string, string[]> = {
  airlines: ['aviation', 'airline', 'aircraft', 'aerospace', 'airport', 'carrier'],
  airline: ['aviation', 'airlines', 'aircraft', 'aerospace', 'airport', 'carrier'],
  aviation: ['airlines', 'airline', 'aircraft', 'aerospace', 'airport', 'flight', 'air travel', 'airway'],
  aerospace: ['aviation', 'aircraft', 'defense', 'space', 'satellite'],
  banking: ['bank', 'financial services', 'capital markets', 'investment banking'],
  finance: ['financial', 'investment', 'banking', 'capital', 'treasury'],
  investment: ['investing', 'portfolio', 'fund', 'asset management', 'capital'],
  'private equity': ['pe', 'buyout', 'portfolio company', 'lbo'],
  pe: ['private equity', 'buyout', 'leveraged'],
  vc: ['venture capital', 'startup investment', 'seed'],
  'venture capital': ['vc', 'startup', 'seed fund'],
  fintech: ['financial technology', 'payments', 'digital banking', 'neobank'],
  payments: ['fintech', 'transaction', 'payment processing', 'pos'],
  'asset management': ['fund management', 'portfolio', 'wealth management'],
  insurance: ['reinsurance', 'underwriting', 'actuarial', 'p&c', 'claims', 'insurer'],
  reinsurance: ['insurance', 'treaty', 'cat bond', 'underwriting'],
  actuarial: ['insurance', 'actuary', 'risk modelling', 'mortality'],
  tech: ['technology', 'software', 'digital', 'it', 'computer'],
  technology: ['tech', 'software', 'digital', 'it', 'engineering'],
  software: ['technology', 'tech', 'programming', 'development', 'code', 'saas'],
  it: ['technology', 'tech', 'digital', 'software', 'information technology'],
  digital: ['tech', 'technology', 'software', 'online', 'internet'],
  data: ['analytics', 'data science', 'machine learning', 'ai', 'statistics'],
  ai: ['artificial intelligence', 'machine learning', 'deep learning', 'data'],
  'machine learning': ['ai', 'data science', 'ml', 'deep learning', 'neural network'],
  cloud: ['aws', 'azure', 'gcp', 'saas', 'paas', 'infrastructure'],
  cybersecurity: ['security', 'infosec', 'cyber', 'hacking'],
  energy: ['oil', 'gas', 'renewables', 'power', 'utilities', 'electricity'],
  oil: ['energy', 'gas', 'petroleum', 'upstream', 'downstream'],
  gas: ['energy', 'oil', 'lng', 'pipeline', 'natural gas'],
  renewables: ['energy', 'solar', 'wind', 'clean energy', 'green energy', 'esg'],
  sustainability: ['esg', 'green', 'climate', 'environment', 'impact', 'net zero'],
  esg: ['sustainability', 'green', 'climate', 'environmental', 'social governance'],
  healthcare: ['pharma', 'medical', 'biotech', 'health', 'hospital', 'clinical', 'life sciences'],
  pharma: ['pharmaceutical', 'healthcare', 'biotech', 'drug', 'medicine', 'clinical'],
  pharmaceutical: ['pharma', 'healthcare', 'biotech', 'drug', 'clinical trials'],
  biotech: ['pharma', 'pharmaceutical', 'healthcare', 'life sciences', 'biopharma'],
  medical: ['healthcare', 'pharma', 'clinical', 'hospital', 'health'],
  retail: ['fmcg', 'consumer goods', 'cpg', 'e-commerce', 'ecommerce'],
  fmcg: ['retail', 'consumer goods', 'cpg', 'food', 'beverage', 'household'],
  consumer: ['retail', 'fmcg', 'cpg', 'brand', 'ecommerce'],
  ecommerce: ['retail', 'digital', 'marketplace', 'online', 'platform'],
  manufacturing: ['industrial', 'production', 'factory', 'operations', 'assembly'],
  industrial: ['manufacturing', 'production', 'engineering', 'operations'],
  automotive: ['automobile', 'vehicle', 'car', 'mobility', 'ev', 'electric vehicle'],
  logistics: ['supply chain', 'transportation', 'freight', 'shipping', 'fulfillment'],
  'supply chain': ['logistics', 'procurement', 'operations', 'sourcing', 'fulfillment'],
  infrastructure: ['construction', 'engineering', 'civil', 'project finance', 'real estate'],
  'real estate': ['property', 'realty', 'construction', 'infrastructure', 'building'],
  construction: ['engineering', 'infrastructure', 'real estate', 'project management'],
  media: ['entertainment', 'publishing', 'content', 'broadcast', 'press', 'journalism'],
  entertainment: ['media', 'film', 'music', 'gaming', 'sports', 'content'],
  telecom: ['telecommunications', 'wireless', 'network', 'mobile', 'telco'],
  government: ['public sector', 'policy', 'regulatory', 'ministry', 'ngo', 'non-profit'],
  ngo: ['non-profit', 'social impact', 'charity', 'government', 'foundation'],
  consulting: ['management consulting', 'strategy', 'advisory', 'consultant'],
  advisory: ['consulting', 'consultant', 'strategy', 'counsel'],

  // Consulting firm aliases
  mckinsey: ['mckinsey & company', 'mckinsey and company', 'mck'],
  'mckinsey & company': ['mckinsey', 'mck'],
  bcg: ['boston consulting group', 'boston consulting'],
  'boston consulting group': ['bcg', 'boston consulting'],
  bain: ['bain & company', 'bain and company'],
  'bain & company': ['bain'],
  kpmg: ['kpmg consulting', 'kpmg advisory'],
  pwc: ['pricewaterhousecoopers', 'price waterhouse coopers', 'pricewaterhousecooper'],
  pricewaterhousecoopers: ['pwc'],
  ey: ['ernst & young', 'ernst and young'],
  'ernst & young': ['ey'],
  deloitte: ['deloitte consulting', 'deloitte touche', 'deloitte & touche'],
  accenture: ['accenture consulting', 'accenture strategy'],
  'oliver wyman': ['oliver wyman consulting'],
  'roland berger': ['roland berger strategy'],
  'at kearney': ['kearney', 'a.t. kearney'],
  kearney: ['at kearney', 'a.t. kearney'],

  // Investment banks
  'goldman sachs': ['goldman', 'gs', 'goldman sachs group'],
  goldman: ['goldman sachs', 'gs'],
  'morgan stanley': ['morgan stanley wealth', 'mswm'],
  'jp morgan': ['jpmorgan', 'j.p. morgan', 'jpmorgan chase'],
  jpmorgan: ['jp morgan', 'j.p. morgan', 'jpmorgan chase'],
  'merrill lynch': ['merrill', 'bofa securities', 'bank of america merrill'],
  barclays: ['barclays capital', 'barclays investment bank'],
  'credit suisse': ['cs', 'credit suisse group'],
  ubs: ['ubs investment bank', 'ubs group'],
  lazard: ['lazard freres', 'lazard ltd'],
  rothschild: ['rothschild & co', 'nth rothschild'],

  // PE/VC
  kkr: ['kohlberg kravis roberts', 'kkr & co'],
  blackstone: ['blackstone group', 'bx'],
  carlyle: ['carlyle group'],
  apax: ['apax partners'],
  bain_capital: ['bain capital', 'bainc'],
  warburg: ['warburg pincus'],

  // Tech
  google: ['alphabet', 'google llc', 'google inc'],
  alphabet: ['google', 'deepmind'],
  amazon: ['amazon web services', 'aws', 'amazon.com'],
  aws: ['amazon web services', 'amazon'],
  microsoft: ['msft', 'microsoft corporation'],
  meta: ['facebook', 'meta platforms', 'instagram', 'whatsapp'],
  facebook: ['meta', 'meta platforms'],
  legal: ['law', 'compliance', 'regulatory', 'attorney', 'counsel', 'contracts'],
  hr: ['human resources', 'talent', 'people', 'recruiter', 'recruitment', 'workforce'],
  'human resources': ['hr', 'talent', 'people', 'recruiter', 'recruitment'],
  recruitment: ['hr', 'talent acquisition', 'hiring', 'headhunting'],
  marketing: ['brand', 'advertising', 'growth', 'communications', 'digital marketing'],
  sales: ['business development', 'commercial', 'revenue', 'account management'],
  'business development': ['sales', 'commercial', 'bd', 'partnerships', 'growth'],
  operations: ['ops', 'supply chain', 'logistics', 'process', 'efficiency'],
  strategy: ['consulting', 'strategic', 'corporate development', 'm&a'],
  'm&a': ['mergers', 'acquisitions', 'corporate finance', 'investment banking'],
  mergers: ['m&a', 'acquisitions', 'corporate finance', 'deal'],
  accounting: ['audit', 'tax', 'cpa', 'financial reporting', 'controller'],
  audit: ['accounting', 'assurance', 'big 4', 'tax', 'compliance'],

  // Country / territory aliases — lets "czechia" find "Czech Republic" etc.
  czechia: ['czech republic', 'czech', 'prague', 'brno'],
  'czech republic': ['czechia', 'czech', 'bohemia'],
  uk: ['united kingdom', 'britain', 'england', 'british', 'great britain', 'london'],
  'united kingdom': ['uk', 'britain', 'england', 'british', 'london'],
  britain: ['uk', 'united kingdom', 'england', 'british'],
  usa: ['united states', 'america', 'american', 'us'],
  'united states': ['usa', 'america', 'american', 'new york', 'washington'],
  korea: ['south korea', 'korean', 'seoul'],
  'south korea': ['korea', 'korean', 'seoul'],
  taiwan: ['taipei', 'roc'],
  'hong kong': ['hk', 'hongkong'],
  hk: ['hong kong', 'hongkong'],
  uae: ['united arab emirates', 'dubai', 'abu dhabi', 'emirates'],
  'united arab emirates': ['uae', 'dubai', 'abu dhabi'],
  ksa: ['saudi arabia', 'saudi', 'riyadh'],
  'saudi arabia': ['ksa', 'saudi', 'riyadh'],
  vietnam: ['viet nam', 'vietnamese', 'hanoi', 'ho chi minh'],
  myanmar: ['burma', 'burmese'],
  iran: ['persia', 'persian', 'tehran'],
  netherlands: ['holland', 'dutch', 'amsterdam'],
  holland: ['netherlands', 'dutch'],
  scandinavia: ['sweden', 'norway', 'denmark', 'nordic', 'nordic countries'],
}

// ─────────────────────────────────────────────
// Taxonomy ↔ company/firm synonym bridge
//
// Firm names that appear in the INDUSTRIES / FUNCTIONS keyword lists get
// bidirectional synonym links: "consulting" → mckinsey/bcg/bain/…  and
// "mckinsey" → "consulting". This means:
//   • Searching "consulting" finds McKinsey employees even if their CV never
//     uses the word "consulting" — matched via the firm name in their profile.
//   • Searching "mckinsey" surfaces the "Consulting" taxonomy label so they
//     also appear in related searches.
//
// Only proper firm names are bridged (not generic keywords like "strategy" or
// "operations") to avoid false-positive fan-out.
// ─────────────────────────────────────────────

/** Firm/brand names we recognise as taxonomy anchors (not generic keywords). */
const TAXONOMY_FIRMS = new Set([
  // Consulting
  'mckinsey', 'bcg', 'bain', 'strategy&', 'deloitte', 'kpmg', 'pwc', 'ey',
  'accenture', 'oliver wyman', 'roland berger', 'at kearney', 'arthur d. little',
  'monitor', 'booz allen',
  // Investment Banking
  'goldman sachs', 'morgan stanley', 'jp morgan', 'jpmorgan', 'merrill lynch',
  'barclays', 'credit suisse', 'deutsche bank', 'hsbc', 'lazard', 'rothschild',
  'nomura',
  // PE / VC
  'kkr', 'blackstone', 'carlyle', 'tpg', 'warburg pincus', 'apax',
  'bridgepoint', 'permira', 'andreessen horowitz', 'sequoia', 'accel',
  // Asset Management
  'blackrock', 'vanguard', 'fidelity', 'schroders', 'amundi',
  // Tech
  'google', 'amazon', 'microsoft', 'meta', 'apple', 'netflix', 'spotify',
  'uber', 'airbnb', 'palantir', 'salesforce', 'oracle', 'sap',
  // Healthcare
  'pfizer', 'novartis', 'roche', 'merck', 'astrazeneca', 'sanofi',
  'bayer', 'gsk', 'abbvie', 'gilead',
  // Energy
  'bp', 'shell', 'exxon', 'chevron', 'totalenergies', 'equinor', 'eni',
  // Consumer
  'unilever', 'nestle', 'loreal', 'lvmh', 'nike', 'zalando',
  // Manufacturing / Industrial
  'siemens', 'general electric', 'honeywell', 'bosch', 'bmw', 'volkswagen',
  'airbus', 'boeing', 'basf',
  // Government / Multilateral
  'world bank', 'imf', 'united nations', 'undp', 'unicef', 'oecd',
  'european commission',
])

/**
 * Bidirectional taxonomy synonym map built once at module load:
 *   taxonomy label (lowercase) → [firm1, firm2, …]
 *   firm (lowercase)           → [label1, label2, …]
 *
 * Only bridges keywords present in TAXONOMY_FIRMS to prevent generic words
 * (e.g. "strategy") from becoming noisy catch-all synonyms.
 */
const TAXONOMY_SYNS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  function add(key: string, val: string) {
    const k = key.toLowerCase().trim()
    const v = val.toLowerCase().trim()
    if (!k || k.length < 2 || !v || v.length < 2 || k === v) return
    if (!map[k]) map[k] = []
    if (!map[k].includes(v)) map[k].push(v)
  }
  for (const cat of [...INDUSTRIES, ...FUNCTIONS]) {
    const label = cat.label.toLowerCase()
    for (const kw of cat.keywords) {
      const k = kw.trim().toLowerCase()
      if (TAXONOMY_FIRMS.has(k)) {
        add(label, k)  // "consulting" → "mckinsey"
        add(k, label)  // "mckinsey"   → "consulting"
      }
    }
  }
  return map
})()

export function stemWord(w: string): string[] {
  if (w.length < 5) return [w]
  const stems = new Set([w])
  const rules: [string, string][] = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['ising', 'ize'], ['izing', 'ize'],
    ['ations', ''], ['ation', ''],
    ['ness', ''], ['ment', ''], ['ance', ''], ['ence', ''], ['ity', ''],
    ['ings', ''], ['ing', ''], ['tion', ''], ['sion', ''],
    ['ers', ''], ['ors', ''], ['ies', 'y'], ['ed', ''], ['er', ''],
    ['ous', ''], ['ive', ''], ['ful', ''], ['al', ''], ['ic', ''],
    ['s', ''],
  ]
  for (const [suf, rep] of rules) {
    if (w.endsWith(suf) && w.length - suf.length + rep.length >= 4) {
      const stem = w.slice(0, w.length - suf.length) + rep
      if (stem.length >= 4) stems.add(stem)
    }
  }
  return [...stems]
}

export function expandQuery(q: string): string[] {
  const variants = new Set([q])

  // 1. Manual SYNONYMS — explicit curated pairs (consulting firm aliases, geo, etc.)
  for (const s of SYNONYMS[q] || []) variants.add(s)
  for (const [key, vals] of Object.entries(SYNONYMS)) {
    if (vals.includes(q)) {
      variants.add(key)
      for (const v of vals) variants.add(v)
    }
  }

  // 2. Taxonomy-derived synonyms — firm names ↔ industry/function labels.
  //    "consulting" expands to mckinsey/bcg/bain etc. so profiles whose company
  //    name is a firm (but CV never says "consulting") are still found.
  //    "mckinsey" expands to "consulting" so it surfaces related taxonomy matches.
  for (const s of TAXONOMY_SYNS[q] || []) variants.add(s)

  return [...variants]
}

// ─────────────────────────────────────────────
// Geo macro-groups
// ─────────────────────────────────────────────
const GEO_GROUPS: Record<string, string[]> = {
  'central europe': ['poland', 'czech', 'slovakia', 'hungary', 'austria', 'germany', 'switzerland', 'slovenia', 'croatia', 'liechtenstein'],
  'eastern europe': ['poland', 'romania', 'bulgaria', 'ukraine', 'serbia', 'moldova', 'latvia', 'lithuania', 'estonia', 'belarus', 'bosnia'],
  'western europe': ['france', 'spain', 'italy', 'portugal', 'belgium', 'netherlands', 'luxembourg', 'ireland', 'uk', 'britain', 'england', 'scotland'],
  'northern europe': ['sweden', 'norway', 'denmark', 'finland', 'iceland'],
  'southern europe': ['spain', 'italy', 'greece', 'portugal', 'malta', 'cyprus', 'albania', 'north macedonia'],
  nordics: ['sweden', 'norway', 'denmark', 'finland', 'iceland'],
  scandinavia: ['sweden', 'norway', 'denmark', 'finland'],
  europe: ['france', 'germany', 'spain', 'italy', 'portugal', 'belgium', 'netherlands', 'switzerland', 'austria', 'sweden', 'norway', 'denmark', 'finland', 'poland', 'czech', 'slovakia', 'hungary', 'romania', 'bulgaria', 'greece', 'ireland', 'uk', 'croatia'],
  mena: ['saudi', 'uae', 'qatar', 'kuwait', 'bahrain', 'oman', 'egypt', 'jordan', 'lebanon', 'morocco', 'tunisia', 'algeria', 'iraq', 'iran', 'israel'],
  'middle east': ['saudi', 'uae', 'qatar', 'kuwait', 'bahrain', 'oman', 'jordan', 'lebanon', 'israel', 'iraq', 'iran', 'palestine'],
  gcc: ['saudi', 'uae', 'qatar', 'kuwait', 'bahrain', 'oman'],
  gulf: ['saudi', 'uae', 'qatar', 'kuwait', 'bahrain', 'oman'],
  levant: ['lebanon', 'jordan', 'syria', 'israel', 'palestine'],
  'north africa': ['egypt', 'morocco', 'tunisia', 'algeria', 'libya'],
  latam: ['brazil', 'mexico', 'colombia', 'argentina', 'chile', 'peru', 'venezuela', 'ecuador', 'uruguay', 'paraguay', 'bolivia', 'costa rica', 'panama', 'guatemala'],
  'latin america': ['brazil', 'mexico', 'colombia', 'argentina', 'chile', 'peru', 'venezuela', 'ecuador', 'uruguay', 'paraguay', 'bolivia'],
  'southeast asia': ['singapore', 'thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines', 'myanmar', 'cambodia', 'laos'],
  sea: ['singapore', 'thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines'],
  'south asia': ['india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal'],
  'east asia': ['china', 'japan', 'korea', 'taiwan', 'hong kong'],
  'greater china': ['china', 'taiwan', 'hong kong', 'macao'],
  asia: ['china', 'japan', 'korea', 'india', 'singapore', 'thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines', 'taiwan', 'hong kong'],
  'asia pacific': ['china', 'japan', 'korea', 'india', 'singapore', 'australia', 'new zealand', 'thailand', 'indonesia', 'malaysia', 'philippines'],
  apac: ['china', 'japan', 'korea', 'india', 'singapore', 'australia', 'new zealand', 'thailand', 'indonesia', 'malaysia', 'philippines'],
  'sub-saharan africa': ['nigeria', 'kenya', 'ghana', 'south africa', 'ethiopia', 'tanzania', 'cameroon', 'senegal', 'angola', 'mozambique', 'uganda', 'rwanda'],
  'west africa': ['nigeria', 'ghana', 'senegal', 'cameroon', 'ivory coast', 'mali', 'burkina faso'],
  'east africa': ['kenya', 'ethiopia', 'tanzania', 'uganda', 'rwanda', 'somalia'],
  africa: ['nigeria', 'kenya', 'ghana', 'south africa', 'ethiopia', 'tanzania', 'cameroon', 'senegal', 'egypt', 'morocco', 'angola'],
  anglophone: ['uk', 'usa', 'australia', 'canada', 'ireland', 'new zealand', 'united kingdom', 'united states', 'american'],
  francophone: ['france', 'belgium', 'switzerland', 'luxembourg', 'senegal', 'cameroon', 'morocco', 'tunisia', 'algeria', 'ivory coast', 'canada', 'lebanon'],
  lusophone: ['brazil', 'portugal', 'angola', 'mozambique', 'cape verde'],
  cis: ['russia', 'ukraine', 'kazakhstan', 'georgia', 'armenia', 'azerbaijan', 'uzbekistan', 'belarus'],
  brics: ['brazil', 'russia', 'india', 'china', 'south africa'],
}

const STOP_WORDS = new Set([
  'i', 'am', 'looking', 'for', 'someone', 'with', 'from', 'a', 'an', 'the',
  'and', 'who', 'has', 'have', 'worked', 'in', 'at', 'experience', 'background',
  'person', 'people', 'classmate', 'colleague', 'find', 'me', 'is', 'are', 'was',
  'were', 'that', 'can', 'could', 'would', 'should', 'want', 'need', 'show', 'get',
  'my', 'any', 'some', 'of', 'to', 'do', 'did', 'been', 'be', 'this', 'these',
  'those', 'about', 'strong', 'good', 'great', 'senior', 'junior',
  'former', 'current', 'ex', 'also', 'both', 'having', 'across',
])

export type Token =
  | { type: 'phrase'; value: string; display: string }
  | { type: 'geo'; value: string; display: string; countries: string[] }
  | { type: 'term'; value: string; display: string }
  /** Auto-detected multi-word term locked as a phrase (e.g. "supply chain") */
  | { type: 'multiword'; value: string; display: string }

export function parseQuery(raw: string): Token[] {
  if (!raw.trim()) return []
  const tokens: Token[] = []
  let remaining = raw.toLowerCase().trim()

  // 1. Quoted phrases
  remaining = remaining.replace(/"([^"]+)"/g, (_, phrase) => {
    tokens.push({ type: 'phrase', value: phrase.trim(), display: `"${phrase.trim()}"` })
    return ' '
  })

  // 2. Geo groups (longest match first). Match on WORD BOUNDARIES so short keys
  // like "sea"/"cis"/"apac" don't trigger inside ordinary words
  // (e.g. "research" contains "sea", "capacity" contains "apac").
  const geoKeys = Object.keys(GEO_GROUPS).sort((a, b) => b.length - a.length)
  for (const key of geoKeys) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    if (re.test(remaining)) {
      tokens.push({ type: 'geo', value: key, display: key, countries: GEO_GROUPS[key] })
      remaining = remaining.replace(re, ' ')
    }
  }

  // 3. Multi-word term locking — scan for MULTIWORD_TERMS before splitting into
  //    individual words so "supply chain" stays as one token, not two.
  //    Already sorted longest-first in the source array, so greedy match wins.
  for (const term of MULTIWORD_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    if (re.test(remaining)) {
      tokens.push({ type: 'multiword', value: term, display: term })
      remaining = remaining.replace(re, ' ')
    }
  }

  // 4. Remaining terms
  const words = remaining
    .split(/[\s·|,]+/)
    .map((w) => w.replace(/[^a-z0-9#+\-_.]/g, '').trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))

  for (const w of words) tokens.push({ type: 'term', value: w, display: w })
  return tokens
}

// ─────────────────────────────────────────────
// Index builder
// ─────────────────────────────────────────────

/**
 * One experience or education entry as a self-contained, field-separated bucket.
 * Powers per-entry co-location checks and field-aware strength scoring.
 */
export interface ExpBucket {
  /** lowercased company / school name */
  company: string
  /** lowercased location */
  location: string
  /** lowercased joined role/degree titles */
  roles: string
  /** lowercased first description bullet — highest-value achievement statement */
  descFirst: string
  /** lowercased remaining description bullets joined — supporting details */
  descRest: string
  /** true for the most-recent non-INSEAD entry of its kind */
  recent: boolean
  /** latest end year across all roles in this entry (null = unknown) */
  endYear: number | null
  /** total years spanned across all roles in this entry */
  durationYears: number
}

export interface SearchIndex {
  all: string[]
  company: string[]
  university: string[]
  location: string[]
  skill: string[]
  language: string[]
  nationality: string[]
  name: string[]
  /** Per-experience buckets (most recent first) */
  jobs: ExpBucket[]
  /** Per-education buckets */
  edu: ExpBucket[]
  /** Canonical taxonomy labels (industries + functions), lowercased */
  taxonomy: string[]
  /** lowercased LinkedIn headline */
  headline: string
  /** lowercased LinkedIn about/summary */
  about: string
}

// ─────────────────────────────────────────────
// Temporal scoring helpers
// ─────────────────────────────────────────────

/** Parse a years string like "2018 – 2021", "Jan 2019 - Present", "2021" */
export function parseYearsStr(raw: string | undefined | null): { start: number | null; end: number | null } {
  if (!raw) return { start: null, end: null }
  const CURRENT = new Date().getFullYear()
  const s = raw.toLowerCase()
  const m2 = s.match(/(\d{4})\s*[-–—]\s*(present|current|now|\d{4})/)
  if (m2) {
    const start = parseInt(m2[1])
    const end = /present|current|now/.test(m2[2]) ? CURRENT : parseInt(m2[2])
    return { start, end: Math.min(end, CURRENT) }
  }
  const m1 = s.match(/(\d{4})/)
  if (m1) { const y = parseInt(m1[1]); return { start: y, end: y } }
  return { start: null, end: null }
}

/** Derive the latest end year and total span across all roles in an entry. */
export function bucketTemporal(roles: { years?: string; dates?: string }[]): {
  endYear: number | null
  durationYears: number
} {
  let latestEnd: number | null = null
  let earliestStart: number | null = null
  for (const r of roles) {
    const { start, end } = parseYearsStr(r.years ?? r.dates)
    if (end !== null && (latestEnd === null || end > latestEnd)) latestEnd = end
    if (start !== null && (earliestStart === null || start < earliestStart)) earliestStart = start
  }
  const durationYears =
    latestEnd !== null && earliestStart !== null ? Math.max(0, latestEnd - earliestStart) : 0
  return { endYear: latestEnd, durationYears }
}

/**
 * Multiplier applied to a bucket's raw field score based on how recent and
 * substantial the experience was.
 *
 * | Recency (end year)   | Duration ≥ 1 yr | Duration < 1 yr |
 * |----------------------|-----------------|-----------------|
 * | ≤ 2 years ago        | ×1.50           | ×1.10           |
 * | 3–4 years ago        | ×1.00           | ×0.75           |
 * | 5–7 years ago        | ×0.65           | ×0.45           |
 * | > 7 years ago        | ×0.30           | ×0.20           |
 * | unknown              | ×0.90 (neutral) |                 |
 */
function temporalMultiplier(endYear: number | null, durationYears: number): number {
  if (endYear === null) return 0.9
  const ago = new Date().getFullYear() - endYear
  const substantial = durationYears >= 1
  if (ago <= 2) return substantial ? 1.5 : 1.1
  if (ago <= 4) return substantial ? 1.0 : 0.75
  if (ago <= 7) return substantial ? 0.65 : 0.45
  return substantial ? 0.3 : 0.2
}

/** Detect an INSEAD/MBA entry so it can be skipped when picking the recent role. */
export function isInseadEntity(name: string): boolean {
  const l = name.toLowerCase().trim()
  return l.includes('insead') || l === 'mba' || l === 'mba candidate'
}

export function buildSearchIndex(cv: EnrichedProfile): SearchIndex {
  const parts: SearchIndex = {
    all: [], company: [], university: [], location: [],
    skill: [], language: [], nationality: [], name: [cv.name],
    jobs: [], edu: [], taxonomy: [], headline: '', about: '',
  }

  // Unified CV⊕LinkedIn timeline when available — LinkedIn-only jobs become
  // searchable buckets too
  const jobEntries = cv.timeline?.length ? cv.timeline : cv.experience || []
  let recentJobMarked = false
  for (const e of jobEntries) {
    if (e.entity) {
      parts.company.push(e.entity)
      if (e.location) parts.location.push(e.location)
    }
    for (const r of e.roles || []) if (r.role) parts.company.push(r.role)
    for (const d of e.description || []) if (d) parts.company.push(d)

    const isInsead = isInseadEntity(e.entity || '')
    const recent = !isInsead && !recentJobMarked
    if (recent) recentJobMarked = true

    const jobDescs = (e.description ?? []).filter(Boolean)
    const jobTemporal = bucketTemporal(e.roles ?? [])
    parts.jobs.push({
      company: (e.entity || '').toLowerCase(),
      location: (e.location || '').toLowerCase(),
      roles: (e.roles ?? []).map((r) => r.role).filter(Boolean).join(' ').toLowerCase(),
      descFirst: (jobDescs[0] || '').toLowerCase(),
      descRest: jobDescs.slice(1).join(' ').toLowerCase(),
      recent,
      ...jobTemporal,
    })
  }
  let recentEduMarked = false
  for (const e of cv.education || []) {
    if (e.entity) {
      parts.university.push(e.entity)
      if (e.location) parts.location.push(e.location)
    }
    for (const r of e.roles || []) if (r.role) parts.university.push(r.role)

    const recent = !isInseadEntity(e.entity || '') && !recentEduMarked
    if (recent) recentEduMarked = true

    const eduDescs = (e.description ?? []).filter(Boolean)
    const eduTemporal = bucketTemporal(e.roles ?? [])
    parts.edu.push({
      company: (e.entity || '').toLowerCase(),
      location: (e.location || '').toLowerCase(),
      roles: (e.roles ?? []).map((r) => r.role).filter(Boolean).join(' ').toLowerCase(),
      descFirst: (eduDescs[0] || '').toLowerCase(),
      descRest: eduDescs.slice(1).join(' ').toLowerCase(),
      recent,
      ...eduTemporal,
    })
  }

  // Languages — anchored multi-language parsing handles compound/messy entries
  for (const p of parseAllLanguages(cv.languages)) {
    parts.language.push(p.lang)
    if (p.cefr) parts.language.push(p.cefr)
    parts.language.push(p.display)
  }
  // Also include LinkedIn languages
  for (const p of parseAllLanguages(cv.li_languages)) {
    parts.language.push(p.lang)
    parts.language.push(p.display)
  }

  // Skills (+ aliases)
  for (const s of cv.skills || []) {
    parts.skill.push(s)
    for (const n of normalizeSkill(s)) if (n !== s) parts.skill.push(n)
  }
  for (const s of cv.li_skills || []) parts.skill.push(s)

  // Derived industry/function labels go to taxonomy ONLY — not to skill.
  // Reason: taxonomy is inferred from keyword matching across ALL experience
  // (including old, brief roles) and is therefore timeless. Scoring it at
  // W_SKILL (0.7) would give old incidental exposure the same weight as an
  // explicitly listed skill. By keeping it in taxonomy (W_TAX = 0.45) we
  // ensure that taxonomy alone can never pull a token into "good" territory
  // for multi-token queries — only combined with bucket-level evidence can it.
  // Both sets remain in idx.all so tokenMatches still finds them for filtering.
  const allDesc = jobEntries.flatMap((e) => e.description || [])
  for (const tag of extractIndustryTags(allDesc)) parts.taxonomy.push(tag.toLowerCase())

  const { industries, functions } = classifyProfile(cv)
  for (const tag of [...industries, ...functions]) {
    parts.taxonomy.push(tag.toLowerCase())
  }

  // LinkedIn headline/about are valuable signal
  if (cv.li_headline) parts.company.push(cv.li_headline)
  if (cv.li_about) parts.company.push(cv.li_about)
  if (cv.li_location) parts.location.push(cv.li_location)
  parts.headline = (cv.li_headline || '').toLowerCase()
  parts.about = (cv.li_about || '').toLowerCase()

  const nat = cv.nationality || ''
  if (nat) {
    parts.nationality.push(nat)
    parts.location.push(nat)
  } else {
    for (const p of parseAllLanguages(cv.languages)) {
      if (p.cefr === 'C2') {
        const inferred = NATIVE_LANG_NATIONALITY[p.lang.toLowerCase()]
        if (inferred) {
          parts.nationality.push(inferred)
          parts.location.push(inferred)
        }
      }
    }
  }

  parts.all = [
    ...parts.company, ...parts.university, ...parts.location,
    ...parts.skill, ...parts.language, ...parts.nationality, ...parts.name,
    // taxonomy included for matching (tokenMatches) but scored separately at W_TAX
    ...parts.taxonomy,
  ].filter((t) => typeof t === 'string')

  return parts
}

// ─────────────────────────────────────────────
// Matching
// ─────────────────────────────────────────────
export interface IndexedProfile {
  cv: EnrichedProfile
  idx: SearchIndex
}

/** Index fields that are plain string lists and can be used as a search scope. */
export type SearchField =
  | 'all' | 'company' | 'university' | 'location'
  | 'skill' | 'language' | 'nationality' | 'name'

/**
 * Geo-aware substring check.  Short country codes (≤3 chars, e.g. "uk", "sea")
 * are matched with word boundaries to avoid false positives like "duke" → "uk".
 */
function geoMatches(text: string, countryKey: string): boolean {
  const t = text.toLowerCase()
  if (countryKey.length <= 3) {
    return new RegExp(`\\b${countryKey}\\b`).test(t)
  }
  return t.includes(countryKey)
}

function tokenMatches(token: Token, entry: IndexedProfile, filter: SearchField): boolean {
  if (token.type === 'geo') {
    const locs = [...entry.idx.location, ...entry.idx.nationality]
    return token.countries.some((c) => locs.some((loc) => geoMatches(loc, c)))
  }
  const q = token.value
  const targets = filter === 'all' ? entry.idx.all : entry.idx[filter] || []
  const variants = expandQuery(q)
  for (const variant of variants) {
    if (targets.some((t) => String(t).toLowerCase().includes(variant))) return true
    const stems = stemWord(variant)
    if (stems.length > 1) {
      if (targets.some((t) => stems.some((stem) => String(t).toLowerCase().includes(stem)))) return true
    }
  }
  return false
}

function entryText(e: CvEntry): string {
  return [
    e.entity || '',
    e.location || '',
    ...(e.roles || []).map((r) => r.role || ''),
    ...(e.description || []),
  ]
    .join(' ')
    .toLowerCase()
}

export function matchesAll(
  entry: IndexedProfile,
  tokens: Token[],
  filter: SearchField = 'all'
): boolean {
  if (!tokens.length) return true

  const geoTokens = tokens.filter((t) => t.type === 'geo')
  const textTokens = tokens.filter((t) => t.type !== 'geo')

  if (!textTokens.every((tok) => tokenMatches(tok, entry, filter))) return false
  if (geoTokens.length === 0) return true

  const cv = entry.cv
  const expEntries = cv.timeline?.length ? cv.timeline : cv.experience || []

  return geoTokens.every((geoTok) => {
    const textMatchingExp = expEntries.filter((e) => {
      const et = entryText(e)
      return (
        textTokens.length === 0 ||
        textTokens.some((tok) => stemWord(tok.value).some((stem) => et.includes(stem)))
      )
    })

    if (textMatchingExp.length > 0) {
      // At least one experience entry matches the text — check co-location.
      const colocated = textMatchingExp.some((e) =>
        geoTok.countries.some((c) => geoMatches(e.location || '', c))
      )
      if (colocated) return true

      // Not co-located: allow a match only when the text is person-level
      // (a skill or language, not buried in a job description) AND nationality
      // matches the geo region.
      const personFields = [...(cv.languages || []), ...(cv.skills || [])]
      const textMatchesPersonLevel = textTokens.some((tok) =>
        expandQuery(tok.value).some((v) => personFields.some((f) => f.toLowerCase().includes(v)))
      )
      if (textMatchesPersonLevel) {
        return geoTok.countries.some((c) =>
          (entry.idx.nationality || []).some((n) => geoMatches(n, c))
        )
      }
      return false
    }

    // No experience entry matched the text tokens (could be a sparse profile, or
    // the text matched only via broad synonyms in headlines/about).
    // For geo+text queries require the text to appear in person-level fields
    // (skills / languages) to avoid false positives from description noise.
    if (textTokens.length > 0) {
      const personFields = [...(cv.languages || []), ...(cv.skills || [])]
      const textMatchesPersonLevel = textTokens.some((tok) =>
        expandQuery(tok.value).some((v) => personFields.some((f) => f.toLowerCase().includes(v)))
      )
      if (!textMatchesPersonLevel) return false
    }

    const locs = [...(entry.idx.location || []), ...(entry.idx.nationality || [])]
    return geoTok.countries.some((c) => locs.some((loc) => geoMatches(loc, c)))
  })
}

// ─────────────────────────────────────────────
// Per-token scoring for partial-match grouping
// ─────────────────────────────────────────────

/**
 * Returns the indices of every token that this profile matches, checked
 * individually (not co-located). Used to build partial-match sections in the UI.
 *
 * Full match: all indices present.
 * N-1 match: one token missing.
 * etc.
 */
export function scoreProfile(
  entry: IndexedProfile,
  tokens: Token[],
  filter: SearchField = 'all'
): number[] {
  return tokens.reduce<number[]>((acc, tok, i) => {
    if (tokenMatches(tok, entry, filter)) acc.push(i)
    return acc
  }, [])
}

// ─────────────────────────────────────────────
// Strength scoring — field-aware, co-location-aware match quality
//
// Goal: a search for "airline" should rank a Pilot or Aviation Engineer far
// above someone with a one-line side-project mention. And for multi-token
// queries ("airline europe ops"), hitting all tokens *within a single job*
// should beat the same tokens scattered across a whole CV.
//
// Weighting (highest → lowest evidence):
//   role/title 1.0 · company 0.85 · taxonomy 0.8 · skill 0.7 · headline 0.65
//   · description 0.5 · location 0.55 · nationality/about 0.4
// Synonym-only matches are scaled down hard (×0.4) — exact/stemmed word wins.
// Recent role ×1.25, multiple matching jobs a small bonus, and co-location a
// large multiplier (all tokens in one entry ×1.8, two together ×1.35).
// ─────────────────────────────────────────────

export type StrengthTier = 'strong' | 'good' | 'weak'

export interface StrengthResult {
  /** Raw score (higher = stronger). Used for ordering. */
  score: number
  /** Bucketed label for the UI badge. */
  tier: StrengthTier
  /** Indices of the tokens this profile matched at all. */
  matched: number[]
}

interface TokenMatcher {
  type: 'text' | 'geo'
  /** The same word + morphological stems (high-confidence, quality 2). */
  words: string[]
  /** Synonyms — different lemmas (low-confidence, quality 1). */
  syns: string[]
  countries: string[]
  /** Token is language-oriented (also scan the language field). */
  isLang: boolean
}

const LANG_HINT = new Set([
  ...Object.keys(NATIVE_LANG_NATIONALITY),
  'english', 'arabic', 'mandarin', 'cantonese', 'speaks', 'speak', 'fluent',
])

/** Precompute matchers for a query once, then reuse across all profiles. */
export function buildMatchers(tokens: Token[]): TokenMatcher[] {
  return tokens.map((tok) => {
    if (tok.type === 'geo') {
      return { type: 'geo', words: [], syns: [], countries: tok.countries, isLang: false }
    }
    const v = tok.value.toLowerCase()
    const words = new Set<string>([v, ...stemWord(v)])
    const syns = new Set<string>()
    for (const variant of expandQuery(v)) if (!words.has(variant)) syns.add(variant)
    return {
      type: 'text',
      words: [...words].filter((w) => w.length >= 2),
      syns: [...syns].filter((w) => w.length >= 2),
      countries: [],
      isLang: LANG_HINT.has(v),
    }
  })
}

/** 2 = exact/stem word present, 1 = synonym present, 0 = no match. */
function fieldQuality(m: TokenMatcher, text: string): 0 | 1 | 2 {
  if (!text) return 0
  for (const w of m.words) if (text.includes(w)) return 2
  for (const s of m.syns) if (text.includes(s)) return 1
  return 0
}
const qf = (q: 0 | 1 | 2): number => (q === 2 ? 1.0 : q === 1 ? 0.4 : 0)

// Field base weights
const W_ROLE = 1.0
const W_COMPANY = 0.85
// Taxonomy is derived from ALL experience (timeless) so dampened vs bucket signals.
// Old experience feeds the same taxonomy tag as recent work — bucket-level temporal
// multipliers don't apply here. At 0.45 a taxonomy-only match stays below the
// "good" threshold (0.5) for multi-token queries, moving incidental hits to partial.
const W_TAX = 0.45
const W_SKILL = 0.7
const W_HEAD = 0.65
const W_LOC = 0.55
const W_DESC_FIRST = 0.55  // primary achievement bullet — more important
const W_DESC_REST = 0.38   // supporting bullets — diminishing evidence
const W_NAT = 0.4
const W_ABOUT = 0.4
const RECENT_MULT = 1.25

/**
 * Score one profile against a prepared matcher set. Returns a raw score, a
 * tier for the badge, and the matched-token indices (so it also replaces
 * {@link scoreProfile} for partial-match grouping).
 */
export function scoreStrength(
  entry: IndexedProfile,
  matchers: TokenMatcher[]
): StrengthResult {
  const idx = entry.idx
  const buckets = [...idx.jobs, ...idx.edu]
  const skillText = idx.skill.join(' · ').toLowerCase()
  const taxText = idx.taxonomy.join(' · ')
  const langText = idx.language.join(' · ').toLowerCase()
  const natText = idx.nationality.join(' · ').toLowerCase()

  const N = matchers.length
  const weights = new Array<number>(N).fill(0)
  // For co-location: which buckets each token touched
  const tokenBuckets: number[][] = Array.from({ length: N }, () => [])

  for (let i = 0; i < N; i++) {
    const m = matchers[i]

    if (m.type === 'geo') {
      let w = 0
      buckets.forEach((b, bi) => {
        if (m.countries.some((c) => geoMatches(b.location, c))) {
          w = Math.max(w, b.recent ? W_LOC * RECENT_MULT : W_LOC)
          tokenBuckets[i].push(bi)
        }
      })
      if (m.countries.some((c) => geoMatches(natText, c))) w = Math.max(w, W_NAT)
      weights[i] = w
      continue
    }

    // Person-level evidence
    let personW = 0
    personW = Math.max(personW, W_TAX * qf(fieldQuality(m, taxText)))
    personW = Math.max(personW, W_SKILL * qf(fieldQuality(m, skillText)))
    personW = Math.max(personW, W_HEAD * qf(fieldQuality(m, idx.headline)))
    personW = Math.max(personW, W_ABOUT * qf(fieldQuality(m, idx.about)))
    personW = Math.max(personW, W_NAT * qf(fieldQuality(m, natText)))
    if (m.isLang) personW = Math.max(personW, W_SKILL * qf(fieldQuality(m, langText)))

    // Per-entry (job/education) evidence — field-separated and time-weighted.
    // Each bucket is scaled by temporalMultiplier so a 2021-2024 pharma role
    // scores far higher than a brief 2014 pharma mention. First description
    // bullet (primary achievement) carries more weight than later bullets.
    let jobW = 0
    let covering = 0
    let recentHit = false
    buckets.forEach((b, bi) => {
      const qRole = fieldQuality(m, b.roles)
      const qCompany = fieldQuality(m, b.company)
      const qDescFirst = fieldQuality(m, b.descFirst)
      const qDescRest = fieldQuality(m, b.descRest)
      let bw = 0
      if (qRole) bw = Math.max(bw, W_ROLE * qf(qRole))
      if (qCompany) bw = Math.max(bw, W_COMPANY * qf(qCompany))
      if (qDescFirst) bw = Math.max(bw, W_DESC_FIRST * qf(qDescFirst))
      if (qDescRest) bw = Math.max(bw, W_DESC_REST * qf(qDescRest))
      if (bw > 0) {
        // Apply temporal multiplier: recent substantial experience scores higher;
        // old or brief experience is significantly discounted.
        bw *= temporalMultiplier(b.endYear, b.durationYears)
        covering++
        if (b.recent) recentHit = true
        jobW = Math.max(jobW, bw)
        tokenBuckets[i].push(bi)
      }
    })
    if (recentHit) jobW *= RECENT_MULT
    if (covering > 1) jobW *= 1 + Math.min(0.3, 0.1 * (covering - 1))

    weights[i] = Math.max(personW, jobW)
  }

  const matched: number[] = []
  for (let i = 0; i < N; i++) if (weights[i] > 0) matched.push(i)
  if (matched.length === 0) return { score: 0, tier: 'weak', matched }

  let score = matched.reduce((s, i) => s + weights[i], 0)

  // Coverage: matching all query tokens matters a lot
  const coverage = matched.length / N
  score *= 0.5 + 0.5 * coverage

  // Co-location: how many matched tokens share a single entry
  if (matched.length >= 2) {
    const coverByBucket = new Map<number, number>()
    for (const i of matched) {
      for (const b of tokenBuckets[i]) coverByBucket.set(b, (coverByBucket.get(b) ?? 0) + 1)
    }
    const maxColoc = Math.max(1, ...coverByBucket.values())
    if (maxColoc >= matched.length) score *= 1.8
    else if (maxColoc >= 2) score *= 1.35
  }

  // For multi-token queries use min(average, weakest-token) so one very strong
  // token (e.g. "supply chain" in current role) cannot rescue a weak one
  // (e.g. "pharma" from a taxonomy tag of a 10-year-old brief role).
  // This pushes incidental co-occurrences to "weak" and therefore to the
  // partial-match section, leaving "full" for genuinely multi-dimensional profiles.
  const avgQuality = score / N
  const minTokenQuality = matched.length > 0 ? Math.min(...matched.map((i) => weights[i])) : 0
  const quality = N <= 1 ? avgQuality : Math.min(avgQuality, minTokenQuality)
  const tier: StrengthTier = quality >= 1.0 ? 'strong' : quality >= 0.5 ? 'good' : 'weak'
  return { score, tier, matched }
}

// ─────────────────────────────────────────────
// Highlight token values (non-geo) for use by the <Highlight> component
// ─────────────────────────────────────────────
export function highlightTerms(tokens: Token[]): string[] {
  const terms: string[] = []
  const seen = new Set<string>()

  function add(v: string) {
    if (v.length >= 3 && !seen.has(v)) {
      seen.add(v)
      terms.push(v)
    }
  }

  for (const tok of tokens) {
    if (tok.type === 'geo') continue
    const q = tok.value
    if (!q) continue
    // Original query value + every synonym variant + stems — so that "airlines"
    // also highlights "aviation", "airline" etc. in the profile cards/modal.
    add(q)
    for (const v of expandQuery(q)) add(v)
    for (const s of stemWord(q)) add(s)
  }
  return terms
}
