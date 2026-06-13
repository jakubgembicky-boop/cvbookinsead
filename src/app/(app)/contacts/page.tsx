import { Card } from '@/components/ui/Card'
import { Download, Smartphone, Monitor, Globe, Apple } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedEnrichedProfiles } from '@/lib/enriched-data'
import { ContactsList, type ContactRow } from '@/components/app/ContactsList'

export const dynamic = 'force-dynamic'

const PLATFORMS = [
  {
    icon: <Apple className="h-8 w-8" />,
    name: 'iPhone / Mac',
    steps: [
      'Download the .vcf file above',
      'Open the file — Contacts app opens automatically',
      'Tap "Add All X Contacts"',
      'Done! Selected classmates appear in your Contacts',
    ],
  },
  {
    icon: <Smartphone className="h-8 w-8" />,
    name: 'Android',
    steps: [
      'Download the .vcf file above',
      'Open the file in your file manager',
      'Select "Import contacts" when prompted',
      'Choose the account to import into',
    ],
  },
  {
    icon: <Globe className="h-8 w-8" />,
    name: 'Google Contacts',
    steps: [
      'Download the .vcf file above',
      'Go to contacts.google.com',
      'Click "Import" (left sidebar)',
      'Upload the .vcf file and click "Import"',
    ],
  },
  {
    icon: <Monitor className="h-8 w-8" />,
    name: 'Outlook / Windows',
    steps: [
      'Download the .vcf file above',
      'Open Outlook → People → Import contacts',
      'Select "vCard Files (.vcf)"',
      'Choose the downloaded file and import',
    ],
  },
]

function isInsead(name: string): boolean {
  const l = name.toLowerCase().trim()
  return l.includes('insead') || l === 'mba' || l === 'mba candidate'
}

export default async function ContactsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cached = await getCachedEnrichedProfiles()
  const enriched = cached.map(p => ({
    ...p,
    isSelf: !!(user && p.profileId === user.id)
  }))

  const { data: selections } = user
    ? await supabase.from('contact_selections').select('contact_email').eq('user_id', user.id)
    : { data: null }
  const selectedSet = new Set(
    (selections ?? []).map((r) => (r.contact_email as string).toLowerCase())
  )

  const contacts: ContactRow[] = enriched
    .filter((p) => selectedSet.has(p.inseadEmail.toLowerCase()))
    .map((p) => ({
      name: p.name,
      inseadEmail: p.inseadEmail,
      company:
        p.li_current_company && !isInsead(p.li_current_company)
          ? p.li_current_company
          : (p.experience ?? []).find((e) => e.entity && !isInsead(e.entity))?.entity ?? '',
      photo: p.photo || p.li_photo_url,
    }))

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Contact Book</h1>
      <p className="text-sm text-gray-500 mb-8">
        Star classmates in the directory, then download your personal VCF — only the people you
        actually want in your phone.
      </p>

      {/* Personal selection */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">My contact book</h2>
      <div className="mb-8">
        <ContactsList contacts={contacts} />
      </div>

      {/* Full-cohort download — secondary */}
      <Card padding="md" className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Everyone instead?</h3>
            <p className="text-xs text-gray-500">
              All {enriched.length} classmates · names, emails, phones, LinkedIn
            </p>
          </div>
          <a
            href="/api/contacts/vcf?all=1"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-[#003781]/40 hover:text-[#003781] transition-colors"
          >
            <Download className="h-4 w-4" />
            Download full cohort
          </a>
        </div>
      </Card>

      {/* Privacy notice */}
      <Card padding="md" className="mb-8 border-amber-100 bg-amber-50">
        <p className="text-sm text-amber-800">
          <strong>Privacy reminder:</strong> Contact files contain personal information of your
          classmates. Please keep them confidential and do not share them outside the INSEAD 26D
          cohort.
        </p>
      </Card>

      {/* Import instructions per platform */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Import Instructions</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {PLATFORMS.map((platform) => (
          <Card key={platform.name} padding="md">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[#003781]">{platform.icon}</div>
              <h3 className="font-semibold text-gray-900">{platform.name}</h3>
            </div>
            <ol className="space-y-2">
              {platform.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="flex-shrink-0 font-bold text-[#003781]">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      {/* What's included */}
      <Card padding="md" className="mt-6">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-gray-400">
          What&apos;s included
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {['Full name', 'INSEAD email', 'Phone number', 'Personal email', 'LinkedIn URL', 'Current company'].map(
            (item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-500">✓</span>
                {item}
              </div>
            )
          )}
        </div>
      </Card>
    </div>
  )
}
