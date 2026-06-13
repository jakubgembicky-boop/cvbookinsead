import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'navy' | 'red' | 'gray' | 'green' | 'amber'
}

export function Badge({ variant = 'navy', className, children, ...props }: BadgeProps) {
  const variants = {
    navy: 'bg-[#003781]/10 text-[#003781]',
    red: 'bg-[#E4002B]/10 text-[#E4002B]',
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
