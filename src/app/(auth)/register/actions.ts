'use server'

import crypto from 'crypto'

// ── Types ──────────────────────────────────────────────────────────────────

export interface LookupResult {
  name: string
  maskedPhones: string[]  // e.g. ["+44 **** *** 789"]
  rawPhones: string[]     // full numbers, needed to validate selection server-side
  noPhone: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return phone
  const visible = digits.slice(-3)
  const masked = '*'.repeat(digits.length - 3)
  // Reconstruct with country code prefix if present
  const prefix = phone.startsWith('+') ? '+' + digits.slice(0, digits.length - digits.replace(/^\d+/, '').length - digits.length + (digits.length - 3)) : ''
  return (phone.startsWith('+') ? '+' : '') + masked + visible
}

function hashOtp(otp: string, salt: string): string {
  return crypto.createHash('sha256').update(otp + salt).digest('hex')
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ── Server actions ─────────────────────────────────────────────────────────

/**
 * Step 1: Validate an INSEAD email and return the person's name + masked phones.
 * No email is sent. Only confirms the email is on the CV list.
 */
export async function lookupByInseadEmail(
  email: string
): Promise<{ ok: true; result: LookupResult } | { ok: false; error: string }> {
  const { getAllProfiles, extractInseadEmail } = await import('@/lib/cv-data')
  const norm = email.trim().toLowerCase()

  if (!norm.endsWith('@insead.edu')) {
    return { ok: false, error: 'Please enter your @insead.edu email address.' }
  }

  const profiles = getAllProfiles()
  const profile = profiles.find(
    (p) => extractInseadEmail(p.emails)?.toLowerCase() === norm
  )

  if (!profile) {
    return {
      ok: false,
      error: 'No CV entry found for this INSEAD email. Check the spelling or contact the administrator.',
    }
  }

  const phones: string[] = (profile.phones ?? []).filter((p) => p.trim())

  return {
    ok: true,
    result: {
      name: profile.name,
      maskedPhones: phones.map(maskPhone),
      rawPhones: phones,
      noPhone: phones.length === 0,
    },
  }
}

/**
 * Step 2: Send an SMS OTP to the selected phone via Twilio.
 * The phone must match one from the CV data (validated server-side).
 */
export async function sendSmsOtp(
  inseadEmail: string,
  phoneIndex: number
): Promise<{ ok: boolean; error?: string }> {
  // Re-validate the email and get phones server-side (don't trust client)
  const lookup = await lookupByInseadEmail(inseadEmail)
  if (!lookup.ok) return { ok: false, error: lookup.error }
  const phones = lookup.result.rawPhones
  if (phoneIndex < 0 || phoneIndex >= phones.length) {
    return { ok: false, error: 'Invalid phone selection.' }
  }
  const phone = phones[phoneIndex]

  // Rate-limit: max 3 OTPs per email per 10 minutes
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { count } = await admin
    .from('phone_otps')
    .select('*', { count: 'exact', head: true })
    .eq('insead_email', inseadEmail.toLowerCase())
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
  if ((count ?? 0) >= 3) {
    return { ok: false, error: 'Too many codes sent. Please wait 10 minutes before trying again.' }
  }

  // Generate and store OTP
  const otp = generateOtp()
  const salt = crypto.randomBytes(16).toString('hex')
  const otp_hash = hashOtp(otp, salt) + ':' + salt  // store hash:salt

  await admin.from('phone_otps').insert({
    insead_email: inseadEmail.toLowerCase(),
    phone,
    otp_hash,
  })

  // Send via Twilio
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const fromNumber = process.env.TWILIO_PHONE_NUMBER!

  const body = `Your INSEAD CVBook verification code is: ${otp}\n\nValid for 10 minutes.`
  const params = new URLSearchParams({ To: phone, From: fromNumber, Body: body })

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  )

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    console.error('Twilio error:', err)
    return { ok: false, error: 'Failed to send SMS. Please try again.' }
  }

  return { ok: true }
}

/**
 * Step 3: Verify the SMS OTP. On success, creates/confirms the Supabase auth
 * user with the INSEAD email and returns a magic link for the client to follow.
 */
export async function verifySmsOtp(
  inseadEmail: string,
  phoneIndex: number,
  otp: string
): Promise<{ ok: true; actionLink: string } | { ok: false; error: string }> {
  const lookup = await lookupByInseadEmail(inseadEmail)
  if (!lookup.ok) return { ok: false, error: lookup.error }
  const phones = lookup.result.rawPhones
  if (phoneIndex < 0 || phoneIndex >= phones.length) {
    return { ok: false, error: 'Invalid phone selection.' }
  }
  const phone = phones[phoneIndex]
  const email = inseadEmail.toLowerCase()

  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find a valid, non-expired OTP row for this email+phone
  const { data: rows } = await admin
    .from('phone_otps')
    .select('id, otp_hash, attempts, expires_at')
    .eq('insead_email', email)
    .eq('phone', phone)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  const row = rows?.[0]
  if (!row) return { ok: false, error: 'Code expired or not found. Request a new one.' }

  if (row.attempts >= 5) {
    return { ok: false, error: 'Too many incorrect attempts. Request a new code.' }
  }

  // Verify hash
  const [hash, salt] = (row.otp_hash as string).split(':')
  const expected = hashOtp(otp.trim(), salt)
  if (expected !== hash) {
    await admin.from('phone_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id)
    const left = 4 - row.attempts
    return { ok: false, error: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.` }
  }

  // Invalidate OTP
  await admin.from('phone_otps').delete().eq('id', row.id)

  // Create or confirm the auth user with the INSEAD email
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existing = existingUsers?.users.find((u) => u.email?.toLowerCase() === email)

  let userId: string
  if (existing) {
    // Confirm the existing unconfirmed user
    const { data: updated, error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
    })
    if (error || !updated.user) return { ok: false, error: 'Failed to confirm account. Please contact the administrator.' }
    userId = updated.user.id
  } else {
    // Create a new confirmed user
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (error || !created.user) return { ok: false, error: 'Failed to create account. Please contact the administrator.' }
    userId = created.user.id
  }

  // Generate a magic link so the client can establish a session without email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/register/set-password` },
  })
  if (linkError || !linkData?.properties?.action_link) {
    return { ok: false, error: 'Account confirmed but could not generate login link. Try logging in.' }
  }

  return { ok: true, actionLink: linkData.properties.action_link }
}
