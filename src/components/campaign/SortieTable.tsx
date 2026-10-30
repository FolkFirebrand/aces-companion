'use client'

import { useRouter } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { selectCampaignKeywords, selectCampaignLog, selectDifficultyName, selectNextSortieNote, selectWarchestBalance } from '@/store/selectors'
import type { CampaignLogRow } from '@/store/selectors'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'
import { LedgerRow } from '@/components/dossier/LedgerRow'
import { StatusTag } from '@/components/dossier/StatusTag'
import { DossierButton } from '@/components/dossier/DossierButton'

const COLUMNS = ['Date', 'Sortie', 'Name', 'Outcome', 'Earnings', 'Named Pilots', 'Purchases', 'Warchest', 'Keywords Gained']

function signed(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0'
}

function minus(value: number): string {
  return value > 0 ? `−${value}` : '0'
}

function rowTitle({ sortie }: CampaignLogRow): string {
  return sortie.name ? `${sortie.sortieNumber} · ${sortie.name}` : `Sortie ${sortie.sortieNumber}`
}

export function SortieTable() {
  const router = useRouter()
  const { campaign, addSortie } = useCampaignStore()
  const rows = selectCampaignLog(campaign)
  const completedCount = rows.filter(r => r.status === 'completed').length
  const warchest = selectWarchestBalance(campaign)
  const nextNumber = String(rows.length + 1).padStart(2, '0')
  const draft = rows.find(r => r.status === 'draft')
  const nextNote = selectNextSortieNote(campaign)
  const keywords = selectCampaignKeywords(campaign)

  function handleNewSortie() {
    const id = addSortie()
    router.push(`/sortie/${id}`)
  }

  return (
    <>
      <FileHeader
        label={`${campaign.forceName || 'New force'} · Company ledger`}
        position={selectDifficultyName(campaign)}
        title="Campaign Log"
      />
      <PageBody>
        <div className="flex justify-between items-end gap-4">
          <div className="flex flex-col">
            <span className="dossier-label text-text-secondary">Warchest</span>
            <span className="font-stencil text-[44px] leading-none text-amber tabular-nums">
              {warchest} <span className="text-xl">SP</span>
            </span>
          </div>
          <p className="m-0 text-right text-[13px] text-text-secondary">
            Started at {campaign.startingWarchest} SP<br />
            {completedCount} {completedCount === 1 ? 'sortie' : 'sorties'} completed
          </p>
        </div>

        {nextNote && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-steel-800 border border-signal-blue text-sm">
            <span className="font-condensed font-bold tracking-[1px] text-signal-blue">NEXT</span>
            <span>{nextNote}</span>
          </div>
        )}

        {/* Phones: ledger rows, newest first */}
        <div className="md:hidden flex flex-col">
          {[...rows].reverse().map(row => (
            <LedgerRow
              key={row.sortie.id}
              href={`/sortie/${row.sortie.id}`}
              title={rowTitle(row)}
              state={row.status === 'draft' ? { label: 'DRAFT', tone: 'neutral' }
                : row.counts ? { label: 'VICTORY', tone: 'computed' } : { label: 'FAILED · REPLAYED', tone: 'danger' }}
              detail={row.status === 'draft' ? 'In progress · counts once completed'
                : row.counts ? `${signed(row.earnings)} earned · ${minus(row.namedPilotSp)} pilots · ${minus(row.purchases)} bought`
                : 'No effect on the Warchest'}
              balance={row.warchest}
              keywords={row.sortie.keywordsGained}
              inactive={row.status === 'completed' && !row.counts}
            />
          ))}
          {rows.length === 0 && <p className="text-text-secondary">No sorties logged yet.</p>}
        </div>

        {/* Tablets and wider: the paper Campaign Log's columns */}
        <div className="hidden md:block overflow-x-auto border border-steel-500">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-steel-800">
              <tr>
                {COLUMNS.map(h => (
                  <th key={h} className="px-3 py-2 text-left dossier-label text-text-secondary whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-steel-500">
                <td colSpan={7} className="px-3 py-2">Starting Warchest Balance</td>
                <td className="px-3 py-2 font-stencil text-lg text-amber">{campaign.startingWarchest}</td>
                <td />
              </tr>
              {rows.map(({ sortie, counts, earnings, namedPilotSp, purchases, warchest: balance }) => (
                <tr
                  key={sortie.id}
                  onClick={() => router.push(`/sortie/${sortie.id}`)}
                  className={`cursor-pointer border-t border-steel-500 hover:bg-steel-600 ${counts || sortie.status === 'draft' ? '' : 'text-text-disabled'}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">{sortie.datePlayed}</td>
                  <td className="px-3 py-2">{sortie.sortieNumber}</td>
                  <td className="px-3 py-2">
                    <a href={`/sortie/${sortie.id}`} onClick={e => { e.preventDefault(); router.push(`/sortie/${sortie.id}`) }} className="font-semibold">
                      {sortie.name || `Sortie ${sortie.sortieNumber}`}
                    </a>
                  </td>
                  <td className={`px-3 py-2 font-condensed font-semibold tracking-[1px] ${
                    sortie.status === 'draft' ? 'text-text-secondary' : counts ? 'text-signal-blue' : 'text-danger'}`}>
                    {sortie.status === 'draft' ? 'DRAFT' : counts ? 'VICTORY' : 'FAILED'}
                  </td>
                  {counts ? (
                    <>
                      <td className="px-3 py-2">{signed(earnings)}</td>
                      <td className="px-3 py-2">{minus(namedPilotSp)}</td>
                      <td className="px-3 py-2">{minus(purchases)}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="px-3 py-2">
                      {sortie.status === 'draft' ? 'In progress · counts once completed' : 'No effect on the Warchest'}
                    </td>
                  )}
                  <td className={`px-3 py-2 font-stencil text-lg ${counts ? 'text-amber' : ''}`}>{balance}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1.5">
                      {sortie.keywordsGained.map(k => <StatusTag key={k} tone="keyword">{k.toUpperCase()}</StatusTag>)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {keywords.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="dossier-label text-text-secondary pb-1 border-b-2 border-steel-500">Campaign keywords</div>
            <div className="flex flex-wrap gap-2">
              {keywords.map(k => <StatusTag key={k} tone="keyword">{k.toUpperCase()}</StatusTag>)}
            </div>
          </section>
        )}

        <DossierButton variant="primary" onClick={handleNewSortie} className="md:max-w-sm">
          {draft ? `Continue Sortie ${draft.sortie.sortieNumber}` : `+ Log Sortie ${nextNumber}`}
        </DossierButton>
      </PageBody>
    </>
  )
}
