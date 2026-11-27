'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWolfnetStore } from '@/store/wolfnet'
import { normalizeMatchCode } from '@/lib/wolfnet/codes'
import { ERAS } from '@/lib/unit-list/convert'
import { FORCE_PV, checkForce, forcePv } from '@/lib/wolfnet/rules'
import { scenarioByNumber } from '@/lib/wolfnet/scenarios'
import { useHydrated } from '@/lib/useHydrated'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'
import { DossierButton, dossierButtonClass } from '@/components/dossier/DossierButton'
import { StatusTag } from '@/components/dossier/StatusTag'
import { Field, Section, TextInput } from '@/components/sortie/fields'
import { useListContext } from './useListContext'

/** The Wolfnet 350 module's home: your name, your forces, and the way into a match. */
export function WolfnetHome() {
  const router = useRouter()
  const hydrated = useHydrated()
  const { forces, match, playerName, setPlayerName, createForce } = useWolfnetStore()
  const list = useListContext()
  const [code, setCode] = useState('')
  const joinCode = normalizeMatchCode(code)

  return (
    <>
      <FileHeader label="Wolfnet 350 · Tournament" title="Forces and Matches"
        summary="Build a 350 PV force, deploy 250 PV of it each scenario, and play your opponent live from two devices." />
      {hydrated && (
        <PageBody>
          {match && (
            <div className="bg-surface border border-active">
              <div className="flex justify-between px-3 py-2 bg-active text-on-active font-label font-bold text-sm tracking-[1px] uppercase">
                <span>Match in progress</span><span>Code {match.code}</span>
              </div>
              <Link href="/wolfnet/match" className="flex justify-between items-center gap-3 p-3 min-h-touch">
                <span className="flex flex-col gap-0.5">
                  <span className="font-display font-bold text-xl uppercase">{match.me.forceName || 'Your force'} vs {match.opponent?.forceName || 'waiting…'}</span>
                  <span className="text-sm text-text-secondary">{scenarioByNumber(match.scenario)?.name ?? 'Scenario not chosen'} · {match.me.vp}–{match.opponent?.vp ?? 0}</span>
                </span>
                <span className="font-label font-bold tracking-[1px] text-active">CONTINUE &gt;</span>
              </Link>
            </div>
          )}

          <Section title="You">
            <Field id="wn-player" label="Player name" hint="Your opponent sees this.">
              <TextInput id="wn-player" value={playerName} onChange={setPlayerName} placeholder="Your name or callsign" />
            </Field>
          </Section>

          <Section title="Play a match">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 bg-surface border border-line p-3">
                <span className="field-label text-text-secondary">Host</span>
                <p className="m-0 text-sm">Pick the scenario and your deployment; you&apos;ll get a code to give your opponent.</p>
                <Link href="/wolfnet/match/new" className={dossierButtonClass('primary', 'mt-auto')}>Start a match</Link>
              </div>
              <form className="flex flex-col gap-2 bg-surface border border-line p-3" onSubmit={e => { e.preventDefault(); if (joinCode) router.push(`/wolfnet/join/${joinCode}`) }}>
                <span className="field-label text-text-secondary">Join</span>
                <Field id="wn-join" label="Match code">
                  <TextInput id="wn-join" value={code} onChange={setCode} placeholder="e.g. K7QX2M" autoCapitalize="characters" autoComplete="off" className="font-mono uppercase tracking-[3px]" />
                </Field>
                <DossierButton variant="secondary" type="submit" disabled={!joinCode} className="mt-auto">Join match</DossierButton>
              </form>
            </div>
          </Section>

          <Section title="Your forces" aside={`${forces.length}`}>
            {forces.length === 0 && <p className="m-0 text-sm text-text-secondary">No forces yet. Forces are saved on this device.</p>}
            {forces.map(f => {
              const pv = forcePv(f.units, f.artillery)
              const legal = checkForce(f, list ?? undefined).problems.length === 0
              return (
                <Link key={f.id} href={`/wolfnet/force/${f.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 min-h-touch bg-surface border border-line hover:border-active">
                  <span className="flex-1 min-w-[10rem] flex flex-col">
                    <span className="font-label font-bold text-[17px]">{f.name || 'Unnamed force'}</span>
                    <span className="text-xs text-text-secondary">
                      {[f.faction, f.era !== null ? ERAS[f.era].name : null].filter(Boolean).join(' · ') || 'No faction or era yet'} · {f.units.length} units · {f.deployments.length} deployments
                    </span>
                  </span>
                  <span className="font-mono font-bold text-result">{pv}/{FORCE_PV}</span>
                  {legal ? <StatusTag tone="keyword">Legal</StatusTag> : <StatusTag tone="hurt">Not legal</StatusTag>}
                </Link>
              )
            })}
            <DossierButton variant="secondary" className="self-start" onClick={() => router.push(`/wolfnet/force/${createForce()}`)}>+ New force</DossierButton>
          </Section>
        </PageBody>
      )}
    </>
  )
}
