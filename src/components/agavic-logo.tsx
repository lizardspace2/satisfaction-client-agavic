import { cn } from '@/lib/utils'

/** Logo AGAVIC Patrimoine — monogramme A doré + wordmark. */
export function AgavicLogo({
  className,
  light = false,
  compact = false,
}: {
  className?: string
  light?: boolean
  compact?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg viewBox="0 0 64 64" className="h-10 w-10 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" className={light ? 'fill-gold-500' : 'fill-navy-900'} />
        <path
          d="M20 46 L32 16 L44 46"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={light ? 'stroke-navy-950' : 'stroke-gold-500'}
        />
        <line x1="25" y1="36" x2="39" y2="36" strokeWidth="4" strokeLinecap="round"
          className={light ? 'stroke-navy-950' : 'stroke-gold-500'} />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className={cn('font-serif text-lg font-bold tracking-wide', light ? 'text-white' : 'text-navy-900 dark:text-white')}>
            AGAVIC
          </div>
          <div className={cn('text-[9px] font-semibold uppercase tracking-[0.28em]', light ? 'text-gold-300' : 'text-gold-600')}>
            Patrimoine
          </div>
        </div>
      )}
    </div>
  )
}
