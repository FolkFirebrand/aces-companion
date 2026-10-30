import { cn } from '@/lib/utils'

export type StatusTone = 'neutral' | 'computed' | 'keyword' | 'hurt' | 'amber'

const TONES: Record<StatusTone, string> = {
  neutral: 'border border-steel-500 text-text-secondary font-semibold',
  computed: 'border border-signal-blue text-signal-blue',
  keyword: 'border border-amber text-amber',
  hurt: 'bg-danger text-steel-900',
  amber: 'bg-amber text-on-amber',
}

/** An uppercase stamp that spells out a state, so nothing is told by colour alone. */
export function StatusTag({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-block font-condensed font-bold text-xs tracking-[1px] uppercase px-1.5 py-0.5', TONES[tone], className)}>
      {children}
    </span>
  )
}
