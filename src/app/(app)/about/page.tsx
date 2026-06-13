import { Database, Bot, ShieldAlert, Sparkles, Network, Briefcase, FileText } from 'lucide-react'

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-10 border-b border-gray-100 pb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Methodology & Disclaimers</h1>
        <p className="text-gray-500 text-lg">
          How this application processes CVs, normalizes career paths, and utilizes AI to power
          the INSEAD 26D directory.
        </p>
      </div>

      <div className="space-y-12">
        {/* Section 1: Data Pipeline */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[#003781]/10 rounded-lg">
              <Database className="w-6 h-6 text-[#003781]" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">The Data Pipeline</h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-8">
            
            <div className="grid md:grid-cols-[200px_1fr] gap-4 md:gap-8 items-start">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900 md:justify-end">
                <FileText className="w-4 h-4 text-gray-400" />
                1. CV Ingestion
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">
                <p>
                  Every participant uploaded their standard INSEAD format CV as a PDF. These documents 
                  were passed through <strong>Claude 3.5 Sonnet</strong> to extract structured information 
                  such as education history, career timelines, and explicit skills.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-[200px_1fr] gap-4 md:gap-8 items-start">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900 md:justify-end">
                <Network className="w-4 h-4 text-gray-400" />
                2. LinkedIn Enrichment
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">
                <p>
                  Because CVs are strictly limited to one page and sometimes omit personal details 
                  (like languages or secondary skills), profiles were cross-referenced with public 
                  LinkedIn data to fill in the gaps and provide a more comprehensive overview of each person.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-[200px_1fr] gap-4 md:gap-8 items-start">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900 md:justify-end">
                <Briefcase className="w-4 h-4 text-gray-400" />
                3. Taxonomy Normalization
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">
                <p>
                  Raw job titles vary wildly (e.g., "Strategy Associate", "Manager, Corporate Strategy", "Chief of Staff"). 
                  To make the directory searchable, an AI agent categorized every single role into a standard taxonomy 
                  comprising <strong>13 core functions</strong> and a hierarchical tree of <strong>~150 sub-industries</strong>.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Section 2: AI Features */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Sparkles className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">AI & Market Pulse</h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              The <strong>Career Switch</strong> tab features a "Market Pulse" tool. This feature was generated 
              using <strong>Gemini Pro</strong>, which analyzed millions of modern MBA job descriptions to 
              determine the top 10 most demanded skills across different functions.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              When you explore a potential career switch, the app compares your parsed CV skills against both 
              the actual paths of your INSEAD peers and the live market demand expectations to highlight 
              potential skill gaps. Your skills are categorized into <strong>Strong</strong>, <strong>Normal</strong>, 
              or <strong>Beginner</strong> based on how prominently they featured in your professional experience.
            </p>
          </div>
        </section>

        {/* Section 3: Disclaimers */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[#E4002B]/10 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-[#E4002B]" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">Important Disclaimers</h2>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-red-50 rounded-xl p-5 border border-red-100">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-[#E4002B]" />
                <h3 className="font-bold text-gray-900 text-sm">AI Hallucinations</h3>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">
                LLMs are not perfect. In rare cases, they may miss a language, miscalculate a date range, 
                or incorrectly categorize a niche role. If a classmate's profile looks slightly off, it's 
                likely a parsing artifact rather than a mistake on their CV.
              </p>
            </div>

            <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-orange-700" />
                <h3 className="font-bold text-gray-900 text-sm">Taxonomy Grouping</h3>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">
                To enable the Stats and Career Switch tabs, highly specialized roles had to be mapped into 
                broader buckets. This loss of granularity is intentional for analytics but might oversimplify 
                complex or hybrid careers.
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-[#003781]" />
                <h3 className="font-bold text-gray-900 text-sm">Data Privacy</h3>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">
                This is a private, internal network exclusively for the INSEAD 26D cohort. The data contained 
                herein includes personal career trajectories and contact information. <strong>Do not scrape, 
                export, or share this data externally with recruiters or third parties.</strong>
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
