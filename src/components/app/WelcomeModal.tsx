'use client'

import { useState, useEffect } from 'react'
import { X, Users, Briefcase, BarChart, BookOpen } from 'lucide-react'

const HAS_SEEN_WELCOME_KEY = 'cvbook_has_seen_welcome'

export function WelcomeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Only show if they haven't seen it yet
    if (!localStorage.getItem(HAS_SEEN_WELCOME_KEY)) {
      setOpen(true)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#003781] px-6 py-8 text-white relative">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold mb-2">Welcome to the INSEAD 26D Network!</h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            This platform is built exclusively for our cohort to help you connect, explore career paths, and understand the collective experience of the class.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            What you can do here
          </p>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#003781]">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Directory</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Search classmates by background, language, or specific skills. Perfect for finding study group members or industry experts.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Career Switch</h3>
                <p className="text-xs text-gray-500 mt-1">
                  See who made the exact career pivot you are considering. Compare your skills with real market demand using our AI Market Pulse.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <BarChart className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Stats</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Explore high-level trends, most frequent transitions, and the geographical spread of our collective experience.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Methodology</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Read how we securely process CVs and use AI to build this directory in the new Methodology tab.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleClose}
              className="rounded-lg bg-[#003781] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002b66] transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
