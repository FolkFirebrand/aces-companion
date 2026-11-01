'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { selectCampaignLog, selectReopenBlocker } from '@/store/selectors'
import { downloadTextFile } from '@/lib/campaign-io'
import type { Sortie } from '@/lib/types'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'
import { DossierButton } from '@/components/dossier/DossierButton'
import { Section } from './fields'

function Line({ label, value, tone }: { label: React.ReactNode; value: string; tone: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-2 border-b border-line text-[15px]">
      <span>{label}</span>
      <span className={`font-display font-bold text-[17px] whitespace-nowrap tabular-nums ${tone}`}>{value}</span>
    </div>
  )
}

export function SortieCompleted({ sortie }: { sortie: Sortie }) {
  const { campaign, exportCampaignFile, reopenSortie } = useCampaignStore()
  const [confirmReopen, setConfirmReopen] = useState(false)
  const rows = selectCampaignLog(campaign)
  const index = rows.findIndex(r => r.sortie.id === sortie.id)
  const row = rows[index]
  const before = index > 0 ? rows[index - 1].warchest : campaign.startingWarchest
  const reopenBlocker = selectReopenBlocker(campaign, sortie.id)
  const isLatest = reopenBlocker === null
  const failed = sortie.outcome === 'failed'
  const { fileName } = exportCampaignFile()

  return (
    <>
      <FileHeader label={`File ${sortie.sortieNumber} · Sortie log`} position={failed ? 'Failed' : 'Completed'}
        title={sortie.name || `Sortie ${sortie.sortieNumber}`}
        summary={failed ? 'Recorded as a Failed Sortie. Nothing changed; replay it.' : 'These results are applied to your force.'} />
      <PageBody>
        {isLatest && (
          <div className="bg-surface border border-line">
            <div className="px-3 py-2 bg-active text-on-active font-label font-bold text-sm tracking-[1px]">BACK UP YOUR CAMPAIGN</div>
            <div className="p-3 flex flex-col gap-2.5">
              <p className="m-0 text-sm">Save a Campaign File so this sortie isn&apos;t lost if this browser&apos;s data is cleared. Put it in Dropbox to carry on from another device.</p>
              <DossierButton variant="primary" onClick={() => { const f = exportCampaignFile(); downloadTextFile(f.fileName, f.contents) }}>
                Download Campaign File
              </DossierButton>
              <span className="text-xs text-text-muted break-all">{fileName}</span>
            </div>
          </div>
        )}

        {!failed && row && (
          <Section title="Applied to your force">
            <Line label="Victory · Earnings" value={`${row.earnings >= 0 ? '+' : '−'}${Math.abs(row.earnings)}`} tone="text-result" />
            <Line label="SP to Named Pilots" value={row.namedPilotSp > 0 ? `−${row.namedPilotSp}` : '0'} tone="text-active" />
            {sortie.purchases.map(p => (
              <Line
                key={p.id}
                label={p.kind === 'buy'
                  ? <>Bought {p.unit.nameAndVariant} <span className="text-text-secondary">· joined the roster</span></>
                  : p.kind === 'sell'
                    ? <>Sold {p.unitName} <span className="text-text-secondary">· left the roster</span></>
                    : <>{p.fromName} reconfigured to {p.toName}</>}
                value={p.spCost < 0 ? `+${-p.spCost}` : `−${p.spCost}`}
                tone={p.spCost < 0 ? 'text-result' : 'text-active'}
              />
            ))}
            <div className="flex justify-between items-baseline py-2 border-b-2 border-line">
              <span className="font-label font-bold tracking-[1px]">WARCHEST</span>
              <span className="font-display font-bold text-[22px] text-active tabular-nums">{before} → {row.warchest}</span>
            </div>
          </Section>
        )}

        {isLatest ? (
          <div className="flex flex-col gap-2 pt-1">
            {confirmReopen ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-danger">Reopen? This undoes everything listed above until you complete it again.</span>
                <DossierButton variant="danger" onClick={() => { reopenSortie(sortie.id); setConfirmReopen(false) }}>Reopen sortie</DossierButton>
                <DossierButton variant="secondary" onClick={() => setConfirmReopen(false)}>Cancel</DossierButton>
              </div>
            ) : (
              <DossierButton variant="danger" onClick={() => setConfirmReopen(true)}>Reopen sortie</DossierButton>
            )}
            <p className="m-0 text-[13px] text-text-secondary">Only the latest sortie can be reopened.</p>
          </div>
        ) : (
          <p className="m-0 text-[13px] text-text-secondary">This sortie is locked because later sorties were set up after it. Correct any mistakes in your next sortie, as you would on paper.</p>
        )}

        <Link href="/campaign" className="field-label text-result min-h-touch flex items-center">&lt; Campaign Log</Link>
      </PageBody>
    </>
  )
}
