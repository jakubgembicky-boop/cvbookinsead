'use client'

import { useState } from 'react'
import Image from 'next/image'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Renders a remote avatar photo, falling back to the navy initials circle if
 * the image is missing or fails to load (LinkedIn's CDN frequently 403s
 * hot-linked images).
 */
export function PhotoAvatar({
  src,
  name,
  size,
  className = '',
  ring = 'ring-2 ring-gray-100',
}: {
  src: string | null
  name: string
  size: number
  className?: string
  ring?: string
}) {
  const [error, setError] = useState(false)
  const dim = { height: size, width: size }

  if (!src || error) {
    return (
      <div
        className={`rounded-full bg-[#003781] flex items-center justify-center text-white font-semibold ${className}`}
        style={{ ...dim, fontSize: size * 0.32 }}
      >
        {initials(name)}
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className={`rounded-full object-cover ${ring} ${className}`}
      style={dim}
    />
  )
}
