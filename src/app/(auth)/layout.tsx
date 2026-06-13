import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#003781] via-[#002a61] to-[#001a3d] px-4 py-12">
      {/* INSEAD logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex flex-col items-center">
          <span className="text-3xl font-bold tracking-tight text-white select-none">
            INSEAD
          </span>
          <span className="text-xs font-medium text-white/60 tracking-[0.2em] uppercase mt-0.5">
            26D Network
          </span>
          <div className="mt-2 h-0.5 w-8 bg-[#E4002B] rounded-full" />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-white/30 text-center">
        Private network · INSEAD MBA Class of December 2026
      </p>
    </div>
  )
}
