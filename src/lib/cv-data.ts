import fs from 'fs'
import path from 'path'
import type { CvProfile } from '@/types'
import { fuzzyMatch } from '@/lib/utils'

function cvDataPath(): string {
  return path.join(process.cwd(), 'data', 'cvdata.json')
}

let _cachedProfiles: CvProfile[] | null = null

export function getAllProfiles(): CvProfile[] {
  if (_cachedProfiles) return _cachedProfiles
  try {
    _cachedProfiles = JSON.parse(fs.readFileSync(cvDataPath(), 'utf-8')) as CvProfile[]
  } catch {
    _cachedProfiles = []
  }
  return _cachedProfiles
}

export function findProfileByName(query: string): CvProfile[] {
  const profiles = getAllProfiles()
  const names = profiles.map((p) => p.name)
  const matches = fuzzyMatch(query, names)
  return matches
    .map((m) => profiles.find((p) => p.name === m.name))
    .filter((p): p is CvProfile => p != null)
}

export function findProfileByEmail(email: string): CvProfile | null {
  const profiles = getAllProfiles()
  const normalized = email.toLowerCase().trim()
  return (
    profiles.find((p) =>
      p.emails.some((e) => e.toLowerCase().trim() === normalized)
    ) ?? null
  )
}

/**
 * Parse first_name and last_name from a CV name like "Aaditya THAKRAL".
 * last_name = last token if it's all uppercase letters.
 * first_name = everything before the last token.
 */
export function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  const last = parts[parts.length - 1]
  const isAllCaps = /^[A-Z\-']+$/.test(last)
  if (parts.length >= 2 && isAllCaps) {
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: last,
    }
  }
  // Fallback: split at last space
  return {
    firstName: parts.slice(0, -1).join(' ') || fullName,
    lastName: parts[parts.length - 1] || '',
  }
}

/**
 * Extract the first @insead.edu email from a list of emails.
 */
export function extractInseadEmail(emails: string[]): string | null {
  return emails.find((e) => e.toLowerCase().includes('@insead.edu')) ?? null
}
