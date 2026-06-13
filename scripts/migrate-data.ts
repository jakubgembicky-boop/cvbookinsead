#!/usr/bin/env ts-node
/**
 * Data migration script — reads cvdata.json and linkedin_enrichment.json,
 * then upserts into Supabase public.profiles.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/migrate-data.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') })

// ---------------------------------------------------------------------------
// Types (inline to avoid Next.js path resolution issues in this script)
// ---------------------------------------------------------------------------
interface CvRole {
  role: string
  years?: string
  dates?: string
}

interface CvEntry {
  entity: string
  location: string
  roles: CvRole[]
  description?: string[]
}

interface CvProfile {
  name: string
  linkedin: string
  emails: string[]
  phones: string[]
  education: CvEntry[]
  experience: CvEntry[]
  languages: string[]
  skills: string[]
  nationality: string
  photo?: string | null
  page: number
}

interface LinkedInEntry {
  url: string
  scraped_at: string
  li_name: string
  li_headline: string | null
  li_about: string | null
  li_location: string | null
  li_photo_url: string | null
  li_languages: string[]
  li_experience: [string, string, string, string?][]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  const last = parts[parts.length - 1]
  const isAllCaps = /^[A-Z\-']+$/.test(last)
  if (parts.length >= 2 && isAllCaps) {
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: last,
    }
  }
  return {
    firstName: parts.slice(0, -1).join(' ') || fullName,
    lastName: parts[parts.length - 1] || '',
  }
}

function extractInseadEmail(emails: string[]): string | null {
  return emails.find((e) => e.toLowerCase().includes('@insead.edu')) ?? null
}

function linkedinKeyFromUrl(url: string): string | null {
  try {
    const u = url.startsWith('http') ? url : 'https://' + url
    const match = new URL(u).pathname.match(/\/in\/([^/]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
    )
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // Read source data
  const cvDataPath = path.join(__dirname, '..', 'data', 'cvdata.json')
  const liDataPath = path.join(__dirname, '..', 'data', 'linkedin_enrichment.json')

  console.log(`Reading CV data from: ${cvDataPath}`)
  const cvProfiles: CvProfile[] = JSON.parse(fs.readFileSync(cvDataPath, 'utf-8'))

  console.log(`Reading LinkedIn enrichment from: ${liDataPath}`)
  const liEnrichment: Record<string, LinkedInEntry> = JSON.parse(
    fs.readFileSync(liDataPath, 'utf-8')
  )

  console.log(`\nFound ${cvProfiles.length} CV profiles`)
  console.log(`Found ${Object.keys(liEnrichment).length} LinkedIn entries`)

  let upserted = 0
  let skipped = 0
  let errors = 0

  for (const cv of cvProfiles) {
    const inseadEmail = extractInseadEmail(cv.emails)
    if (!inseadEmail) {
      console.warn(`  [SKIP] No INSEAD email for: ${cv.name}`)
      skipped++
      continue
    }

    const { firstName, lastName } = parseName(cv.name)
    const liKey = linkedinKeyFromUrl(cv.linkedin)
    const liData = liKey ? liEnrichment[liKey] : null

    const row = {
      insead_email: inseadEmail,
      first_name: firstName,
      last_name: lastName,
      phone: cv.phones[0] ?? null,
      personal_email:
        cv.emails.find((e) => !e.toLowerCase().includes('@insead.edu')) ?? null,
      linkedin_url: cv.linkedin || null,
      photo_url: liData?.li_photo_url ?? cv.photo ?? null,
      languages: cv.languages,
      nationality: cv.nationality || null,
      // LinkedIn enrichment
      li_headline: liData?.li_headline ?? null,
      li_location: liData?.li_location ?? null,
      li_about: liData?.li_about ?? null,
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'insead_email', ignoreDuplicates: false })

    if (error) {
      console.error(`  [ERROR] ${cv.name}: ${error.message}`)
      errors++
    } else {
      console.log(`  [OK] ${cv.name} <${inseadEmail}>`)
      upserted++
    }
  }

  console.log('\n--- Migration complete ---')
  console.log(`Upserted: ${upserted}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Errors:   ${errors}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
