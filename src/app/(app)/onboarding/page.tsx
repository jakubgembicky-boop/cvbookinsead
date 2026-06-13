'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { Camera, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import type { Profile } from '@/types'

type Step = 1 | 2 | 3

const PROFICIENCY_OPTIONS = ['Elementary', 'Intermediate', 'Professional', 'Fluent', 'Native']

interface LanguageEntry {
  lang: string
  proficiency: string
}

function parseLanguageEntries(langs: string[]): LanguageEntry[] {
  return langs.map((l) => {
    const match = l.match(/^(.+?)\s*\((.+)\)$/)
    if (match) {
      return { lang: match[1].trim(), proficiency: match[2].trim() }
    }
    return { lang: l, proficiency: 'Professional' }
  })
}

export default function OnboardingPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const [step, setStep] = useState<Step>(1)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Step 1 fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nationality, setNationality] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  // Step 2 fields
  const [phone, setPhone] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')

  // Step 3 fields
  const [languages, setLanguages] = useState<LanguageEntry[]>([])

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (prof) {
        setProfile(prof)
        setFirstName(prof.first_name ?? '')
        setLastName(prof.last_name ?? '')
        setNationality(prof.nationality ?? '')
        setPhone(prof.phone ?? '')
        setPersonalEmail(prof.personal_email ?? '')
        setPhotoPreview(prof.photo_url ?? null)
        setLanguages(parseLanguageEntries(prof.languages ?? []))
        // Jump to incomplete step
        if (prof.onboarding_step) {
          setStep((Math.min(prof.onboarding_step + 1, 3)) as Step)
        }
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveStep = async (nextStep: Step | 'done') => {
    if (!profile) {
      toastError(
        'Your profile is not linked yet. Please refresh the page — if this persists, sign out and back in.'
      )
      return
    }
    setSaving(true)

    let updates: Partial<Profile> & { onboarding_step?: number } = {}

    if (step === 1) {
      let photoUrl = profile.photo_url
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const path = `avatars/${profile.id}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('profiles')
          .upload(path, photoFile, { upsert: true })
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('profiles').getPublicUrl(path)
          photoUrl = urlData.publicUrl
        }
      }
      updates = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        nationality: nationality.trim(),
        photo_url: photoUrl,
        onboarding_step: 1,
      }
    } else if (step === 2) {
      updates = {
        phone: phone.trim() || null,
        personal_email: personalEmail.trim() || null,
        onboarding_step: 2,
      }
    } else if (step === 3) {
      const langStrings = languages
        .filter((l) => l.lang.trim())
        .map((l) => `${l.lang} (${l.proficiency})`)
      updates = {
        languages: langStrings,
        onboarding_step: 3,
        profile_completed_at: new Date().toISOString(),
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates as Record<string, unknown>)
      .eq('id', profile.id)

    if (error) {
      toastError('Failed to save. Please try again.')
      setSaving(false)
      return
    }

    setSaving(false)

    if (nextStep === 'done') {
      success('Profile completed! Welcome to INSEAD 26D.')
      // Hard navigation so the shared (app) layout re-renders with fresh
      // profile data (profile_completed_at now set). A client-side
      // router.push reuses the cached layout and bounces back to onboarding.
      window.location.href = '/'
    } else {
      setStep(nextStep)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 rounded-full border-2 border-[#003781] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {/* Progress */}
      <div className="mb-8">
        <p className="text-sm text-[#003781] font-medium mb-3">
          Step {step} of 3 — {['Confirm Profile', 'Contact Details', 'Languages'][step - 1]}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[#003781]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Confirm Your Profile</h1>
            <p className="text-sm text-gray-500 mt-1">
              Review and edit your basic information.
            </p>
          </div>

          {/* Photo upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar
                name={`${firstName} ${lastName}`}
                photoUrl={photoPreview}
                size="xl"
                className="h-24 w-24"
              />
              <label
                htmlFor="photo-upload"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[#003781] flex items-center justify-center cursor-pointer hover:bg-[#002a61] shadow-sm"
              >
                <Camera className="h-4 w-4 text-white" />
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setPhotoFile(file)
                    setPhotoPreview(URL.createObjectURL(file))
                  }
                }}
              />
            </div>
            <p className="text-xs text-gray-400">Click the camera to upload a photo</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <Input
            label="Nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="e.g. French, British"
          />

          <Button
            className="w-full"
            size="lg"
            onClick={() => saveStep(2)}
            loading={saving}
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contact Details</h1>
            <p className="text-sm text-gray-500 mt-1">
              Confirm how classmates can reach you.
            </p>
          </div>

          <div className="p-3 rounded-md bg-[#003781]/5 border border-[#003781]/10">
            <p className="text-xs text-gray-500">INSEAD email (verified)</p>
            <p className="font-medium text-gray-900 text-sm mt-0.5">{profile?.insead_email}</p>
          </div>

          <Input
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 234 567 8900"
            hint="Visible to classmates"
          />

          <Input
            label="Personal email (optional)"
            type="email"
            value={personalEmail}
            onChange={(e) => setPersonalEmail(e.target.value)}
            placeholder="your@gmail.com"
            hint="Alternative contact email"
          />

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1" size="lg">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="flex-1" size="lg" onClick={() => saveStep(3)} loading={saving}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Languages</h1>
            <p className="text-sm text-gray-500 mt-1">
              Update your language proficiencies.
            </p>
          </div>

          <div className="space-y-3">
            {languages.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={entry.lang}
                  onChange={(e) =>
                    setLanguages((prev) =>
                      prev.map((l, j) => (j === i ? { ...l, lang: e.target.value } : l))
                    )
                  }
                  placeholder="Language"
                  className="flex-1"
                />
                <select
                  value={entry.proficiency}
                  onChange={(e) =>
                    setLanguages((prev) =>
                      prev.map((l, j) =>
                        j === i ? { ...l, proficiency: e.target.value } : l
                      )
                    )
                  }
                  className="h-10 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#003781]"
                >
                  {PROFICIENCY_OPTIONS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    setLanguages((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="p-2 text-gray-400 hover:text-[#E4002B]"
                  aria-label="Remove language"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              onClick={() =>
                setLanguages((prev) => [...prev, { lang: '', proficiency: 'Professional' }])
              }
              className="inline-flex items-center gap-1.5 text-sm text-[#003781] hover:underline"
            >
              <Plus className="h-4 w-4" />
              Add language
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1" size="lg">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="flex-1" size="lg" onClick={() => saveStep('done')} loading={saving}>
              Complete setup
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
