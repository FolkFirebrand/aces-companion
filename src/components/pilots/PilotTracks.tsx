'use client'

import { useCampaignStore } from '@/store/campaign'
import { selectAvailableSP, selectPilotHasSortieSp } from '@/store/selectors'
import { EDGE_ABILITY_THRESHOLDS, EDGE_TOKEN_THRESHOLDS, SKILL_THRESHOLDS, trackProgress, trackStepDown, trackStepUp } from '@/lib/thresholds'
import type { ThresholdTable } from '@/lib/thresholds'
import type { NamedPilot, StatTrack } from '@/lib/types'

export type TrackField = 'spSpentOnSkill' | 'spSpentOnEdgeTokens' | 'spSpentOnEdgeAbilities'

const TRACKS: { track: StatTrack; label: string; field: TrackField; table: ThresholdTable; stat: (v: number) => string }[] = [
  { track: 'skill', label: 'Skill', field: 'spSpentOnSkill', table: SKILL_THRESHOLDS, stat: v => `Skill ${v}` },
  { track: 'edgeTokens', label: 'Edge Tokens', field: 'spSpentOnEdgeTokens', table: EDGE_TOKEN_THRESHOLDS, stat: v => `${v} token${v === 1 ? '' : 's'}` },
  { track: 'edgeAbilities', label: 'Edge Abilities', field: 'spSpentOnEdgeAbilities', table: EDGE_ABILITY_THRESHOLDS, stat: v => `${v} abilit${v === 1 ? 'y' : 'ies'}` },
]

const STEP_BUTTON = 'w-touch h-touch border-2 border-signal-blue text-signal-blue font-condensed font-bold text-lg disabled:border-steel-500 disabled:text-text-disabled disabled:cursor-not-allowed'

/**
 * The three improvement tracks on a Named Pilot's card, the one control used wherever SP is split. "+" moves a
 * track to its next level, or puts in whatever SP is left; "−" steps back (Aces Rulebook p. 27). Without
 * `onChange` the tracks are read-only.
 */
export function TrackSteppers({ pilot, available, onChange }: {
  pilot: Pick<NamedPilot, TrackField>
  available: number
  onChange?: (track: StatTrack, field: TrackField, delta: number) => void
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {TRACKS.map(t => {
        const spent = pilot[t.field]
        const progress = trackProgress(spent, t.table)
        const up = trackStepUp(spent, available, t.table)
        const down = trackStepDown(spent, t.table)
        return (
          <div key={t.track} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center gap-2">
              <span className="font-condensed font-bold text-base tracking-[1px] uppercase">{t.label}</span>
              <span className="flex items-center gap-2">
                {onChange && (
                  <button type="button" aria-label={`Lower ${t.label}`} disabled={down === 0}
                    onClick={() => onChange(t.track, t.field, -down)} className={STEP_BUTTON}>−</button>
                )}
                <span className="font-stencil text-[28px] leading-none w-9 text-center">{progress.value}</span>
                {onChange && (
                  <button type="button" aria-label={`Raise ${t.label}`} disabled={up === 0}
                    onClick={() => onChange(t.track, t.field, up)} className={STEP_BUTTON}>+</button>
                )}
              </span>
            </div>
            <div className="h-2 bg-steel-800 border border-steel-500" aria-hidden="true">
              <div className="h-full bg-amber" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </div>
            <div className="flex justify-between gap-2 text-[13px] text-text-secondary">
              <span>{spent} SP in track</span>
              <span className="text-signal-blue text-right">
                {progress.next ? `${t.stat(progress.next.value)} at ${progress.next.at} · ${progress.toGo} to go` : 'Top of the track'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * A Named Pilot's tracks on their own page. Starting SP can be moved between them until the pilot's first sortie;
 * after that, SP is allocated in After-Sortie step 5 (Aces Rulebook p. 35).
 */
export function PilotTracks({ pilot }: { pilot: NamedPilot }) {
  const { campaign, spendOnStat, refundStat } = useCampaignStore()
  const locked = selectPilotHasSortieSp(campaign, pilot.id)
  const available = selectAvailableSP(pilot)

  return (
    <div className="flex flex-col gap-3.5">
      <TrackSteppers
        pilot={pilot}
        available={available}
        onChange={locked ? undefined : (track, _field, delta) => (delta > 0 ? spendOnStat(pilot.id, track, delta) : refundStat(pilot.id, track, -delta))}
      />
      <p className="m-0 text-[13px] text-text-secondary">
        {locked
          ? `${available} SP unspent. SP is allocated in After-Sortie step 5, Improve Named Pilots.`
          : `${available} starting SP left to allocate. SP doesn't have to reach a level: what's left counts toward the next one.`}
      </p>
    </div>
  )
}
