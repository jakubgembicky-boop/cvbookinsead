'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

const passwordSchema = z
  .string()
  .min(12, 'At least 12 characters required')
  .regex(/[A-Z]/, 'Must include at least one uppercase letter')
  .regex(/[a-z]/, 'Must include at least one lowercase letter')
  .regex(/[0-9]/, 'Must include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must include at least one special character')

type PageState = 'loading' | 'form' | 'success' | 'error'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = searchParams.get('code')
  const [pageState, setPageState] = useState<PageState>(code ? 'loading' : 'error')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!code) return

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      setPageState(error ? 'error' : 'form')
    })
  }, [code])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    setPageState('success')
    setIsLoading(false)

    // Auto-redirect after 2 seconds
    setTimeout(() => router.push('/login?reset=success'), 2000)
  }

  if (pageState === 'loading') {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-gray-50 mb-5">
          <div className="h-6 w-6 rounded-full border-2 border-[#003781] border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-gray-500">Verifying your reset link…</p>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-[#E4002B]/10 mb-5">
          <AlertCircle className="h-7 w-7 text-[#E4002B]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired or invalid</h1>
        <p className="text-sm text-gray-500 mb-6">
          This password reset link is no longer valid. Please request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm text-[#003781] font-medium hover:underline">
          Request new link
        </Link>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-50 mb-5">
          <CheckCircle className="h-7 w-7 text-green-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h1>
        <p className="text-sm text-gray-500">
          Redirecting you to sign in…
        </p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Set new password</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="relative">
          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            hint="Min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••••••"
        />

        {/* Strength indicators */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: '12+ characters', ok: password.length >= 12 },
            { label: 'Uppercase', ok: /[A-Z]/.test(password) },
            { label: 'Lowercase', ok: /[a-z]/.test(password) },
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
          <div className="p-3 rounded-md bg-[#E4002B]/5 border border-[#E4002B]/20">
            <p className="text-sm text-[#E4002B]">{error}</p>
          </div>
        )}

        <Button type="submit" className="w-full" loading={isLoading} size="lg">
          Set new password
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center">
          <div className="h-6 w-6 rounded-full border-2 border-[#003781] border-t-transparent animate-spin mx-auto" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
