'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { SessionTimeoutWarning } from '@/components/ui/SessionTimeoutWarning'
import { ChevronDown, LogOut, User as UserIcon, Download, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppNavProps {
  user: User
  profile: Profile | null
  sessionExpiresAt: number | null
  needsOnboarding: boolean
}

const NAV_LINKS = [
  { href: '/', label: 'Directory' },
  { href: '/switch', label: 'Career Switch' },
  { href: '/stats', label: 'Stats' },
  { href: '/companies', label: 'Companies' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/about', label: 'Methodology' },
]

export function AppNav({ user, profile, sessionExpiresAt, needsOnboarding }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = profile
    ? profile.display_name || `${profile.first_name} ${profile.last_name}`
    : user.email ?? 'User'
  const photoUrl = profile?.photo_url

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Redirect to onboarding if needed (client-side)
  useEffect(() => {
    if (needsOnboarding && pathname !== '/onboarding') {
      router.push('/onboarding')
    }
  }, [needsOnboarding, pathname, router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <SessionTimeoutWarning sessionExpiresAt={sessionExpiresAt} />

      <nav className="bg-[#003781] text-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-6">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0 font-bold text-lg tracking-tight">
              INSEAD <span className="text-[#E4002B]">26D</span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1 flex-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    pathname === href
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Spacer on mobile */}
            <div className="flex-1 md:hidden" />

            {/* User menu */}
            <div ref={dropdownRef} className="relative hidden md:block">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <Avatar name={displayName} photoUrl={photoUrl} size="sm" />
                <span className="text-sm font-medium max-w-[120px] truncate hidden lg:block">
                  {displayName}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-white/60 transition-transform',
                    dropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 border border-gray-100 z-50">
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    My Profile
                  </Link>
                  <a
                    href="/api/profile/export"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4 text-gray-400" />
                    Download My Data
                  </a>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#E4002B] hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#002a61] pb-3">
            <div className="px-4 pt-3 space-y-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block px-3 py-2 rounded-md text-sm font-medium',
                    pathname === href
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  )}
                >
                  {label}
                </Link>
              ))}
              <div className="border-t border-white/10 pt-3 mt-2 space-y-1">
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/5"
                >
                  <UserIcon className="h-4 w-4" />
                  My Profile
                </Link>
                <a
                  href="/api/profile/export"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/5"
                >
                  <Download className="h-4 w-4" />
                  Download My Data
                </a>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#E4002B]/80 hover:text-[#E4002B] hover:bg-white/5"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
