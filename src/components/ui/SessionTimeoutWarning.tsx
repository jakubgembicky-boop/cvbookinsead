'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './Button'

/**
 * Supabase JWT sessions expire after 3600 seconds (60 minutes).
 * This component shows a warning banner 20 minutes before expiry.
 *
 * Props:
 *   sessionExpiresAt — Unix timestamp (seconds) when the current session expires.
 *                      Pass `supabase.auth.getSession().data.session?.expires_at`.
 */
interface SessionTimeoutWarningProps {
  sessionExpiresAt: number | null
}

export function SessionTimeoutWarning({ sessionExpiresAt }: SessionTimeoutWarningProps) {
  const [visible, setVisible] = useState(() => {
    if (!sessionExpiresAt) return false
    const now = Math.floor(Date.now() / 1000)
    const secondsLeft = sessionExpiresAt - now
    return secondsLeft <= 1200 && secondsLeft > 0
  })
  const [dismissed, setDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  const checkTimeout = useCallback(() => {
    if (!sessionExpiresAt || dismissed) return
    const now = Math.floor(Date.now() / 1000)
    const secondsLeft = sessionExpiresAt - now
    // Show warning when 20 minutes (1200s) or less remain
    if (secondsLeft <= 1200 && secondsLeft > 0) {
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [sessionExpiresAt, dismissed])

  useEffect(() => {
    const interval = setInterval(checkTimeout, 30_000) // check every 30s
    return () => clearInterval(interval)
  }, [checkTimeout])

  const handleStaySignedIn = async () => {
    setRefreshing(true)
    try {
      const { error } = await supabase.auth.refreshSession()
      if (!error) {
        setVisible(false)
        setDismissed(false)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!visible) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-800"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
        <span className="text-sm font-medium">
          Your session expires in 20 minutes
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStaySignedIn}
          loading={refreshing}
          className="text-amber-800 hover:bg-amber-100"
        >
          Stay signed in
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-amber-800 hover:bg-amber-100"
        >
          Sign out
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 p-1 rounded-md hover:bg-amber-100 focus:outline-none"
          aria-label="Dismiss"
        >
          <span className="text-amber-600 text-lg leading-none">&times;</span>
        </button>
      </div>
    </div>
  )
}
