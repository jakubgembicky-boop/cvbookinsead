'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus, X, Send, Check } from 'lucide-react'
import { submitFeedback } from '@/app/(app)/feedback/actions'

const SESSION_KEY = 'cvbook_session_start'

/**
 * Floating beta-feedback button (bottom-right). Opens a small panel with two
 * boxes — general comments and feature ideas — and silently attaches the page
 * the tester is on plus how long they've been in this session.
 */
export function FeedbackWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [feature, setFeature] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const startRef = useRef<number>(0)

  // Session start persists across in-app navigation (resets with the tab).
  useEffect(() => {
    let s = sessionStorage.getItem(SESSION_KEY)
    if (!s) {
      s = String(Date.now())
      sessionStorage.setItem(SESSION_KEY, s)
    }
    startRef.current = parseInt(s, 10)
  }, [])

  const elapsedMin = startRef.current
    ? Math.max(0, Math.round((Date.now() - startRef.current) / 60000))
    : 0

  const submit = async () => {
    if (!comment.trim() && !feature.trim()) {
      setError('Add a comment or a feature idea first.')
      return
    }
    setStatus('sending')
    setError('')
    const sessionSeconds = startRef.current ? (Date.now() - startRef.current) / 1000 : 0
    const res = await submitFeedback({
      page: pathname,
      sessionSeconds,
      comment,
      featureRequest: feature,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    })
    if (res.ok) {
      setStatus('done')
      setComment('')
      setFeature('')
      setTimeout(() => {
        setOpen(false)
        setStatus('idle')
      }, 1600)
    } else {
      setStatus('error')
      setError(res.error || 'Something went wrong — please try again.')
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#003781] px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-[#002a63] transition-colors"
          aria-label="Send feedback"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Feedback
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-96 rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-[#003781] px-4 py-3 text-white">
            <h3 className="text-sm font-bold">Beta feedback</h3>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 hover:bg-white/15"
              aria-label="Close feedback"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {status === 'done' ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-800">Thanks — got it!</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  What worked, what didn&apos;t, anything confusing?
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Your comments on this page…"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#003781] focus:outline-none focus:ring-1 focus:ring-[#003781]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  Features you&apos;d like to see
                </label>
                <textarea
                  value={feature}
                  onChange={(e) => setFeature(e.target.value)}
                  rows={3}
                  placeholder="Ideas for new features…"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#003781] focus:outline-none focus:ring-1 focus:ring-[#003781]"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  {pathname} · {elapsedMin} min in session
                </span>
                <button
                  onClick={submit}
                  disabled={status === 'sending'}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#003781] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#002a63] disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {status === 'sending' ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
