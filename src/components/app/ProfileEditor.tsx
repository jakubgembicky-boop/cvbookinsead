'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { Camera, Plus, Trash2, GripVertical } from 'lucide-react'
import type { EnrichedProfile, CvEntry, ProfileOverrides } from '@/types'
import { saveOverrides } from '@/app/(app)/profile/actions'

const PROFICIENCY = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Elementary']

interface LangPair {
  lang: string
  level: string
}

function parseLangPair(raw: string): LangPair {
  const m = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (m) return { lang: m[1].trim(), level: m[2].trim() }
  return { lang: raw.trim(), level: '' }
}

function joinLangPair(p: LangPair): string {
  return p.level ? `${p.lang} (${p.level})` : p.lang
}

// ── Repeatable CV-entry editor (experience / education / extra-curricular) ──
function EntryListEditor({
  label,
  entries,
  onChange,
}: {
  label: string
  entries: CvEntry[]
  onChange: (next: CvEntry[]) => void
}) {
  const update = (i: number, patch: Partial<CvEntry>) =>
    onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)))

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
              <GripVertical className="h-3.5 w-3.5" /> {label} #{i + 1}
            </span>
            <button
              onClick={() => onChange(entries.filter((_, j) => j !== i))}
              className="text-gray-400 hover:text-[#E4002B]"
              aria-label="Remove entry"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Organisation / School"
              value={entry.entity}
              onChange={(e) => update(i, { entity: e.target.value })}
            />
            <Input
              label="Location"
              value={entry.location}
              onChange={(e) => update(i, { location: e.target.value })}
            />
          </div>

          {/* Roles */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Roles</p>
            {(entry.roles || []).map((r, ri) => (
              <div key={ri} className="flex items-center gap-2">
                <input
                  value={r.role}
                  onChange={(e) =>
                    update(i, {
                      roles: entry.roles.map((rr, rj) =>
                        rj === ri ? { ...rr, role: e.target.value } : rr
                      ),
                    })
                  }
                  placeholder="Title"
                  className="flex-1 h-9 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003781]"
                />
                <input
                  value={r.years ?? ''}
                  onChange={(e) =>
                    update(i, {
                      roles: entry.roles.map((rr, rj) =>
                        rj === ri ? { ...rr, years: e.target.value } : rr
                      ),
                    })
                  }
                  placeholder="2023 – 2025"
                  className="w-32 h-9 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003781]"
                />
                <button
                  onClick={() =>
                    update(i, { roles: entry.roles.filter((_, rj) => rj !== ri) })
                  }
                  className="p-1.5 text-gray-400 hover:text-[#E4002B]"
                  aria-label="Remove role"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => update(i, { roles: [...(entry.roles || []), { role: '', years: '' }] })}
              className="inline-flex items-center gap-1 text-xs text-[#003781] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add role
            </button>
          </div>

          {/* Bullets */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Description bullets</p>
            {(entry.description || []).map((d, di) => (
              <div key={di} className="flex items-start gap-2">
                <textarea
                  value={d}
                  onChange={(e) =>
                    update(i, {
                      description: (entry.description || []).map((dd, dj) =>
                        dj === di ? e.target.value : dd
                      ),
                    })
                  }
                  rows={2}
                  className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003781]"
                />
                <button
                  onClick={() =>
                    update(i, {
                      description: (entry.description || []).filter((_, dj) => dj !== di),
                    })
                  }
                  className="p-1.5 text-gray-400 hover:text-[#E4002B]"
                  aria-label="Remove bullet"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                update(i, { description: [...(entry.description || []), ''] })
              }
              className="inline-flex items-center gap-1 text-xs text-[#003781] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add bullet
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() =>
          onChange([...entries, { entity: '', location: '', roles: [{ role: '', years: '' }], description: [] }])
        }
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#003781] hover:underline"
      >
        <Plus className="h-4 w-4" /> Add {label.toLowerCase()}
      </button>
    </div>
  )
}

export function ProfileEditor({ initial }: { initial: EnrichedProfile }) {
  const { success, error: toastError } = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  // Identity
  const [name, setName] = useState(initial.name)
  const [nationality, setNationality] = useState(initial.nationality)
  const [photo, setPhoto] = useState<string | null>(initial.photo)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photo)

  // LinkedIn / headline
  const [headline, setHeadline] = useState(initial.li_headline)
  const [about, setAbout] = useState(initial.li_about)
  const [location, setLocation] = useState(initial.li_location)
  const [curTitle, setCurTitle] = useState(initial.li_current_title)
  const [curCompany, setCurCompany] = useState(initial.li_current_company)

  // Contact
  const [linkedin, setLinkedin] = useState(initial.linkedin)
  const [personalEmail, setPersonalEmail] = useState(
    initial.emails.find((e) => !e.toLowerCase().includes('@insead.edu')) ?? ''
  )
  const [phones, setPhones] = useState<string[]>(initial.phones.length ? initial.phones : [''])

  // Languages & skills
  const [langs, setLangs] = useState<LangPair[]>(
    (initial.languages.length ? initial.languages : initial.li_languages).map(parseLangPair)
  )
  const [skills, setSkills] = useState<string[]>(initial.skills)
  const [skillInput, setSkillInput] = useState('')

  // Structured CV
  const [experience, setExperience] = useState<CvEntry[]>(initial.experience)
  const [education, setEducation] = useState<CvEntry[]>(initial.education)
  const [extra, setExtra] = useState<CvEntry[]>(initial.extra_curricular)

  const handleSave = async () => {
    setSaving(true)

    // Upload photo if a new file was chosen
    let photoUrl = photo
    if (photoFile && initial.profileId) {
      const ext = photoFile.name.split('.').pop()
      const filePath = `avatars/${initial.profileId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('profiles')
        .upload(filePath, photoFile, { upsert: true })
      if (!upErr) {
        const { data } = supabase.storage.from('profiles').getPublicUrl(filePath)
        photoUrl = `${data.publicUrl}?v=${Date.now()}`
      } else {
        toastError('Photo upload failed (run migration 002 for storage policies).')
      }
    }

    const payload: ProfileOverrides = {
      name: name.trim(),
      nationality: nationality.trim(),
      photo: photoUrl,
      li_headline: headline.trim(),
      li_about: about.trim(),
      li_location: location.trim(),
      li_current_title: curTitle.trim(),
      li_current_company: curCompany.trim(),
      linkedin: linkedin.trim(),
      personal_email: personalEmail.trim(),
      phones: phones.map((p) => p.trim()).filter(Boolean),
      languages: langs.filter((l) => l.lang.trim()).map(joinLangPair),
      skills: skills.filter(Boolean),
      experience: experience.filter((e) => e.entity.trim()),
      education: education.filter((e) => e.entity.trim()),
      extra_curricular: extra.filter((e) => e.entity.trim()),
    }

    const res = await saveOverrides(payload)
    setSaving(false)
    if (res.ok) {
      success('Profile saved. Your changes are now visible to classmates.')
      setPhoto(photoUrl)
      setPhotoFile(null)
    } else {
      toastError(res.error ?? 'Failed to save.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basics</h2>
        <div className="flex items-center gap-4 mb-5">
          <Avatar name={name} photoUrl={photoPreview} size="lg" />
          <label htmlFor="editor-photo" className="cursor-pointer">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
              <Camera className="h-4 w-4" /> Change photo
            </div>
            <input
              id="editor-photo"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setPhotoFile(f)
                  setPhotoPreview(URL.createObjectURL(f))
                }
              }}
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
        </div>
      </Card>

      {/* Headline / About */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Headline & About</h2>
        <div className="space-y-4">
          <Input label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Current title" value={curTitle} onChange={(e) => setCurTitle(e.target.value)} />
            <Input label="Current company" value={curCompany} onChange={(e) => setCurCompany(e.target.value)} />
          </div>
          <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <div>
            <label className="text-sm font-medium text-gray-700">About</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={6}
              placeholder="Your full bio — this shows in full on your profile."
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003781]"
            />
          </div>
        </div>
      </Card>

      {/* Contact */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
        <div className="space-y-4">
          <div className="p-3 rounded-md bg-[#003781]/5 border border-[#003781]/10">
            <p className="text-xs text-gray-500">INSEAD email (verified, cannot change)</p>
            <p className="font-medium text-gray-900 text-sm">{initial.inseadEmail}</p>
          </div>
          <Input label="LinkedIn URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
          <Input
            label="Personal email"
            type="email"
            value={personalEmail}
            onChange={(e) => setPersonalEmail(e.target.value)}
          />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Phone numbers</p>
            <div className="space-y-2">
              {phones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p}
                    onChange={(e) => setPhones((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="+33 6 12 34 56 78"
                    className="flex-1 h-9 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003781]"
                  />
                  <button
                    onClick={() => setPhones((prev) => prev.filter((_, j) => j !== i))}
                    className="p-1.5 text-gray-400 hover:text-[#E4002B]"
                    aria-label="Remove phone"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setPhones((prev) => [...prev, ''])}
                className="inline-flex items-center gap-1 text-xs text-[#003781] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add phone
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Languages */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Languages</h2>
        <div className="space-y-2">
          {langs.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={l.lang}
                onChange={(e) => setLangs((prev) => prev.map((x, j) => (j === i ? { ...x, lang: e.target.value } : x)))}
                placeholder="Language"
                className="flex-1 h-9 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003781]"
              />
              <select
                value={l.level}
                onChange={(e) => setLangs((prev) => prev.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)))}
                className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003781]"
              >
                <option value="">—</option>
                {PROFICIENCY.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <button
                onClick={() => setLangs((prev) => prev.filter((_, j) => j !== i))}
                className="p-1.5 text-gray-400 hover:text-[#E4002B]"
                aria-label="Remove language"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setLangs((prev) => [...prev, { lang: '', level: 'Professional' }])}
            className="inline-flex items-center gap-1 text-xs text-[#003781] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add language
          </button>
        </div>
      </Card>

      {/* Skills */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {skills.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-[#003781]/8 px-2.5 py-1 text-xs text-[#003781]"
            >
              {s}
              <button
                onClick={() => setSkills((prev) => prev.filter((_, j) => j !== i))}
                className="hover:opacity-70"
                aria-label={`Remove ${s}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && skillInput.trim()) {
                e.preventDefault()
                setSkills((prev) => [...new Set([...prev, skillInput.trim()])])
                setSkillInput('')
              }
            }}
            placeholder="Add a skill and press Enter"
            className="flex-1 h-9 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003781]"
          />
        </div>
      </Card>

      {/* Experience */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Experience</h2>
        <EntryListEditor label="Experience" entries={experience} onChange={setExperience} />
      </Card>

      {/* Education */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Education</h2>
        <EntryListEditor label="Education" entries={education} onChange={setEducation} />
      </Card>

      {/* Extra-curricular */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Extra-curricular</h2>
        <EntryListEditor label="Activity" entries={extra} onChange={setExtra} />
      </Card>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 bg-white/90 backdrop-blur border-t border-gray-100 px-4 py-3 flex items-center justify-end gap-3">
        <p className="text-xs text-gray-400 mr-auto">Changes are visible to classmates after saving.</p>
        <Button onClick={handleSave} loading={saving} size="lg">
          Save all changes
        </Button>
      </div>
    </div>
  )
}
