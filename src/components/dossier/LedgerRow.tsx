import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StatusTag } from './StatusTag'

export interface LedgerState {
  label: string
  tone: 'computed' | 'danger' | 'neutral'
}

const STATE_COLOURS: Record<LedgerState['tone'], string> = {
  computed: 'text-result',
  danger: 'text-danger',
  neutral: 'text-text-secondary',
}

interface LedgerRowProps {
  href: string
  title: string
  state: LedgerState
  detail: string
  balance: number
  keywords?: string[]
  /** A row that needs no action (a Failed Sortie): drawn in the disabled ink. */
  inactive?: boolean
}

/** One line of a ledger: title and state on top, detail and balance underneath. */
export function LedgerRow({ href, title, state, detail, balance, keywords = [], inactive = false }: LedgerRowProps) {
  return (
    <Link
      href={href}
      data-inactive={inactive ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-1 py-2.5 border-b border-line min-h-touch',
        inactive ? 'text-text-disabled' : 'text-text-primary'
      )}
    >
      <span className="flex justify-between items-baseline gap-3">
        <span className="font-label font-bold text-[17px] tracking-[1px] uppercase">{title}</span>
        <span className={cn('font-label font-semibold text-[13px] tracking-[1px] whitespace-nowrap', STATE_COLOURS[state.tone])}>
          {state.label}
        </span>
      </span>
      <span className={cn('flex justify-between items-baseline gap-3 text-sm', inactive ? '' : 'text-text-secondary')}>
        <span>{detail}</span>
        <span className={cn('font-mono font-bold text-lg tabular-nums', inactive ? '' : 'text-result')}>{balance}</span>
      </span>
      {keywords.length > 0 && (
        <span className="flex flex-wrap gap-2">
          {keywords.map(k => <StatusTag key={k} tone="keyword">{`KEYWORD · ${k.toUpperCase()}`}</StatusTag>)}
        </span>
      )}
    </Link>
  )
}
