'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWolfnetStore } from '@/store/wolfnet'
import { newMatchCode } from '@/lib/wolfnet/codes'
import { SCENARIOS, rollScenario } from '@/lib/wolfnet/scenarios'
import { checkDeployment } from '@/lib/wolfnet/rules'
import type { MatchRole } from '@/lib/wolfnet/types'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'
import { DossierButton, dossierButtonClass } from '@/components/dossier/DossierButton'
import { StatusTag } from '@/components/dossier/StatusTag'
import { Field, Section, Select, TextInput } from '@/components/sortie/fields'
import { DeploymentPicker, type DeploymentPick } from './DeploymentPicker'
import { cn } from '@/lib/utils'

const CUSTOM = 'custom'

/** Before a match: the host picks the scenario; both pick a force and the 250 PV of it they deploy. */
export function MatchSetup({ role, code }: { role: MatchRole; code?: string }) {
  const router = useRouter()
  const { forces, match, playerName, setPlayerName, startMatch } = useWolfnetStore()
  const [forceId, setForceId] = useState(forces[0]?.id ?? '')
  const force = forces.find(f => f.id === forceId)
  const [deploymentId, setDeploymentId] = useState(force?.deployments[0]?.id ?? CUSTOM)
  const [custom, setCustom] = useState<DeploymentPick>({ unitIds: [], artilleryIds: [] })
  const [scenario, setScenario] = useState<number | null>(null)
  const [includeBeta, setIncludeBeta] = useState(false)

  const saved = force?.deployments.find(d => d.id === deploymentId)
  const pick: DeploymentPick = saved ?? custom
  const problems = force ? checkDeployment(force, pick).problems : []
  const host = role === 'host'

  function chooseForce(id: string) {
    setForceId(id)
    setDeploymentId(forces.find(f => f.id === id)?.deployments[0]?.id ?? CUSTOM)
    setCustom({ unitIds: [], artilleryIds: [] })
  }

  function start() {
    if (!force) return
    const matchCode = host ? newMatchCode() : code!
    if (startMatch({ code: matchCode, role, forceId: force.id, unitIds: pick.unitIds, artilleryIds: pick.artilleryIds, scenario })) router.push('/wolfnet/match')
  }

  return (
    <>
      <FileHeader label={host ? 'Wolfnet 350 · Host a match' : `Wolfnet 350 · Join match ${code}`} title={host ? 'Start a Match' : 'Join a Match'}
        summary={host ? 'Choose the scenario and your deployment. Your opponent joins with the code you get next.' : 'Choose your deployment; the host has chosen the scenario.'} />
      <PageBody>
        {match && (
          <p className="m-0 p-3 bg-surface border border-danger text-sm">
            This replaces the match in progress (code {match.code}). <Link href="/wolfnet/match" className="text-result underline">Back to it</Link>
          </p>
        )}

        <Field id="wn-setup-player" label="Player name">
          <TextInput id="wn-setup-player" value={playerName} onChange={setPlayerName} placeholder="Your name or callsign" />
        </Field>

        {host && (
          <Section title="Scenario">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm min-h-touch">
                <input type="checkbox" checked={includeBeta} onChange={e => setIncludeBeta(e.target.checked)} className="size-5 accent-[var(--color-active)]" />
                Include beta scenarios (9, 10)
              </label>
              <DossierButton variant="secondary" onClick={() => setScenario(rollScenario(includeBeta))}>Roll D10</DossierButton>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Scenario">
              {SCENARIOS.filter(s => includeBeta || !s.beta || scenario === s.number).map(s => (
                <button key={s.number} type="button" role="radio" aria-checked={scenario === s.number} onClick={() => setScenario(s.number)}
                  className={cn('min-h-touch px-3 py-2 flex items-center gap-3 border-2 text-left', scenario === s.number ? 'border-active bg-surface-raised' : 'border-line bg-surface')}>
                  <span className="w-6 font-mono font-bold text-result">{s.number}</span>
                  <span className="flex-1 font-label font-bold">{s.name}</span>
                  {s.beta && <StatusTag tone="neutral">Beta</StatusTag>}
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section title="Your force">
          {forces.length === 0 ? (
            <p className="m-0 text-sm">You have no forces on this device yet. <Link href="/wolfnet" className="text-result underline">Build one first</Link>.</p>
          ) : (
            <>
              <Field id="wn-setup-force" label="Force">
                <Select id="wn-setup-force" value={forceId} onChange={chooseForce}>
                  {forces.map(f => <option key={f.id} value={f.id}>{f.name || 'Unnamed force'}</option>)}
                </Select>
              </Field>
              {force && (
                <Field id="wn-setup-deployment" label="Deployment">
                  <Select id="wn-setup-deployment" value={deploymentId} onChange={setDeploymentId}>
                    {force.deployments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    <option value={CUSTOM}>Pick units now</option>
                  </Select>
                </Field>
              )}
              {force && (saved
                ? <DeploymentPicker force={force} pick={saved} onChange={p => { setCustom(p); setDeploymentId(CUSTOM) }} />
                : <DeploymentPicker force={force} pick={custom} onChange={setCustom} />)}
            </>
          )}
        </Section>

        {problems.length > 0 && <p className="m-0 text-sm text-text-secondary">You can still play with this deployment, but it isn&apos;t tournament legal.</p>}
        <div className="flex flex-wrap gap-2">
          <DossierButton variant="primary" className="sm:max-w-xs" disabled={!force || pick.unitIds.length === 0 || (host && scenario === null)} onClick={start}>
            {host ? 'Start match' : 'Join match'}
          </DossierButton>
          <Link href="/wolfnet" className={dossierButtonClass('secondary')}>Cancel</Link>
        </div>
        {host && scenario === null && <p className="m-0 text-xs text-text-muted">Choose or roll a scenario to start.</p>}
      </PageBody>
    </>
  )
}
