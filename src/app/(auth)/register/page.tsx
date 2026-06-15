'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle, ChevronLeft, GraduationCap, Phone } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { lookupByInseadEmail, sendSmsOtp, verifySmsOtp, type LookupResult } from './actions'

type Step = 1 | 2 | 3

const emailSchema = z.string().email().endsWith('@insead.edu')

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [, startTransition] = useTransition()

  // Step 1
  const [emailInput, setEmailInput] = useState('')

  // Step 2
  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const [selectedPhone, setSelectedPhone] = useState(0)
  const [smsSent, setSmsSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Step 3
  const [otp, setOtp] = useState('')

  // Countdown for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // ── Step 1: look up INSEAD email ──────────────────────────────────────────
  async function handleLookup() {
    const parsed = emailSchema.safeParse(emailInput.trim().toLowerCase())
    if (!parsed.success) {
      setError('Please enter a valid @insead.edu email address.')
      return
    }
    setIsLoading(true)
    setError(null)
    const res = await lookupByInseadEmail(emailInput.trim())
    setIsLoading(false)
    if (!res.ok) { setError(res.error); return }
    setLookup(res.result)
    setStep(2)
  }

  // ── Step 2: send SMS ──────────────────────────────────────────────────────
  async function handleSendSms() {
    if (!lookup) return
    setIsLoading(true)
    setError(null)
    const res = await sendSmsOtp(emailInput.trim(), selectedPhone)
    setIsLoading(false)
    if (!res.ok) { setError(res.error ?? 'Failed to send SMS.'); return }
    setSmsSent(true)
    setResendCooldown(60)
    setStep(3)
  }

  async function handleResendSms() {
    if (!lookup || resendCooldown > 0) return
    setIsLoading(true)
    setError(null)
    setOtp('')
    const res = await sendSmsOtp(emailInput.trim(), selectedPhone)
    setIsLoading(false)
    if (!res.ok) { setError(res.error ?? 'Failed to send SMS.'); return }
    setResendCooldown(60)
  }

  // ── Step 3: verify OTP and redirect ──────────────────────────────────────
  async function handleVerifyOtp() {
    if (!lookup) return
    setIsLoading(true)
    setError(null)
    const res = await verifySmsOtp(emailInput.trim(), selectedPhone, otp)
    setIsLoading(false)
    if (!res.ok) { setError(res.error); return }
    // Follow the magic link — this sets the Supabase session cookie and
    // redirects to /register/set-password
    window.location.href = res.actionLink
  }

  return (
    <div className="p-8">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-[#003781]' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* ── Step 1: Enter INSEAD email ──────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 mb-6">
            Enter your INSEAD email to get started. We&apos;ll verify your identity via SMS.
          </p>

          <Input
            label="INSEAD email"
            type="email"
            placeholder="firstname.lastname@insead.edu"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            autoComplete="email"
          />

          {error && (
            <div className="mt-3 p-3 rounded-md bg-[#E4002B]/5 border border-[#E4002B]/20">
              <p className="text-sm text-[#E4002B]">{error}</p>
            </div>
          )}

          <Button
            className="w-full mt-4"
            onClick={handleLookup}
            loading={isLoading}
            disabled={emailInput.trim().length < 6}
            size="lg"
          >
            Continue
          </Button>

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

      {/* ── Step 2: Select phone number ─────────────────────────────────── */}
      {step === 2 && lookup && (
        <div>
          <button
            onClick={() => { setStep(1); setLookup(null); setError(null) }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Verify your identity</h1>
          <p className="text-sm text-gray-500 mb-5">
            We found your profile. We&apos;ll send a verification code to one of your registered phone numbers.
          </p>

          {/* Identity card */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#003781]/5 border border-[#003781]/10 mb-5">
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">{lookup.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <GraduationCap className="h-3 w-3" /> INSEAD MBA 26D
              </p>
            </div>
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          </div>

          {lookup.noPhone ? (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <p className="font-semibold mb-1">No phone number on file</p>
              <p>Your CV doesn&apos;t include a phone number. Please contact the administrator to complete registration.</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700 mb-2">Send verification code to:</p>
              <div className="space-y-2 mb-5">
                {lookup.maskedPhones.map((masked, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPhone(i)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      selectedPhone === i
                        ? 'border-[#003781] bg-[#003781]/5'
                        : 'border-gray-200 hover:border-[#003781]/40'
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                      selectedPhone === i ? 'bg-[#003781] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 font-mono">{masked}</span>
                    {selectedPhone === i && (
                      <CheckCircle className="h-4 w-4 text-[#003781] ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-3 p-3 rounded-md bg-[#E4002B]/5 border border-[#E4002B]/20">
                  <p className="text-sm text-[#E4002B]">{error}</p>
                </div>
              )}

              <Button className="w-full" onClick={handleSendSms} loading={isLoading} size="lg">
                Send SMS code
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Enter SMS code ───────────────────────────────────────── */}
      {step === 3 && lookup && (
        <div>
          <button
            onClick={() => { setStep(2); setOtp(''); setError(null) }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Enter the code</h1>
          <p className="text-sm text-gray-500 mb-5">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-gray-900 font-mono">
              {lookup.maskedPhones[selectedPhone]}
            </span>
            . It&apos;s valid for 10 minutes.
          </p>

          <Input
            label="Verification code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && handleVerifyOtp()}
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
            Verify & continue
          </Button>

          <button
            onClick={handleResendSms}
            disabled={resendCooldown > 0 || isLoading}
            className="w-full mt-3 text-sm text-gray-500 hover:text-[#003781] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>
      )}
    </div>
  )
}
