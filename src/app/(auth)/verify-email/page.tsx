'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Mail } from 'lucide-react'

const RESEND_COOLDOWN_SECONDS = 60

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [cooldown, setCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleResend = async () => {
    if (!email || cooldown > 0) return
    setResendStatus('sending')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    if (error) {
      setResendStatus('error')
    } else {
      setResendStatus('sent')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    }
  }

  return (
    <div className="p-8 text-center">
      {/* Icon */}
      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#003781]/10 mb-6">
        <Mail className="h-8 w-8 text-[#003781]" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h1>

      {email ? (
        <p className="text-sm text-gray-500 mb-6">
          We sent a verification link to{' '}
          <span className="font-medium text-gray-900">{email}</span>.
          {' '}Click the link in the email to continue.
        </p>
      ) : (
        <p className="text-sm text-gray-500 mb-6">
          A verification email has been sent. Click the link in the email to continue.
        </p>
      )}

      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Didn&apos;t receive it?</p>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Check your spam / junk folder</li>
          <li>• Make sure you entered the right email</li>
          <li>• Wait a few minutes and try resending</li>
        </ul>
      </div>

      {email && (
        <Button
          variant="secondary"
          className="w-full mb-3"
          onClick={handleResend}
          loading={resendStatus === 'sending'}
          disabled={cooldown > 0 || resendStatus === 'sending'}
        >
          {cooldown > 0
            ? `Resend in ${cooldown}s`
            : resendStatus === 'sent'
            ? 'Sent!'
            : 'Resend verification email'}
        </Button>
      )}

      {resendStatus === 'error' && (
        <p className="text-sm text-[#E4002B] mb-3">
          Failed to resend. Please try again.
        </p>
      )}

      <Link
        href="/register"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Wrong email? Go back
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#003781]/10 mb-6">
            <Mail className="h-8 w-8 text-[#003781]" />
          </div>
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
