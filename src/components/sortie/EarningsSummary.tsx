'use client'

import { useCampaignStore } from '@/store/campaign'
import { selectSortieEarnings, selectTotalExpenses, selectTotalIncome } from '@/store/selectors'
import type { Sortie } from '@/lib/types'

function Figure({ label, value, tone = 'text-text-primary' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-label font-semibold text-[11px] tracking-[2px] text-text-secondary">{label}</span>
      <span className={`font-display font-bold text-xl tabular-nums ${tone}`}>{value}</span>
    </div>
  )
}

export function EarningsSummary({ sortie }: { sortie: Sortie }) {
  const campaign = useCampaignStore(s => s.campaign)
  const earnings = selectSortieEarnings(campaign, sortie)
  const totalIncome = selectTotalIncome(campaign, sortie)
  const totalExpenses = selectTotalExpenses(sortie)

  return (
    <div className="sticky bottom-0 z-30 bg-surface border-t-2 border-line">
      <div className="max-w-6xl mx-auto px-gutter py-2 grid grid-cols-3 gap-2">
        <Figure label="INCOME" value={String(totalIncome)} />
        <Figure label="EXPENSES" value={String(totalExpenses)} />
        <Figure
          label="EARNINGS"
          value={`${earnings >= 0 ? '+' : '−'}${Math.abs(earnings)} SP`}
          tone={earnings >= 0 ? 'text-active' : 'text-danger'}
        />
      </div>
    </div>
  )
}
