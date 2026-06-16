'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './Button'

/**
 * Supabase JWT sessions expire after 3600 seconds (60 minutes).
 *
 * Behaviour:
 *   - Warning appears when ≤ 20 minutes remain (WARN_WINDOW).
 *   - "Extend 10 minutes" refreshes the Supabase session and snoozes the banner
 *     for 10 minutes, so it does not nag again immediately.
 *   - Dismissing (×) also snoozes for 10 minutes.
 *   This prevents the old bug where the banner re-appeared on every 30s tick.
 *
 * Props:
 *   sessionExpiresAt — Unix timestamp (seconds) when the current session expires.
 */
interface SessionTimeoutWarningProps {
  sessionExpiresAt: number | null
}

const WARN_WINDOW = 1200 // 20 minutes
const SNOOZE = 600 // 10 minutes

export function SessionTimeoutWarning({ sessionExpiresAt }: SessionTimeoutWarningProps) {
  // Local expiry — updated when we successfully refresh the session, so the
  // checker uses the fresh value instead of the stale server-rendered prop.
  const [expiresAt, setExpiresAt] = useState<number | null>(sessionExpiresAt)
  const [snoozeUntil, setSnoozeUntil] = useState(0)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  // Tick every 30s so visibility re-evaluates.
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000)
    return () => clearInterval(interval)
  }, [])

  const secondsLeft = expiresAt ? expiresAt - now : Infinity
  const visible =
    expiresAt != null && secondsLeft <= WARN_WINDOW && secondsLeft > 0 && now >= snoozeUntil

  const minutesLeft = Math.max(1, Math.round(secondsLeft / 60))

  const handleExtend = useCallback(async () => {
    setRefreshing(true)
    try {
      const { data, error } = await supabase.auth.refreshSession()
      const fresh = data.session?.expires_at
      if (!error && fresh) setExpiresAt(fresh)
    } finally {
      // Quiet the banner for 10 minutes regardless — the session is extended
      // (or we'll re-evaluate against the fresh expiry after the snooze).
      setSnoozeUntil(Math.floor(Date.now() / 1000) + SNOOZE)
      setRefreshing(false)
    }
  }, [supabase])

  const handleDismiss = () => setSnoozeUntil(Math.floor(Date.now() / 1000) + SNOOZE)

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
          Your session expires in about {minutesLeft} {minutesLeft === 1 ? 'minute' : 'minutes'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExtend}
          loading={refreshing}
          className="text-amber-800 hover:bg-amber-100"
        >
          Extend 10 minutes
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
          onClick={handleDismiss}
          className="ml-1 p-1 rounded-md hover:bg-amber-100 focus:outline-none"
          aria-label="Dismiss for 10 minutes"
        >
          <span className="text-amber-600 text-lg leading-none">&times;</span>
        </button>
      </div>
    </div>
  )
}
