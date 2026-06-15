'use client'

export const dynamic = 'force-dynamic'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CheckCircle, ChevronLeft, GraduationCap } from 'lucide-react'
import { z } from 'zod'
import { searchProfilesAction, resolveInseadEmailAction, type CandidateLite } from './actions'

// ----- Types -----
type Step = 1 | 2 | 3 | 4

interface SelectedProfile {
  name: string
  klass: string
  inseadEmail: string
}

// ----- Password schema -----
const passwordSchema = z
  .string()
  .min(12, 'At least 12 characters required')
  .regex(/[A-Z]/, 'Must include at least one uppercase letter')
  .regex(/[a-z]/, 'Must include at least one lowercase letter')
  .regex(/[0-9]/, 'Must include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must include at least one special character')

// Mask an email for display: jakub.gembicky@insead.edu -> j****y@insead.edu
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}${'*'.repeat(Math.max(3, local.length - 2))}${local[local.length - 1]}@${domain}`
}

// ----- Component -----
export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [nameQuery, setNameQuery] = useState('')
  const [candidates, setCandidates] = useState<CandidateLite[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<SelectedProfile | null>(null)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // Step 1: search for name
  const handleSearch = () => {
    if (nameQuery.trim().length < 2) return
    startTransition(async () => {
      setError(null)
      const results = await searchProfilesAction(nameQuery)
      setCandidates(results)
      setSearched(true)
    })
  }

  // Step 1 → 2: select profile, resolve INSEAD email server-side
  const handleSelectCandidate = async (cand: CandidateLite) => {
    setIsLoading(true)
    setError(null)
    const { email, error: resolveError } = await resolveInseadEmailAction(cand.name)
    setIsLoading(false)
    if (!email) {
      setError(resolveError ?? 'Could not resolve your INSEAD email.')
      return
    }
    setSelected({ name: cand.name, klass: cand.klass, inseadEmail: email })
    setStep(2)
  }

  // Step 2: send OTP to the fixed INSEAD email
  const handleSendOtp = async () => {
    if (!selected) return
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: selected.inseadEmail,
      options: { shouldCreateUser: true },
    })

    if (otpError) {
      setError(otpError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setResendCooldown(60)
    setStep(3)
  }

  // Step 3: verify OTP
  const handleVerifyOtp = async () => {
    if (!selected) return
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: selected.inseadEmail,
      token: otp.trim(),
      type: 'email',
    })

    if (verifyError) {
      setError('Invalid or expired code. Please try again.')
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setStep(4)
  }

  // Step 4: set password
  const handleSetPassword = async () => {
    setIsLoading(true)
    setError(null)

    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      setIsLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    router.push('/onboarding')
  }

  return (
    <div className="p-8">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-[#003781]' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Find yourself */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Find your profile</h1>
          <p className="text-sm text-gray-500 mb-6">
            Enter your name to find your INSEAD CV entry.
          </p>

          <div className="space-y-3">
            <Input
              label="Your full name"
              placeholder="e.g. Aaditya Thakral"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button
              className="w-full"
              onClick={handleSearch}
              loading={isPending}
              disabled={nameQuery.trim().length < 2}
            >
              Search
            </Button>
          </div>

          {candidates.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Do you see yourself below?
              </p>
              <div className="space-y-2">
                {candidates.map((cand) => (
                  <button
                    key={cand.name}
                    onClick={() => handleSelectCandidate(cand)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:border-[#003781]/30 hover:bg-[#003781]/5 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#003781] disabled:opacity-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{cand.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        {cand.klass}
                      </p>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-gray-300 rotate-180 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {searched && candidates.length === 0 && !isPending && (
            <p className="mt-4 text-sm text-gray-500 text-center">
              No matches found. Try searching with your full name as it appears on your CV.
            </p>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="text-[#003781] font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Confirm identity + send code */}
      {step === 2 && selected && (
        <div>
          <button
            onClick={() => {
              setStep(1)
              setSelected(null)
              setError(null)
            }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Verify your identity</h1>
          <p className="text-sm text-gray-500 mb-6">
            We&apos;ll send a verification code to your INSEAD email address.
          </p>

          {/* Selected profile card */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#003781]/5 border border-[#003781]/10 mb-4">
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">{selected.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                {selected.klass}
              </p>
            </div>
            <CheckCircle className="h-5 w-5 text-green-500 ml-auto flex-shrink-0" />
          </div>

          <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
            <p className="text-xs text-gray-500">Verification code will be sent to</p>
            <p className="font-medium text-gray-900 text-sm mt-0.5">
              {maskEmail(selected.inseadEmail)}
            </p>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Only your registered INSEAD email can be used to verify your account. If this
            isn&apos;t you, go back and select a different profile.
          </p>

          {error && (
            <div className="mt-3 p-3 rounded-md bg-[#E4002B]/5 border border-[#E4002B]/20">
              <p className="text-sm text-[#E4002B]">{error}</p>
            </div>
          )}

          <Button
            className="w-full mt-5"
            onClick={handleSendOtp}
            loading={isLoading}
            size="lg"
          >
            Send verification code
          </Button>
        </div>
      )}

      {/* Step 3: Enter OTP */}
      {step === 3 && selected && (
        <div>
          <button
            onClick={() => {
              setStep(2)
              setError(null)
            }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Check your inbox</h1>
          <p className="text-sm text-gray-500 mb-4">
            We&apos;ve sent a 6-digit code to{' '}
            <span className="font-medium text-gray-900">{maskEmail(selected.inseadEmail)}</span>.
          </p>

          <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Email not arriving?</p>
            <p>• Check your <span className="font-medium">Junk / Spam</span> folder — corporate email filters often catch it</p>
            <p>• It may take <span className="font-medium">1–2 minutes</span> to arrive</p>
            <p>• If your INSEAD inbox has strict filtering, try the <span className="font-medium">Outlook web app</span> and check Junk</p>
          </div>

          <Input
            label="Verification code"
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="Enter the 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />

          {error && (
            <div className="mt-3 p-3 rounded-md bg-[#E4002B]/5 border border-[#E4002B]/20">
              <p className="text-sm text-[#E4002B]">{error}</p>
            </div>
          )}

          <Button
            className="w-full mt-5"
            onClick={handleVerifyOtp}
            loading={isLoading}
            disabled={otp.length < 6}
            size="lg"
          >
            Verify code
          </Button>

          <button
            onClick={() => {
              setOtp('')
              setError(null)
              handleSendOtp()
            }}
            disabled={resendCooldown > 0}
            className="w-full mt-3 text-sm text-gray-500 hover:text-[#003781] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>
      )}

      {/* Step 4: Set password */}
      {step === 4 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Set your password</h1>
          <p className="text-sm text-gray-500 mb-6">
            Create a strong password for your account.
          </p>

          <div className="space-y-4">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Min 12 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character"
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {/* Password strength hints */}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[
              { label: '12+ characters', ok: password.length >= 12 },
              { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
              { label: 'Lowercase letter', ok: /[a-z]/.test(password) },
              { label: 'Number', ok: /[0-9]/.test(password) },
              { label: 'Special character', ok: /[^A-Za-z0-9]/.test(password) },
            ].map(({ label, ok }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1 text-xs ${
                  ok ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <span>{ok ? '✓' : '○'}</span>
                {label}
              </span>
            ))}
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-md bg-[#E4002B]/5 border border-[#E4002B]/20">
              <p className="text-sm text-[#E4002B]">{error}</p>
            </div>
          )}

          <Button
            className="w-full mt-5"
            onClick={handleSetPassword}
            loading={isLoading}
            size="lg"
          >
            Create account
          </Button>
        </div>
      )}
    </div>
  )
}
