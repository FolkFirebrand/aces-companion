'use client'

import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import {
  selectAllocation, selectCampaignLog, selectEffectivePilot, selectImproveSkipReason, selectMvpCandidates, selectNewSp,
  selectPilotShares, selectSortieEarnings,
} from '@/store/selectors'
import { lookupStatFromSP, nextTierCost, EDGE_ABILITY_THRESHOLDS, EDGE_TOKEN_THRESHOLDS, SKILL_THRESHOLDS } from '@/lib/thresholds'
import type { ThresholdTable } from '@/lib/thresholds'
import type { PilotShare, Sortie, StatTrack } from '@/lib/types'
import { StatusTag } from '@/components/dossier/StatusTag'
import { Field, NumberInput, Section, Select } from './fields'
import { cn } from '@/lib/utils'

const TRACKS: { track: StatTrack; label: string; spent: 'spSpentOnSkill' | 'spSpentOnEdgeTokens' | 'spSpentOnEdgeAbilities'; table: ThresholdTable; unit: string }[] = [
  { track: 'skill', label: 'Skill', spent: 'spSpentOnSkill', table: SKILL_THRESHOLDS, unit: 'Skill' },
  { track: 'edgeTokens', label: 'Edge Tokens', spent: 'spSpentOnEdgeTokens', table: EDGE_TOKEN_THRESHOLDS, unit: 'tokens' },
  { track: 'edgeAbilities', label: 'Edge Abilities', spent: 'spSpentOnEdgeAbilities', table: EDGE_ABILITY_THRESHOLDS, unit: 'abilities' },
]

function levelName(unit: string, level: number): string {
  if (unit === 'Skill') return `Skill ${level}`
  const singular = unit === 'tokens' ? 'token' : 'ability'
  return `${level} ${level === 1 ? singular : unit}`
}

const STATUS: Record<PilotShare['status'], { label: string; tone: 'computed' | 'hurt' | 'neutral' }> = {
  fielded: { label: 'Fielded', tone: 'computed' },
  wounded: { label: 'Wounded · full share', tone: 'hurt' },
  satOut: { label: 'Sat out · half', tone: 'neutral' },
  killed: { label: 'Killed · no share', tone: 'hurt' },
}

function AllocationPanel({ sortie, share, open, onToggle }: { sortie: Sortie; share: PilotShare; open: boolean; onToggle: () => void }) {
  const { campaign, setPilotAllocation } = useCampaignStore()
  const stored = campaign.namedPilots.find(p => p.id === share.pilotId)
  const newSp = selectNewSp(share)
  const allocation = selectAllocation(sortie, share.pilotId)
  const left = newSp - allocation.skill - allocation.edgeTokens - allocation.edgeAbilities
  if (!stored || newSp === 0) return null
  const pilot = selectEffectivePilot(campaign, stored)

  const status = left === 0 ? 'ALL ALLOCATED' : left > 0 ? `${left} LEFT` : `${-left} TOO MANY`
  return (
    <div className="bg-steel-800 border border-steel-500">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn('w-full min-h-touch flex justify-between items-center px-3 py-2 font-condensed font-bold text-sm tracking-[1px] uppercase text-left',
          open ? 'bg-amber text-on-amber' : 'bg-steel-600 text-text-primary')}
      >
        <span>{share.callsign} · {newSp} SP{share.mvp ? ` (${share.share} + MVP 20)` : ''}</span>
        <span className={open ? '' : left === 0 ? 'text-signal-blue' : 'text-danger'}>{status}</span>
      </button>
      {open && (
        <div className="px-3 pb-1">
          {TRACKS.map(({ track, label, spent, table, unit }) => {
            const before = pilot[spent]
            const after = before + allocation[track]
            const levelBefore = lookupStatFromSP(before, table)
            const levelAfter = lookupStatFromSP(after, table)
            const next = nextTierCost(after, table)
            const nextLevel = next === null ? null : lookupStatFromSP(after + next, table)
            return (
              <div key={track} className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 items-center py-2 border-b border-steel-500 last:border-b-0">
                <span className="font-condensed font-bold text-[15px] tracking-[1px] uppercase">
                  {label} {levelBefore}{levelAfter !== levelBefore && <> → <span className="text-amber">{levelAfter}</span></>}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={`Less ${label}`} onClick={() => setPilotAllocation(sortie.id, share.pilotId, track, allocation[track] - 10)}
                    className="w-touch h-touch border-2 border-steel-500 font-stencil text-xl">−</button>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`SP to ${label} for ${share.callsign}`}
                    value={allocation[track]}
                    onChange={e => setPilotAllocation(sortie.id, share.pilotId, track, Number(e.target.value))}
                    className="w-14 h-touch bg-steel-900 border border-steel-500 text-amber font-stencil text-xl text-center"
                  />
                  {left > 0 ? (
                    <button type="button" onClick={() => setPilotAllocation(sortie.id, share.pilotId, track, allocation[track] + left)}
                      className="h-touch px-2 border-2 border-signal-blue text-signal-blue font-condensed font-semibold text-xs tracking-[1px]">+ REST {left}</button>
                  ) : (
                    <button type="button" aria-label={`More ${label}`} onClick={() => setPilotAllocation(sortie.id, share.pilotId, track, allocation[track] + 10)}
                      className="w-touch h-touch border-2 border-steel-500 font-stencil text-xl">+</button>
                  )}
                </div>
                <span className={cn('col-span-2 text-[13px]', levelAfter !== levelBefore ? 'text-signal-blue' : 'text-text-secondary')}>
                  {before === after ? `${before}` : `${before} → ${after}`} SP in track
                  {levelAfter !== levelBefore ? ` · ${levelName(unit, levelAfter)} reached`
                    : nextLevel !== null && next !== null ? ` · ${levelName(unit, nextLevel)} at ${after + next}` : ' · maxed'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ImprovePilotsStep({ sortie }: { sortie: Sortie }) {
  const { campaign, updateSortie, setMvp } = useCampaignStore()
  const shares = selectPilotShares(campaign, sortie)
  const skip = selectImproveSkipReason(campaign, sortie)
  const earnings = selectSortieEarnings(campaign, sortie)
  const candidates = selectMvpCandidates(campaign, sortie)
  const toPilots = shares.reduce((sum, s) => sum + s.share, 0)
  const rows = selectCampaignLog(campaign)
  const index = rows.findIndex(r => r.sortie.id === sortie.id)
  const before = index > 0 ? rows[index - 1].warchest : campaign.startingWarchest
  const firstOpen = shares.find(s => selectNewSp(s) > 0)?.pilotId ?? null
  const [openId, setOpenId] = useState<string | null>(firstOpen)

  if (campaign.namedPilots.length === 0) return <p className="m-0 text-sm text-text-secondary">This force has no Named Pilots.</p>

  return (
    <>
      <div className="grid grid-cols-2 gap-3 items-end">
        <Field id="max-sp" label="Max SP per pilot">
          <NumberInput id="max-sp" value={sortie.maxSpPerPilot} onChange={maxSpPerPilot => updateSortie(sortie.id, { maxSpPerPilot })} />
        </Field>
        <p className="m-0 pb-1 text-[13px] text-text-secondary">From the sortie&apos;s outcome waypoint.</p>
      </div>

      {skip && (
        <p className="m-0 p-3 bg-steel-800 border border-danger text-sm text-danger">
          {skip === 'negativeEarnings'
            ? 'This sortie lost money, so Named Pilots earn no SP from it. This step is skipped.'
            : 'The Warchest would be at zero or below after this sortie, so this step is skipped and Named Pilots earn no SP.'}
        </p>
      )}

      <Section title="Shares" aside={`Earnings ${earnings} SP`}>
        {shares.map(s => (
          <div key={s.pilotId} className="flex items-center gap-2.5 min-h-touch border-b border-steel-500 text-[15px]">
            <span className="flex-1">{s.callsign}</span>
            <StatusTag tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusTag>
            <span className="font-stencil text-lg text-amber w-10 text-right tabular-nums">{s.share}</span>
          </div>
        ))}
        <div className="flex justify-between items-baseline py-2.5 border-b-2 border-steel-500">
          <span className="dossier-label text-text-secondary">To Named Pilots</span>
          <span className="font-stencil text-xl text-amber">{toPilots} SP</span>
        </div>
        <p className="m-0 text-[13px] text-text-secondary">
          Warchest after this sortie: {before} {earnings >= 0 ? '+' : '−'} {Math.abs(earnings)} − {toPilots} = <span className="text-amber">{before + earnings - toPilots} SP</span>
        </p>
      </Section>

      {!skip && (
        <Section title="MVP" aside="+20 SP · not from the Warchest">
          <Field id="mvp" label="A Named Pilot who was fielded and survived">
            <Select id="mvp" value={sortie.mvpPilotId ?? ''} onChange={v => setMvp(sortie.id, v || null)}>
              <option value="">Choose the MVP</option>
              {candidates.map(c => <option key={c.pilotId} value={c.pilotId}>{c.callsign}</option>)}
            </Select>
          </Field>
        </Section>
      )}

      {!skip && toPilots + (sortie.mvpPilotId ? 20 : 0) > 0 && (
        <Section title="Allocate new SP" aside="All of it, each pilot">
          {shares.map(s => (
            <AllocationPanel key={s.pilotId} sortie={sortie} share={s} open={openId === s.pilotId} onToggle={() => setOpenId(id => (id === s.pilotId ? null : s.pilotId))} />
          ))}
        </Section>
      )}
    </>
  )
}
