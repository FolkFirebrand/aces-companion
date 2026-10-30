'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { selectCompletionBlockers, selectPersonnelCost, selectPvLimit, selectRepairCost, selectSortieEarnings, selectSortieSteps } from '@/store/selectors'
import type { Sortie, SortieOutcome } from '@/lib/types'
import { hasPending } from '@/lib/battle'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'
import { StatusTag } from '@/components/dossier/StatusTag'
import { DossierButton } from '@/components/dossier/DossierButton'
import { cn } from '@/lib/utils'

function signedSp(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value)} SP`
}

/** What each data step shows on the checklist once something is recorded. */
function stepValue(stepId: string, sortie: Sortie, pvLimit: number, earnings: number): string | null {
  const purchases = sortie.purchases.reduce((sum, p) => sum + p.spCost, 0)
  switch (stepId) {
    case 'setup-1': return sortie.sortieNumber
    case 'setup-3': return `${sortie.reconnaissanceCost} SP`
    case 'setup-5': return sortie.listedPv > 0 ? `LIMIT ${pvLimit} PV` : null
    case 'setup-6': return sortie.opposingForce?.length ? `${sortie.opposingForce.length} UNIT${sortie.opposingForce.length > 1 ? 'S' : ''}` : null
    case 'after-1': return `${sortie.waypointsSP} SP`
    case 'after-2': return sortie.keywordsGained.length > 0 ? `${sortie.keywordsGained.length} KEYWORD${sortie.keywordsGained.length > 1 ? 'S' : ''}` : null
    case 'after-7': return sortie.nextSortieNote.trim() ? sortie.nextSortieNote.trim().toUpperCase() : null
    case 'after-3': return `${selectRepairCost(sortie) + selectPersonnelCost(sortie)} SP`
    case 'after-4': return signedSp(earnings)
    case 'after-5': return null
    case 'after-6': return sortie.purchases.length > 0 ? signedSp(-purchases) : null
    default: return null
  }
}

export function SortieChecklist({ sortie }: { sortie: Sortie }) {
  const router = useRouter()
  const { campaign, updateSortie, setStepDone, completeSortie, deleteSortie } = useCampaignStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const steps = selectSortieSteps(sortie)
  const blockers = selectCompletionBlockers(sortie)
  const failed = sortie.outcome === 'failed'
  const pvLimit = selectPvLimit(campaign, sortie)
  const earnings = selectSortieEarnings(campaign, sortie)
  const nextStep = steps.find(s => !s.done && (!failed || s.section === 'setup'))

  function renderSteps(section: 'setup' | 'after') {
    return steps.filter(s => s.section === section).map(step => {
      const current = step.id === nextStep?.id
      const value = stepValue(step.id, sortie, pvLimit, earnings)
      const number = (
        <span className={cn(
          'w-[30px] h-[30px] shrink-0 flex items-center justify-center font-stencil text-[17px] border',
          step.done ? 'bg-steel-600 border-steel-600 text-text-primary'
            : current ? 'bg-amber border-amber text-on-amber' : 'border-steel-500 text-text-secondary'
        )}>{step.number}</span>
      )
      const text = (
        <span className="flex-1 flex flex-col gap-0.5">
          <span className={cn('font-condensed font-bold text-[15px] tracking-[1px] uppercase', current && 'text-amber')}>{step.name}</span>
          <span className="text-[13px] leading-snug text-text-secondary">{step.summary}</span>
        </span>
      )
      const rowClass = cn(
        'flex gap-3 items-start py-2.5 border-b border-steel-500 min-h-touch text-text-primary',
        current && 'bg-steel-800 -mx-gutter px-gutter border-amber'
      )

      if (step.tickOff) {
        return (
          <label key={step.id} className={cn(rowClass, 'cursor-pointer')}>
            {number}{text}
            <input
              type="checkbox"
              checked={step.done}
              onChange={e => setStepDone(sortie.id, step.id, e.target.checked)}
              aria-label={`${step.name} done`}
              className="w-[22px] h-[22px] mt-1 accent-[var(--color-amber)]"
            />
          </label>
        )
      }
      return (
        <Link key={step.id} href={`/sortie/${sortie.id}/step/${step.id}`} className={rowClass}>
          {number}{text}
          <span className={cn(
            'font-condensed font-semibold text-[13px] tracking-[1px] whitespace-nowrap',
            current ? 'text-amber' : step.done ? 'text-signal-blue' : 'text-text-disabled'
          )}>
            {current ? 'NEXT >' : step.done ? value ?? 'DONE' : 'TO DO'}
          </span>
        </Link>
      )
    })
  }

  const pendingCards = Object.values(sortie.battle?.units ?? {}).filter(hasPending).length

  return (
    <>
      <FileHeader label={`File ${sortie.sortieNumber} · Sortie log`} position="Draft" title={sortie.name || `Sortie ${sortie.sortieNumber}`}
        summary="Work through the book's steps in order. Nothing changes your force until you complete the sortie.">
        <Link href="/campaign" className="dossier-label text-signal-blue self-start min-h-6">&lt; Campaign Log</Link>
      </FileHeader>
      <PageBody>
        <section className="flex flex-col">
          <div className="dossier-label flex justify-between text-text-secondary pb-1 border-b-2 border-steel-500"><span>Sortie Setup Steps</span></div>
          {renderSteps('setup')}
        </section>

        <Link href={`/sortie/${sortie.id}/play`} className="flex justify-between items-center gap-3 px-3 py-2.5 min-h-touch bg-steel-800 border-2 border-amber hover:bg-steel-700">
          <span className="flex flex-col">
            <span className="font-condensed font-bold text-[15px] tracking-[1px] text-amber">PLAY THE SORTIE</span>
            <span className="text-[13px] text-text-secondary">
              {sortie.battle
                ? `Round ${sortie.battle.round}${pendingCards > 0 ? ` · ${pendingCards} pending` : ''}`
                : 'Track the battle on Alpha Strike cards'}
            </span>
          </span>
          <span className="dossier-label text-signal-blue">Open &gt;</span>
        </Link>

        <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
          <legend className="dossier-label text-text-secondary mb-2">Did you complete the Primary Objective?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['victory', 'failed'] as SortieOutcome[]).map(outcome => (
              <label key={outcome} className={cn(
                'h-touch flex items-center justify-center gap-2 border-2 font-condensed font-bold tracking-[1px] cursor-pointer',
                sortie.outcome === outcome
                  ? outcome === 'victory' ? 'border-signal-blue text-signal-blue' : 'border-danger text-danger'
                  : 'border-steel-500 text-text-secondary'
              )}>
                <input type="radio" name="outcome" value={outcome} checked={sortie.outcome === outcome}
                  onChange={() => updateSortie(sortie.id, { outcome })} className="sr-only" />
                {outcome === 'victory' ? 'YES · VICTORY' : 'NO · FAILED'}
              </label>
            ))}
          </div>
          {failed && <p className="m-0 text-sm text-danger">A Failed Sortie is replayed. It stays on the Campaign Log but changes nothing, so the after-sortie steps are skipped.</p>}
        </fieldset>

        {!failed && (
          <section className="flex flex-col">
            <div className="dossier-label flex justify-between text-text-secondary pb-1 border-b-2 border-steel-500"><span>After-Sortie Steps</span></div>
            {renderSteps('after')}
          </section>
        )}

        <div className="flex flex-col gap-2.5 pt-2">
          {blockers.length > 0 && (
            <p className="m-0 text-sm text-text-secondary">
              {blockers.length <= 3
                ? `${blockers.length} ${blockers.length === 1 ? 'step' : 'steps'} left before you can complete: ${blockers.join(', ')}.`
                : `${blockers.length} steps left before you can complete.`}
            </p>
          )}
          <DossierButton variant="primary" disabled={blockers.length > 0} onClick={() => completeSortie(sortie.id)}>
            Complete Sortie
          </DossierButton>
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-danger">Delete this draft and everything recorded in it?</span>
              <DossierButton variant="danger" onClick={() => { deleteSortie(sortie.id); router.push('/campaign') }}>Delete draft</DossierButton>
              <DossierButton variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</DossierButton>
            </div>
          ) : (
            <DossierButton variant="danger" onClick={() => setConfirmDelete(true)}>Delete draft</DossierButton>
          )}
        </div>
        {!failed && <StatusTag tone="neutral" className="self-start">Earnings so far {signedSp(earnings)}</StatusTag>}
      </PageBody>
    </>
  )
}
