'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { selectEffectivePilot, selectPilotEdgeTokens, selectPilotSkill } from '@/store/selectors'
import { sideSummary, sortieBattle, unitBattle } from '@/lib/battle'
import type { SideSummary } from '@/lib/battle'
import { opposingForcePv } from '@/lib/opposing-force'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { Sortie, Unit, UnitBattle } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { BattleCard } from './BattleCard'
import { cn } from '@/lib/utils'

const CREW_SKILL = 4

interface Card {
  unit: Unit
  record: UnitBattle
  pilotName: string | null
  skill: number
  /** The Named Pilot's Edge Tokens stat; only piloted Player Force cards have one (#45). */
  edgeTokens?: number
}

type Side = 'player' | 'opposing'
type View = Side | 'both'

function summaryText(s: SideSummary): string {
  return [
    `${s.active} active`,
    s.crippled > 0 && `${s.crippled} crippled`,
    s.destroyed > 0 && `${s.destroyed} destroyed`,
    s.pending > 0 && `${s.pending} pending`,
  ].filter(Boolean).join(' · ')
}

function SideColumn({ title, tone, cards, summary, extra, empty, sortieId, readOnly, crewLabel }: {
  title: string
  tone: string
  cards: Card[]
  summary: SideSummary
  extra?: string
  empty: React.ReactNode
  sortieId: string
  readOnly: boolean
  crewLabel: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <section className="flex flex-col gap-2 min-w-0">
      <div className="flex justify-between items-baseline gap-2 px-1 pb-1 border-b-2 border-steel-500">
        <h2 className={cn('m-0 text-sm', tone)}>{title}</h2>
        <span className="text-xs text-text-secondary text-right">{summaryText(summary)}{extra ? ` · ${extra}` : ''}</span>
      </div>
      {cards.length === 0 && <p className="m-0 px-1 text-sm text-text-secondary">{empty}</p>}
      {cards.map(c => (
        <BattleCard key={c.unit.id} sortieId={sortieId} unit={c.unit} record={c.record} pilotName={c.pilotName} skill={c.skill} edgeTokens={c.edgeTokens}
          crewLabel={crewLabel} open={openId === c.unit.id} onToggle={() => setOpenId(openId === c.unit.id ? null : c.unit.id)} readOnly={readOnly} />
      ))}
    </section>
  )
}

/** Play mode: both forces as Alpha Strike cards. Marks stay pending until Apply or End Round. */
export function PlayMode({ sortie }: { sortie: Sortie }) {
  const router = useRouter()
  const { campaign, endRound, discardAllBattle, updateSortie } = useCampaignStore()
  const [finishing, setFinishing] = useState(false)
  const battle = sortieBattle(sortie.battle)
  const readOnly = sortie.status !== 'draft'
  const tablet = useMediaQuery('(min-width: 768px)')
  const [phoneSide, setPhoneSide] = useState<Side>('player')
  const [tabletView, setTabletView] = useState<View>('both')

  const player: Card[] = sortie.fieldedUnits.flatMap(f => {
    const unit = campaign.units.find(u => u.id === f.unitId)
    if (!unit) return []
    const stored = f.pilotId ? campaign.namedPilots.find(p => p.id === f.pilotId) : undefined
    const pilot = stored ? selectEffectivePilot(campaign, stored) : undefined
    return [{
      unit, record: unitBattle(battle, unit.id), pilotName: pilot?.callsign ?? null,
      skill: pilot ? selectPilotSkill(pilot) : CREW_SKILL, edgeTokens: pilot ? selectPilotEdgeTokens(pilot) : undefined,
    }]
  })
  const opposing: Card[] = (sortie.opposingForce ?? []).map(u => ({
    unit: { ...u, pilotId: null, totalSpEarned: 0 }, record: unitBattle(battle, u.id), pilotName: null, skill: u.skill,
  }))
  const playerSummary = sideSummary(player)
  const opposingSummary = sideSummary(opposing)
  const pendingCount = playerSummary.pending + opposingSummary.pending
  const view: View = tablet ? tabletView : phoneSide

  // Ending the Sortie: the Primary Objective decides whether the after-sortie steps happen at all.
  function finish(outcome: Sortie['outcome']) {
    updateSortie(sortie.id, { outcome })
    router.push(outcome === 'victory' ? `/sortie/${sortie.id}/step/after-1` : `/sortie/${sortie.id}`)
  }

  const playerColumn = (
    <SideColumn title="Player Force" tone="text-amber" cards={player} summary={playerSummary} sortieId={sortie.id} readOnly={readOnly} crewLabel="Crew"
      empty={<>No Fielded Units yet. Choose them in <Link href={`/sortie/${sortie.id}/step/setup-5`} className="text-signal-blue underline">Sortie Setup step 5</Link>.</>} />
  )
  const opposingColumn = (
    <SideColumn title="Opposing Force" tone="text-signal-blue" cards={opposing} summary={opposingSummary} extra={`${opposingForcePv(sortie.opposingForce ?? [])} PV`}
      sortieId={sortie.id} readOnly={readOnly} crewLabel="Enemy"
      empty={<>No enemy units yet. Add them in <Link href={`/sortie/${sortie.id}/step/setup-6`} className="text-signal-blue underline">Sortie Setup step 6</Link>.</>} />
  )

  return (
    <>
      <header className="bg-steel-800 border-b-2 border-amber">
        <div className="max-w-6xl mx-auto px-gutter pt-3 pb-2.5 flex flex-col gap-1">
          <div className="dossier-label flex justify-between gap-3 text-text-secondary">
            <Link href={`/sortie/${sortie.id}`} className="text-signal-blue">&lt; Sortie {sortie.sortieNumber}</Link>
            <span className="text-amber">Round {battle.round}</span>
          </div>
          <div className="flex flex-wrap justify-between items-end gap-2">
            <h1 className="m-0 text-[26px] leading-[1.05] text-amber">Play the Sortie</h1>
            {tablet && (
              <div className="flex gap-1.5" role="group" aria-label="Show">
                {(['both', 'player', 'opposing'] as View[]).map(v => (
                  <button key={v} type="button" aria-pressed={tabletView === v} onClick={() => setTabletView(v)}
                    className={cn('h-9 px-3 border-2 font-condensed font-bold text-xs tracking-[1px] uppercase',
                      tabletView === v ? 'border-amber text-amber' : 'border-steel-500 text-text-secondary')}>
                    {v === 'both' ? 'Both sides' : v === 'player' ? 'Player' : 'Opposing'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="m-0 text-[13px] text-text-secondary">
            Tap a pip to mark damage; tap it again to unmark it. Changes stay pending until Apply or End Round
          </p>
        </div>
        {!tablet && (
          <div role="tablist" className="grid grid-cols-2">
            {(['player', 'opposing'] as Side[]).map(side => (
              <button key={side} type="button" role="tab" aria-selected={phoneSide === side} onClick={() => setPhoneSide(side)}
                className={cn('h-11 font-condensed font-bold text-sm tracking-[1px] uppercase border-b-[3px]',
                  phoneSide === side ? 'text-amber border-amber' : 'text-text-secondary border-transparent')}>
                {side === 'player' ? `Player Force · ${player.length}` : `Opposing · ${opposing.length}`}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className={cn('mx-auto px-3 py-3 grid gap-4', view === 'both' ? 'max-w-6xl md:grid-cols-2' : 'max-w-3xl')}>
        {(view === 'player' || view === 'both') && playerColumn}
        {(view === 'opposing' || view === 'both') && opposingColumn}
        {readOnly && <p className="m-0 px-1 text-[13px] text-text-secondary">This sortie is completed. Reopen it to change the battle.</p>}
      </div>

      {!readOnly && player.length + opposing.length > 0 && (
        <div className="sticky bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom,0px))] md:bottom-0 z-30 bg-steel-800 border-t-2 border-amber">
          {finishing && (
            <div className="max-w-6xl mx-auto px-gutter pt-3 flex flex-col gap-2">
              <span className="dossier-label text-text-secondary">Battle over · did you complete the Primary Objective?</span>
              {pendingCount > 0 && (
                <p className="m-0 text-[13px] text-danger">{pendingCount} {pendingCount === 1 ? 'card has' : 'cards have'} pending damage. End the round or discard it first so the damage counts.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <DossierButton variant="primary" disabled={pendingCount > 0} onClick={() => finish('victory')}>Yes · After-Sortie Steps</DossierButton>
                <DossierButton variant="danger" className="self-stretch h-auto!" disabled={pendingCount > 0} onClick={() => finish('failed')}>No · Failed</DossierButton>
              </div>
            </div>
          )}
          <div className="max-w-6xl mx-auto px-gutter py-2 flex items-center justify-between gap-3">
            <span className="text-[13px] text-text-secondary">
              <span className="font-condensed font-bold text-[15px] text-amber">ROUND {battle.round}</span>
              {pendingCount > 0 ? ` · ${pendingCount} pending` : ' · nothing pending'}
            </span>
            <span className="flex gap-2">
              {pendingCount > 0 && (
                <DossierButton variant="secondary" className="border-steel-500 text-text-secondary" onClick={() => discardAllBattle(sortie.id)}>Discard all</DossierButton>
              )}
              <DossierButton variant="secondary" className="w-auto h-touch px-4" aria-expanded={finishing} onClick={() => setFinishing(!finishing)}>
                {finishing ? 'Keep playing' : 'Battle over'}
              </DossierButton>
              <DossierButton variant="primary" className="w-auto h-touch px-5 text-base" onClick={() => endRound(sortie.id)}>End round</DossierButton>
            </span>
          </div>
        </div>
      )}
    </>
  )
}
