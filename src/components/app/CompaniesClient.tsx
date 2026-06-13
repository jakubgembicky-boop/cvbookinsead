'use client'

import { useState, useMemo } from 'react'
import type { EnrichedProfile } from '@/types'
import { extractCareerSteps } from '@/lib/aggregate'
import { Card } from '@/components/ui/Card'
import { PhotoAvatar } from '@/components/app/PhotoAvatar'
import { ProfileModal } from '@/components/app/ProfileModal'
import { Search, Users, ChevronDown, ChevronUp } from 'lucide-react'

interface CompanyPerson {
  profile: EnrichedProfile
  latestRole: string
  totalDuration: number
}

interface CompanyAgg {
  name: string
  people: CompanyPerson[]
}

export function CompaniesClient({ profiles }: { profiles: EnrichedProfile[] }) {
  const [search, setSearch] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<EnrichedProfile | null>(null)
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)

  const companies = useMemo(() => {
    const map = new Map<string, Map<string, CompanyPerson>>()
    
    for (const p of profiles) {
      const steps = extractCareerSteps(p)
      for (const step of steps) {
        if (!step.company) continue
        if (!map.has(step.company)) {
          map.set(step.company, new Map())
        }
        const companyMap = map.get(step.company)!
        
        if (companyMap.has(p.inseadEmail)) {
          // If they have multiple roles, we just add duration. 
          // extractCareerSteps is most recent first, so the first one we see is latestRole
          const existing = companyMap.get(p.inseadEmail)!
          existing.totalDuration += step.durationYears
        } else {
          companyMap.set(p.inseadEmail, {
            profile: p,
            latestRole: step.role,
            totalDuration: step.durationYears
          })
        }
      }
    }

    const arr: CompanyAgg[] = []
    for (const [name, peopleMap] of map.entries()) {
      arr.push({
        name,
        people: Array.from(peopleMap.values()).sort((a, b) => b.totalDuration - a.totalDuration)
      })
    }
    
    // Sort by number of people descending, then alphabetically
    return arr.sort((a, b) => {
      if (b.people.length !== a.people.length) return b.people.length - a.people.length
      return a.name.localeCompare(b.name)
    })
  }, [profiles])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return companies
    return companies.filter(c => c.name.toLowerCase().includes(q) || c.people.some(p => p.profile.name.toLowerCase().includes(q) || p.latestRole.toLowerCase().includes(q)))
  }, [companies, search])

  return (
    <div>
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search companies, roles, or people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003781] focus:border-transparent transition-all shadow-sm"
        />
      </div>

      <div className="space-y-4">
        {filtered.slice(0, 50).map(company => {
          const isExpanded = expandedCompany === company.name
          const topAvatars = company.people.slice(0, 5)
          
          return (
            <Card key={company.name} className="overflow-hidden transition-all hover:shadow-md">
              <button
                onClick={() => setExpandedCompany(isExpanded ? null : company.name)}
                className="w-full text-left px-6 py-5 flex items-center justify-between bg-white"
              >
                <div className="flex items-center gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Users className="h-4 w-4 mr-1.5" />
                      {company.people.length} classmate{company.people.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2 mr-2">
                    {topAvatars.map((person, i) => (
                      <div key={i} className="relative z-10 hover:z-20 transition-z">
                        <PhotoAvatar
                          src={person.profile.photo}
                          name={person.profile.name}
                          size={32}
                          ring="ring-2 ring-white"
                        />
                      </div>
                    ))}
                    {company.people.length > 5 && (
                      <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600 relative z-0">
                        +{company.people.length - 5}
                      </div>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 pt-2 bg-gray-50/50 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {company.people.map(person => (
                      <button
                        key={person.profile.inseadEmail}
                        onClick={() => setSelectedProfile(person.profile)}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all text-left"
                      >
                        <PhotoAvatar
                          src={person.profile.photo}
                          name={person.profile.name}
                          size={40}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {person.profile.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-0.5">
                            {person.latestRole}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {person.totalDuration > 0 ? `${person.totalDuration.toFixed(1)} years` : '< 1 year'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
        
        {filtered.length > 50 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Showing top 50 of {filtered.length} companies. Use search to find more.
          </div>
        )}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No companies found matching "{search}"
          </div>
        )}
      </div>

      {selectedProfile && (
        <ProfileModal
          cv={selectedProfile}
          terms={[]}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </div>
  )
}
