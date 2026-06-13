'use client'

import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Eye, EyeOff } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const supabase = createClient()

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        setServerError('Invalid email or password. Please try again.')
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
        setServerError('Please verify your email address before signing in.')
      } else {
        setServerError(error.message)
      }
      return
    }

    // Check if onboarding is needed
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_completed_at')
        .eq('user_id', authData.user.id)
        .single()

      if (profile && !profile.profile_completed_at) {
        router.push('/onboarding')
        return
      }
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to your INSEAD 26D account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="your.name@insead.edu"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••••••"
            error={errors.password?.message}
            {...register('password')}
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

        {serverError && (
          <div className="rounded-md bg-[#E4002B]/5 border border-[#E4002B]/20 p-3">
            <p className="text-sm text-[#E4002B]">{serverError}</p>
          </div>
        )}

        <Button type="submit" className="w-full" loading={isSubmitting} size="lg">
          Sign in
        </Button>
      </form>

      <div className="mt-4 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-[#003781] hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Not registered yet?{' '}
          <Link href="/register" className="text-[#003781] font-medium hover:underline">
            Create your account
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><div className="h-6 w-6 rounded-full border-2 border-[#003781] border-t-transparent animate-spin mx-auto" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
