'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWolfnetStore } from '@/store/wolfnet'
import { hasPending, sideSummary, unitBattle } from '@/lib/battle'
import { ARTILLERY, WIN_VP, artilleryPv, cardUnit, marginOfVictory, sideStanding } from '@/lib/wolfnet/rules'
import { SCENARIOS, scenarioByNumber, standUpFightPoints } from '@/lib/wolfnet/scenarios'
import type { LinkStatus } from '@/lib/wolfnet/sync'
import type { WnSide } from '@/lib/wolfnet/types'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { BattleCard, type BattleCardActions } from '@/components/play/BattleCard'
import { DossierButton, dossierButtonClass } from '@/components/dossier/DossierButton'
import { StatusTag } from '@/components/dossier/StatusTag'
import { Select } from '@/components/sortie/fields'
import { useMatchSync } from './useMatchSync'
import { cn } from '@/lib/utils'

const NO_ACTIONS: BattleCardActions = { mark: () => {}, apply: () => {}, discard: () => {}, setNotes: () => {} }

const STATUS_TEXT: Record<LinkStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  local: 'Live play not set up on this site',
  offline: 'Offline · retrying',
}

type Side = 'me' | 'opponent'

function shareLink(code: string): string {
  return typeof window === 'undefined' ? '' : `${window.location.origin}/wolfnet/join/${code}`
}

/** A Wolfnet match: your cards to mark, your opponent's to watch, and the score between you. */
export function MatchScreen() {
  const router = useRouter()
  const store = useWolfnetStore()
  const { match } = store
  const { status, opponentOnline } = useMatchSync()
  const tablet = useMediaQuery('(min-width: 768px)')
  const [phoneSide, setPhoneSide] = useState<Side>('me')
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showScenario, setShowScenario] = useState(false)

  if (!match) {
    return (
      <div className="max-w-xl mx-auto px-gutter py-8 flex flex-col gap-3">
        <h1 className="m-0 text-2xl text-active">No match in progress</h1>
        <p className="m-0 text-sm">Start one and give your opponent the code, or join theirs.</p>
        <Link href="/wolfnet" className={dossierButtonClass('primary')}>To Forces and Matches</Link>
      </div>
    )
  }

  const { me, opponent, code, role } = match
  const scenario = scenarioByNumber(match.scenario)
  const myPending = me.units.filter(u => hasPending(unitBattle(me.battle, u.id))).length
  const myMov = marginOfVictory(opponent)
  const theirMov = marginOfVictory(me)
  const theirStanding = opponent ? sideStanding(opponent) : null

  async function copyLink() {
    const link = shareLink(code)
    try {
      if (navigator.share) await navigator.share({ title: 'Wolfnet 350 match', text: `Join my match: code ${code}`, url: link })
      else { await navigator.clipboard.writeText(link); setCopied(true) }
    } catch { /* closed the share sheet */ }
  }

  const actionsFor = (unitId: string): BattleCardActions => ({
    mark: change => store.markBattle(unitId, change),
    apply: () => store.applyBattle(unitId),
    discard: () => store.discardBattle(unitId),
    setNotes: notes => store.setBattleNotes(unitId, notes),
  })

  const myColumn = (
    <SideColumn side={me} title={`${me.playerName || 'You'} · ${me.forceName || 'Your force'}`} tone="text-active" mine
      actionsFor={actionsFor} headhunter={match.scenario === 7} onToggleCommand={store.toggleCommandUnit} />
  )
  const opponentColumn = opponent ? (
    <SideColumn side={opponent} title={`${opponent.playerName || 'Opponent'} · ${opponent.forceName || 'Their force'}`} tone="text-result"
      actionsFor={() => NO_ACTIONS} headhunter={match.scenario === 7} />
  ) : (
    <section className="flex flex-col gap-2 min-w-0">
      <div className="px-1 pb-1 border-b-2 border-line"><h2 className="m-0 text-sm text-result">Opponent</h2></div>
      <p className="m-0 px-1 text-sm text-text-secondary">
        Waiting for your opponent to join with code <span className="font-mono font-bold text-text-primary">{code}</span>.
        {status === 'local' && ' Live play between devices isn\'t set up on this site (it needs the ABLY_API_KEY setting), so no one can join yet.'}
      </p>
    </section>
  )

  return (
    <>
      <header className="bg-surface border-b-2 border-active">
        <div className="max-w-6xl mx-auto px-gutter pt-3 pb-2.5 flex flex-col gap-2">
          <div className="field-label flex flex-wrap justify-between gap-2 text-text-secondary">
            <Link href="/wolfnet" className="text-result">&lt; Wolfnet 350</Link>
            <span className="flex items-center gap-2">
              <span className={cn('inline-block size-2.5 rounded-full', status === 'live' ? 'bg-active' : status === 'offline' ? 'bg-danger' : 'bg-text-muted')} aria-hidden="true" />
              {STATUS_TEXT[status]}{opponent ? ` · opponent ${opponentOnline ? 'here' : 'away'}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap justify-between items-end gap-2">
            <div className="flex flex-col">
              <span className="field-label text-text-secondary">Match code</span>
              <span className="font-mono font-bold text-[28px] leading-none tracking-[4px] text-active">{code}</span>
            </div>
            <DossierButton variant="secondary" onClick={copyLink}>{copied ? 'Link copied' : 'Share join link'}</DossierButton>
          </div>

          <div className="flex flex-col gap-1 pt-1 border-t border-line">
            <div className="flex flex-wrap items-center gap-2">
              <span className="field-label text-text-secondary">Scenario</span>
              {role === 'host' ? (
                <Select id="wn-match-scenario" value={String(match.scenario ?? '')} onChange={v => store.setScenario(v ? Number(v) : null)} className="w-auto min-w-[12rem]">
                  {SCENARIOS.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}{s.beta ? ' (beta)' : ''}</option>)}
                </Select>
              ) : (
                <span className="font-label font-bold">{scenario ? `${scenario.number}. ${scenario.name}` : 'The host is choosing…'}</span>
              )}
              {scenario && (
                <button type="button" className="field-label text-result underline min-h-touch" aria-expanded={showScenario} onClick={() => setShowScenario(!showScenario)}>
                  {showScenario ? 'Hide' : 'Objective and scoring'}
                </button>
              )}
            </div>
            {scenario && showScenario && (
              <div className="text-sm flex flex-col gap-1 bg-surface-deep border border-line p-2">
                <p className="m-0">{scenario.objective}</p>
                <ul className="m-0 pl-4">{scenario.scoring.map(s => <li key={s}>{s}</li>)}</ul>
                <p className="m-0 text-xs text-text-muted">First to {WIN_VP} objective points wins. Full setup and map: AS350 rules, page {scenario.page}.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2" aria-label="Score">
            <ScoreBox label={me.playerName || 'You'} vp={me.vp} mov={myMov} onVp={store.setVp} />
            <ScoreBox label={opponent?.playerName || 'Opponent'} vp={opponent?.vp ?? 0} mov={opponent ? theirMov : null} />
          </div>
          {match.scenario === 5 && theirStanding && (
            <p className="m-0 text-[13px] text-text-secondary">
              Stand Up Fight: you have destroyed {theirStanding.destroyedPv} PV, worth {standUpFightPoints(theirStanding.destroyedPv, theirStanding.allDestroyed)} points.
            </p>
          )}
          {theirStanding?.allDestroyed && (
            <p className="m-0 text-[13px] text-result">Every opposing unit is destroyed: the game ends, and you add 1 objective point (to a maximum of {WIN_VP}).</p>
          )}
        </div>
        {!tablet && (
          <div role="tablist" className="grid grid-cols-2">
            {(['me', 'opponent'] as Side[]).map(side => (
              <button key={side} type="button" role="tab" aria-selected={phoneSide === side} onClick={() => setPhoneSide(side)}
                className={cn('h-11 font-label font-bold text-sm tracking-[1px] uppercase border-b-[3px]',
                  phoneSide === side ? 'text-active border-active' : 'text-text-secondary border-transparent')}>
                {side === 'me' ? `Your force · ${me.units.length}` : `Opponent · ${opponent?.units.length ?? 0}`}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className={cn('mx-auto px-3 py-3 grid gap-4', tablet ? 'max-w-6xl grid-cols-2' : 'max-w-3xl')}>
        {(tablet || phoneSide === 'me') && myColumn}
        {(tablet || phoneSide === 'opponent') && opponentColumn}
      </div>

      <div className="sticky bottom-0 z-30 bg-surface border-t-2 border-active pb-[env(safe-area-inset-bottom,0px)]">
        {leaving && (
          <div className="max-w-6xl mx-auto px-gutter pt-2.5 flex flex-wrap items-center gap-2">
            <span className="w-full text-sm">Leave this match? Its cards and score are cleared from this device. Write the result on your match slip first.</span>
            <DossierButton variant="danger" onClick={() => { store.leaveMatch(); router.push('/wolfnet') }}>Leave match</DossierButton>
            <DossierButton variant="secondary" onClick={() => setLeaving(false)}>Keep playing</DossierButton>
          </div>
        )}
        <div className="max-w-6xl mx-auto px-gutter py-2 flex items-center justify-between gap-2">
          <span className="shrink-0 flex flex-col text-[13px] leading-tight text-text-secondary">
            <span className="font-label font-bold text-[15px] text-active whitespace-nowrap">ROUND {me.battle.round}</span>
            {myPending > 0 ? (
              <span className="whitespace-nowrap">{myPending} pending · <button type="button" className="underline text-text-primary" onClick={store.discardAllBattle}>Discard all</button></span>
            ) : <span>Nothing pending</span>}
          </span>
          <span className="flex gap-1.5 sm:gap-2 min-w-0">
            <DossierButton variant="secondary" className="w-auto h-touch px-2.5 sm:px-3.5 text-sm whitespace-nowrap" aria-expanded={leaving} onClick={() => setLeaving(!leaving)}>Leave</DossierButton>
            <DossierButton variant="primary" className="w-auto h-touch px-3 sm:px-4 text-sm sm:text-base whitespace-nowrap" onClick={store.endRound}>End round</DossierButton>
          </span>
        </div>
      </div>
    </>
  )
}

/** One player's objective points and Margin of Victory; your own points have steppers. */
function ScoreBox({ label, vp, mov, onVp }: { label: string; vp: number; mov: number | null; onVp?: (vp: number) => void }) {
  const won = vp >= WIN_VP
  return (
    <div className={cn('flex flex-col gap-1 p-2 border', won ? 'border-result' : 'border-line', 'bg-surface-deep')}>
      <span className="field-label text-text-secondary truncate">{label}</span>
      <div className="flex items-center gap-2">
        {onVp && <button type="button" aria-label="One objective point less" disabled={vp <= 0} onClick={() => onVp(vp - 1)} className="w-touch h-touch border border-line font-display font-bold text-lg disabled:opacity-40">−</button>}
        <span className="font-mono font-bold text-[28px] leading-none text-result" aria-label={`${vp} objective points`}>{vp}</span>
        {onVp && <button type="button" aria-label="One more objective point" onClick={() => onVp(vp + 1)} className="w-touch h-touch border border-line font-display font-bold text-lg">+</button>}
        {won && <StatusTag tone="computed">Wins</StatusTag>}
      </div>
      <span className="text-xs text-text-secondary">Objective points · MOV <span className="font-mono font-bold text-text-primary">{mov ?? '–'}</span></span>
    </div>
  )
}

function SideColumn({ side, title, tone, mine = false, actionsFor, headhunter, onToggleCommand }: {
  side: WnSide
  title: string
  tone: string
  mine?: boolean
  actionsFor: (unitId: string) => BattleCardActions
  headhunter: boolean
  onToggleCommand?: (unitId: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const cards = side.units.map(u => ({ unit: cardUnit(u), record: unitBattle(side.battle, u.id), skill: u.skill, pv: u.pv }))
  const summary = sideSummary(cards)
  const standing = sideStanding(side)
  return (
    <section className="flex flex-col gap-2 min-w-0">
      <div className="flex justify-between items-baseline gap-2 px-1 pb-1 border-b-2 border-line">
        <h2 className={cn('m-0 text-sm truncate', tone)}>{title}</h2>
        <span className="text-xs text-text-secondary text-right whitespace-nowrap">
          {summary.active} active{summary.crippled ? ` · ${summary.crippled} crippled` : ''}{summary.destroyed ? ` · ${summary.destroyed} destroyed` : ''} · {standing.remainingPv} PV left
        </span>
      </div>
      {!mine && <p className="m-0 px-1 text-xs text-text-muted">Their player marks these cards; you see each change once it&apos;s applied.</p>}
      {mine && headhunter && side.commandUnitIds.length < 2 && (
        <p className="m-0 px-1 text-xs text-text-muted">Headhunter: open a card and tap Command Unit to choose your two.</p>
      )}
      {cards.map(c => {
        const command = headhunter && side.commandUnitIds.includes(c.unit.id)
        return (
          <BattleCard key={c.unit.id} actions={actionsFor(c.unit.id)} unit={c.unit} record={c.record} pilotName={`${c.pv} PV`} skill={c.skill}
            open={openId === c.unit.id} onToggle={() => setOpenId(openId === c.unit.id ? null : c.unit.id)} readOnly={!mine}
            tags={command ? ['Command Unit'] : []}
            toggles={headhunter && onToggleCommand ? [{ label: 'Command Unit', pressed: command, onToggle: () => onToggleCommand(c.unit.id) }] : []} />
        )
      })}
      {side.artillery.length > 0 && (
        <div className="flex flex-col gap-1 px-1">
          <span className="field-label text-text-secondary">Off-Board Artillery · {artilleryPv(side.artillery)} PV, counted toward the other side&apos;s MOV</span>
          {side.artillery.map(a => (
            <span key={a.id} className="text-sm">{ARTILLERY[a.kind].name} · to-hit {ARTILLERY[a.kind].toHit}, damage {ARTILLERY[a.kind].damage}, {ARTILLERY[a.kind].template} · needs a spotter</span>
          ))}
        </div>
      )}
    </section>
  )
}
