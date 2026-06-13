// vCard (.vcf) generation — TypeScript port of insead-cvbook/generate_contacts.py
import type { EnrichedProfile } from '@/types'

const GROUP_TAG = 'INSEAD 26D'

function vcfEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

/**
 * Split "Firstname LASTNAME" into (first, last).
 * INSEAD CVs often use ALL-CAPS surnames — title-case them.
 */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: full, last: '' }
  const lastTok = parts[parts.length - 1]
  if (lastTok === lastTok.toUpperCase() && lastTok.length > 1) {
    const title = (s: string) =>
      s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s
    return {
      first: parts.slice(0, -1).map(title).join(' '),
      last: title(lastTok),
    }
  }
  return { first: parts.slice(0, -1).join(' '), last: lastTok }
}

/** Normalise phone: keep +, digits, spaces. */
function cleanPhone(raw: string): string {
  return raw.replace(/[^\d\s+]/g, '').trim()
}

/** Non-French numbers first when mixed with +33 (matches the Python script). */
function orderPhones(phones: string[]): string[] {
  if (phones.length <= 1) return phones
  const isFr = (p: string) => p.replace(/\s/g, '').startsWith('+33')
  const french = phones.filter(isFr)
  const other = phones.filter((p) => !isFr(p))
  return french.length && other.length ? [...other, ...french] : phones
}

function isInseadCompany(name: string): boolean {
  const l = name.toLowerCase().trim()
  return l.includes('insead') || l === 'mba' || l === 'mba candidate'
}

export function makeVcard(cv: EnrichedProfile): string {
  const { first, last } = splitName(cv.name)
  const display = `${first} ${last}`.trim()

  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcfEscape(display)}`, `N:${vcfEscape(last)};${vcfEscape(first)};;;`]

  const company = cv.li_current_company && !isInseadCompany(cv.li_current_company)
    ? cv.li_current_company
    : ''
  if (company) lines.push(`ORG:${vcfEscape(company)}`)

  lines.push(`NOTE:${vcfEscape(GROUP_TAG)}`)

  ;(cv.emails ?? []).forEach((raw, i) => {
    const email = raw.trim()
    if (!email) return
    const pref = i === 0 ? ';PREF=1' : ''
    const type = email.toLowerCase().includes('insead') ? 'WORK' : 'HOME'
    lines.push(`EMAIL;TYPE=${type}${pref}:${vcfEscape(email)}`)
  })

  const phones = orderPhones((cv.phones ?? []).map(cleanPhone).filter(Boolean))
  phones.forEach((phone, i) => {
    const pref = i === 0 ? ';PREF=1' : ''
    lines.push(`TEL;TYPE=CELL${pref}:${phone}`)
  })

  if (cv.linkedin) lines.push(`URL;TYPE=LinkedIn:${vcfEscape(cv.linkedin.trim())}`)

  lines.push('END:VCARD')
  return lines.join('\r\n') + '\r\n'
}

export function makeVcf(profiles: EnrichedProfile[]): string {
  return profiles.map(makeVcard).join('')
}
