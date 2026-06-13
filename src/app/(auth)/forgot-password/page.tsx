'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CheckCircle, ChevronLeft } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormValues) => {
    const supabase = createClient()
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin

    // We always show "success" to prevent email enumeration
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${appUrl}/reset-password`,
    })

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-50 mb-5">
          <CheckCircle className="h-7 w-7 text-green-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-sm text-gray-500 mb-6">
          If that email is in our system, you&apos;ll receive a password reset link shortly.
        </p>
        <Link
          href="/login"
          className="text-sm text-[#003781] font-medium hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot your password?</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="your.name@insead.edu"
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" className="w-full" loading={isSubmitting} size="lg">
          Send reset link
        </Button>
      </form>
    </div>
  )
}
