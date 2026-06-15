// ============================================================================
// Taxonomy layer — canonical industry / function labels for INSEAD MBA cohort.
//
// Three exports:
//   MULTIWORD_TERMS  — phrases auto-locked in the search engine so "supply
//                      chain" is never split into two word-tokens.
//   INDUSTRIES       — ~15 canonical industry buckets with keyword maps.
//   FUNCTIONS        — ~15 canonical function buckets with keyword maps.
//   classifyProfile  — derives {industries, functions} from an EnrichedProfile
//                      using keyword matching across all text fields.
// ============================================================================

import type { EnrichedProfile } from '@/types'

// ─────────────────────────────────────────────
// Multi-word term lock list
// Listed longest-first so greedy matching captures the most specific phrase.
// ─────────────────────────────────────────────
export const MULTIWORD_TERMS: string[] = [
  // Finance — multi-word
  'mergers and acquisitions',
  'leveraged buyout',
  'corporate development',
  'investment banking',
  'portfolio management',
  'wealth management',
  'asset management',
  'capital markets',
  'corporate finance',
  'financial modeling',
  'financial modelling',
  'management consulting',
  'strategy consulting',
  'growth equity',
  'hedge fund',
  'private equity',
  'venture capital',
  'private banking',
  'due diligence',
  'risk management',
  // Operations / HR / PM
  'change management',
  'project management',
  'program management',
  'product management',
  'business development',
  'supply chain',
  'human resources',
  'talent acquisition',
  'organizational development',
  // Tech / Data
  'natural language processing',
  'machine learning',
  'deep learning',
  'artificial intelligence',
  'data science',
  'data analytics',
  'data analysis',
  'digital transformation',
  'software engineering',
  'software development',
  // Industry phrases
  'real estate',
  'oil and gas',
  'life sciences',
  'consumer goods',
  'public sector',
  'social impact',
  'impact investing',
  // Strategy / Corp
  'corporate strategy',
  'strategic planning',
  'business strategy',
]

// ─────────────────────────────────────────────
// Taxonomy types
// ─────────────────────────────────────────────
export interface TaxonomyCategory {
  label: string
  keywords: string[]
}

// ─────────────────────────────────────────────
// Industry taxonomy — ~15 canonical buckets
// ─────────────────────────────────────────────
export const INDUSTRIES: TaxonomyCategory[] = [
  {
    label: 'Consulting',
    keywords: [
      'consulting', 'consultant', 'management consultant', 'strategy consultant',
      'mckinsey', 'bcg', 'bain', 'strategy&', 'deloitte', 'kpmg', 'pwc', 'ey ',
      'accenture', 'oliver wyman', 'roland berger', 'at kearney', 'arthur d. little',
      'monitor', 'booz allen',
    ],
  },
  {
    label: 'Finance',
    keywords: [
      'investment banking', 'investment bank', 'goldman sachs', 'morgan stanley',
      'jp morgan', 'jpmorgan', 'merrill lynch', 'barclays', 'credit suisse',
      'deutsche bank', 'hsbc', 'lazard', 'rothschild', 'nomura', 'bulge bracket',
      'leveraged finance', 'lev fin', 'debt capital markets', 'equity capital markets',
      'private equity', 'buyout', 'lbo', 'leveraged buyout', 'growth equity',
      'kkr', 'blackstone', 'carlyle', 'tpg', 'advent international', 'warburg pincus',
      'apax', 'bridgepoint', 'permira', 'general partner',
      'venture capital', 'early stage', 'seed stage', 'series a', 'series b',
      'accelerator', 'incubator', 'angel investing', 'andreessen horowitz',
      'sequoia', 'accel', 'tiger global', 'y combinator',
      'asset management', 'wealth management', 'fund management', 'portfolio management',
      'hedge fund', 'mutual fund', 'investment management', 'family office',
      'endowment', 'pension fund', 'blackrock', 'vanguard', 'fidelity',
      'schroders', 'amundi', 'aum', 'private banking',
      'financial services', 'banking', 'fintech', 'insurance', 'reinsurance',
      'actuarial', 'payments', 'capital markets', 'treasury', 'structured finance',
      'securitization', 'trade finance',
    ],
  },
  {
    label: 'Technology & Telecom',
    keywords: [
      'software', 'saas', 'technology company', 'tech company', 'digital platform',
      'cloud computing', 'google', 'amazon web', 'microsoft', 'meta ', 'apple ',
      'netflix', 'spotify', 'uber', 'airbnb', 'palantir', 'salesforce', 'oracle ',
      'sap ', 'semiconductor', 'cybersecurity', 'telecom', 'telecommunications', 
      'wireless', 'mobile network', 'telco', 'broadband', 'connectivity solutions',
    ],
  },
  {
    label: 'Healthcare & Pharma',
    keywords: [
      'healthcare', 'pharma', 'pharmaceutical', 'biotech', 'medtech', 'life sciences',
      'medical device', 'clinical trials', 'hospital', 'health system', 'biopharma',
      'pfizer', 'novartis', 'roche', 'johnson & johnson', 'merck', 'astrazeneca',
      'sanofi', 'bayer', 'gsk', 'abbvie', 'gilead',
    ],
  },
  {
    label: 'Energy, Utilities & Sustainability',
    keywords: [
      'oil and gas', 'oil & gas', 'petroleum', 'lng', 'upstream', 'downstream',
      'midstream', 'renewables', 'solar energy', 'wind energy', 'clean energy',
      'power generation', 'utilities', 'electricity', 'bp ', 'shell ',
      'exxon', 'chevron', 'totalenergies', 'equinor', 'eni ', 'sustainability', 'esg', 'climate',
    ],
  },
  {
    label: 'Consumer Goods, Retail & Hospitality',
    keywords: [
      'consumer goods', 'retail', 'fmcg', 'cpg', 'brand management', 'ecommerce',
      'e-commerce', 'fashion', 'luxury goods', 'food & beverage', 'food and beverage',
      'procter & gamble', 'p&g', 'unilever', 'nestle', 'loreal', 'l\'oreal', 'lvmh',
      'nike ', 'zalando', 'hotel', 'hospitality', 'tourism', 'restaurant', 'travel',
    ],
  },
  {
    label: 'Manufacturing, Industrials & Agriculture',
    keywords: [
      'manufacturing', 'industrial', 'production operations', 'automotive',
      'aerospace', 'defense', 'chemicals', 'materials science',
      'siemens', 'general electric', 'honeywell', 'bosch ', 'bmw ', 'volkswagen',
      'airbus', 'boeing', 'basf', 'agriculture', 'agtech', 'farming', 'agribusiness', 'food production',
    ],
  },
  {
    label: 'Real Estate & Infrastructure',
    keywords: [
      'real estate', 'property', 'construction', 'infrastructure', 'civil engineering',
      'reit', 'project finance', 'concession', 'real estate developer',
    ],
  },
  {
    label: 'Transportation & Logistics',
    keywords: [
      'logistics', 'shipping', 'airline', 'aviation', 'freight', 'supply chain services', 'rail',
    ],
  },
  {
    label: 'Media & Entertainment',
    keywords: [
      'media', 'entertainment', 'publishing', 'broadcast', 'film ', 'music ',
      'gaming', 'sports', 'journalism', 'advertising agency',
    ],
  },
  {
    label: 'Public Sector, NGO & Education',
    keywords: [
      'government', 'public sector', 'ministry', 'regulatory', 'diplomacy',
      'ngo', 'non-profit', 'nonprofit', 'foundation', 'world bank', 'imf ',
      'united nations', 'undp', 'unicef', 'oecd', 'european commission',
      'civil service', 'social impact', 'international organization',
      'university', 'education', 'edtech', 'research institute', 'academia',
    ],
  },
  {
    label: 'Professional & Legal Services',
    keywords: [
      'law firm', 'legal services', 'attorneys', 'litigation', 'arbitration', 
      'accounting firm', 'audit services', 'legal',
    ],
  },
  {
    label: 'Other',
    keywords: [],
  },
]

// ─────────────────────────────────────────────
// Function taxonomy — ~15 canonical buckets
// ─────────────────────────────────────────────
export const FUNCTIONS: TaxonomyCategory[] = [
  {
    label: 'Strategy',
    keywords: [
      'strategy', 'strategic planning', 'corporate strategy', 'business strategy',
      'strategic initiatives', 'corporate planning',
    ],
  },
  {
    label: 'Finance & Accounting',
    keywords: [
      'financial planning', 'fp&a', 'treasury', 'accounting', 'audit',
      'tax', 'controller', 'financial analysis', 'valuation', 'cfo',
      'financial reporting', 'budgeting',
    ],
  },
  {
    label: 'Operations & Supply Chain',
    keywords: [
      'operations', 'supply chain', 'procurement', 'logistics', 'sourcing',
      'lean', 'six sigma', 'operational excellence', 'coo', 'process improvement',
    ],
  },
  {
    label: 'Marketing',
    keywords: [
      'marketing', 'brand management', 'communications', 'advertising',
      'digital marketing', 'growth marketing', 'cmo', 'content marketing',
      'public relations',
    ],
  },
  {
    label: 'Sales & Business Development',
    keywords: [
      'sales', 'business development', 'commercial', 'revenue',
      'account management', 'partnerships', 'bd ',
    ],
  },
  {
    label: 'Technology & Engineering',
    keywords: [
      'software engineer', 'software developer', 'data engineer', 'devops',
      'architect', 'cto', 'information technology', 'full stack', 'backend', 'frontend',
    ],
  },
  {
    label: 'Data & Analytics',
    keywords: [
      'data science', 'data analytics', 'machine learning', 'artificial intelligence',
      'business intelligence', 'reporting', 'forecasting', 'data analysis', 'ai ',
    ],
  },
  {
    label: 'Product Management',
    keywords: [
      'product management', 'product manager', 'product owner', 'product strategy', 'roadmap',
    ],
  },
  {
    label: 'Human Resources',
    keywords: [
      'human resources', 'talent management', 'talent acquisition', 'recruitment',
      'organizational development', 'chro', 'learning & development', 'people operations',
      'hr business',
    ],
  },
  {
    label: 'Legal & Compliance',
    keywords: [
      'legal', 'compliance', 'regulatory', 'counsel', 'attorney',
      'contracts', 'general counsel',
    ],
  },
  {
    label: 'Risk Management',
    keywords: [
      'risk management', 'risk analysis', 'credit risk', 'operational risk',
      'market risk', 'enterprise risk',
    ],
  },
  {
    label: 'Corporate Development & M&A',
    keywords: [
      'm&a', 'mergers', 'acquisitions', 'corporate development', 'due diligence',
      'integration', 'divestiture',
    ],
  },
  {
    label: 'Entrepreneurship',
    keywords: [
      'founder', 'co-founder', 'chief executive', 'ceo', 'startup', 'entrepreneurship',
      'entrepreneur',
    ],
  },
  {
    label: 'Sustainability & ESG',
    keywords: [
      'sustainability', 'esg', 'climate', 'environment', 'green ',
      'impact investing', 'csr', 'net zero', 'carbon',
    ],
  },
  {
    label: 'Project Management',
    keywords: [
      'project management', 'program management', 'pmo', 'project manager',
      'delivery management',
    ],
  },
]

// ─────────────────────────────────────────────
// Profile classifier
// ─────────────────────────────────────────────

/**
 * Classify an EnrichedProfile into canonical industry + function buckets.
 * Builds a text corpus from experience, education, skills, and LI data,
 * then matches against each taxonomy's keyword list.
 *
 * Returns only buckets with at least one keyword match.
 */
export function classifyProfile(cv: EnrichedProfile): {
  industries: string[]
  functions: string[]
} {
  // Build a single flat corpus from all relevant text fields
  const parts: (string | null | undefined)[] = [
    // Structured CV experience
    ...((cv.experience ?? []).flatMap((e) => [
      e.entity,
      e.location,
      ...(e.roles ?? []).map((r) => r.role),
      ...(e.description ?? []),
    ])),
    // Education entities
    ...((cv.education ?? []).map((e) => e.entity)),
    // LinkedIn fields
    cv.li_headline,
    cv.li_about,
    cv.li_current_title,
    cv.li_current_company,
    // LinkedIn experience (role, company, description)
    ...((cv.li_experience ?? []).flatMap((e) => [e[0], e[1], e[2] ?? ''])),
    // Skills lists
    ...(cv.skills ?? []),
    ...(cv.li_skills ?? []),
  ]

  const corpus = parts.filter(Boolean).join(' ').toLowerCase()

  const industries = INDUSTRIES.filter(({ keywords }) =>
    keywords.some((kw) => corpus.includes(kw.toLowerCase()))
  ).map(({ label }) => label)

  const functions = FUNCTIONS.filter(({ keywords }) =>
    keywords.some((kw) => corpus.includes(kw.toLowerCase()))
  ).map(({ label }) => label)

  return { industries, functions }
}
