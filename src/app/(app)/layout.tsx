import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ReactNode } from 'react'
import { AppNav } from './AppNav'
import { FeedbackWidget } from '@/components/app/FeedbackWidget'
import { WelcomeModal } from '@/components/app/WelcomeModal'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Check onboarding — only redirect if not already on /onboarding
  // We pass onboarding check via a header trick — easier to do in the client nav

  // Get session expiry
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const sessionExpiresAt = session?.expires_at ?? null

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FC]">
      <AppNav
        user={user}
        profile={profile}
        sessionExpiresAt={sessionExpiresAt}
        needsOnboarding={profile ? !profile.profile_completed_at : false}
      />
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-gray-100 bg-white py-4 px-6 text-center text-xs text-gray-400">
        INSEAD 26D · Private network · {new Date().getFullYear()}
      </footer>
      <WelcomeModal />
      <FeedbackWidget />
    </div>
  )
}
