import { cn } from '@/lib/utils'

export type StatusTone = 'neutral' | 'computed' | 'keyword' | 'hurt' | 'active'

const TONES: Record<StatusTone, string> = {
  neutral: 'border border-line text-text-secondary font-semibold',
  computed: 'border border-result text-result',
  keyword: 'border border-active text-active',
  hurt: 'bg-danger text-ink',
  active: 'bg-active text-on-active',
}

/** An uppercase tag that spells out a state, so nothing is told by colour alone. */
export function StatusTag({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-block font-label font-bold text-xs tracking-[1px] uppercase px-1.5 py-0.5', TONES[tone], className)}>
      {children}
    </span>
  )
}
