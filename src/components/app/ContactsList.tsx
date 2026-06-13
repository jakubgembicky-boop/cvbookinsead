'use client'

import { useState } from 'react'
import { X, Download, Star } from 'lucide-react'
import { toggleContactSelection } from '@/app/(app)/contacts/actions'
import { PhotoAvatar } from './PhotoAvatar'
import Link from 'next/link'

export interface ContactRow {
  name: string
  inseadEmail: string
  company: string
  photo: string | null
}

export function ContactsList({ contacts }: { contacts: ContactRow[] }) {
  const [rows, setRows] = useState(contacts)

  function remove(email: string) {
    setRows((prev) => prev.filter((r) => r.inseadEmail.toLowerCase() !== email.toLowerCase()))
    toggleContactSelection(email, false).then((res) => {
      if (!res.ok) setRows(contacts) // revert to server state on failure
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
        <Star className="mx-auto h-8 w-8 text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">
          No contacts selected yet. Star people in the{' '}
          <Link href="/" className="text-[#003781] hover:underline font-medium">
            directory
          </Link>{' '}
          to build your personal contact book.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {rows.length} {rows.length === 1 ? 'contact' : 'contacts'} selected
        </p>
        <a
          href="/api/contacts/vcf"
          className="inline-flex items-center gap-2 rounded-xl bg-[#003781] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#002a61] transition-colors"
        >
          <Download className="h-4 w-4" />
          Download my contacts (.vcf)
        </a>
      </div>

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
        {rows.map((c) => (
          <div key={c.inseadEmail} className="flex items-center gap-3 px-4 py-3">
            <PhotoAvatar src={c.photo} name={c.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {c.company ? `${c.company} · ` : ''}
                {c.inseadEmail}
              </p>
            </div>
            <button
              onClick={() => remove(c.inseadEmail)}
              title="Remove from my contact book"
              aria-label={`Remove ${c.name}`}
              className="rounded-full p-1.5 text-gray-300 hover:text-[#E4002B] hover:bg-red-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
