import { cn, getInitials } from '@/lib/utils'
import Image from 'next/image'

interface AvatarProps {
  name: string
  photoUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  xs: { container: 'h-6 w-6', text: 'text-[10px]' },
  sm: { container: 'h-8 w-8', text: 'text-xs' },
  md: { container: 'h-10 w-10', text: 'text-sm' },
  lg: { container: 'h-14 w-14', text: 'text-lg' },
  xl: { container: 'h-20 w-20', text: 'text-2xl' },
}

export function Avatar({ name, photoUrl, size = 'md', className }: AvatarProps) {
  const { container, text } = sizeMap[size]
  const initials = getInitials(name)

  return (
    <div
      className={cn(
        'relative rounded-full flex-shrink-0 overflow-hidden',
        container,
        !photoUrl && 'bg-[#003781] flex items-center justify-center',
        className
      )}
      aria-label={name}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          fill
          className="object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
          unoptimized
        />
      ) : (
        <span className={cn('font-semibold text-white select-none', text)}>
          {initials}
        </span>
      )}
    </div>
  )
}
