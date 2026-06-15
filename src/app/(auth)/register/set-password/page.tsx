'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(12, 'At least 12 characters required')
  .regex(/[A-Z]/, 'Must include at least one uppercase letter')
  .regex(/[a-z]/, 'Must include at least one lowercase letter')
  .regex(/[0-9]/, 'Must include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must include at least one special character')

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSetPassword() {
    setError(null)
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setIsLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsLoading(false)

    if (updateError) { setError(updateError.message); return }
    router.push('/onboarding')
  }

  const checks = [
    { label: '12+ characters', ok: password.length >= 12 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'Number', ok: /[0-9]/.test(password) },
    { label: 'Special character', ok: /[^A-Za-z0-9]/.test(password) },
  ]

  return (
    <div className="p-8">
      {/* Full progress bar */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="h-1.5 flex-1 rounded-full bg-[#003781]" />
        ))}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Set your password</h1>
      <p className="text-sm text-gray-500 mb-6">
        Identity verified. Create a strong password to complete your account.
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
          onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {checks.map(({ label, ok }) => (
          <span key={label} className={`inline-flex items-center gap-1 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
            <span>{ok ? '✓' : '○'}</span> {label}
          </span>
        ))}
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-md bg-[#E4002B]/5 border border-[#E4002B]/20">
          <p className="text-sm text-[#E4002B]">{error}</p>
        </div>
      )}

      <Button className="w-full mt-5" onClick={handleSetPassword} loading={isLoading} size="lg">
        Create account
      </Button>
    </div>
  )
}
