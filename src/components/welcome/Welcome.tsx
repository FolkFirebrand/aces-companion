'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { selectWarchestBalance } from '@/store/selectors'
import { latestSortie } from '@/lib/campaign-file'
import { DossierButton } from '@/components/dossier/DossierButton'
import { LoadCampaignFile, ReplaceCampaignDialog } from '@/components/campaign/LoadCampaignFile'
import { useHydrated } from '@/lib/useHydrated'
import { ExistingForceButton } from './ExistingForceButton'

const STEPS = [
  'Build your force and Named Pilots.',
  'Log each sortie with the book’s setup and after-sortie steps.',
  'Save a Campaign File after every sortie to move between devices.',
]

export function Welcome() {
  const router = useRouter()
  const { campaign, setupDraft, startSetup, hasCampaignData } = useCampaignStore()
  const hydrated = useHydrated()
  const [confirmNew, setConfirmNew] = useState(false)
  const hasCampaign = hasCampaignData()
  const latest = latestSortie(campaign)

  function beginSetup() {
    startSetup()
    router.push('/setup')
  }

  return (
    <div className="max-w-xl mx-auto px-gutter py-6 flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="m-0 text-[36px] leading-none text-active">Aces Campaign Log</h1>
        <span className="field-label text-text-secondary">Mercenary company records</span>
        <p className="m-0 mt-1.5 text-[15px] leading-snug">
          Keep your force roster, sortie logs and pilot records for an Aces campaign, step by step alongside your rulebook.
        </p>
      </div>

      {!hydrated ? (
        // Holds the space for the actions below until this browser's campaign is known.
        <div className="min-h-[200px]" aria-busy="true" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {hasCampaign && (
            <div className="bg-surface border border-line">
              <div className="flex justify-between px-3 py-2 bg-active text-on-active font-label font-bold text-sm tracking-[1px] uppercase">
                <span>Active file</span>
                <span>{latest ? `After Sortie ${latest.sortieNumber}` : 'At setup'}</span>
              </div>
              <Link href="/campaign" className="flex justify-between items-center gap-3 p-3 min-h-touch">
                <span className="flex flex-col gap-0.5">
                  <span className="font-display font-bold text-[22px] uppercase">{campaign.forceName || campaign.name || 'Your campaign'}</span>
                  <span className="text-sm text-text-secondary">
                    Warchest {selectWarchestBalance(campaign)} SP · {campaign.namedPilots.length} Named Pilots
                  </span>
                </span>
                <span className="font-label font-bold text-[15px] tracking-[1px] text-active">CONTINUE &gt;</span>
              </Link>
            </div>
          )}

          {setupDraft ? (
            <DossierButton variant="primary" onClick={() => router.push('/setup')}>
              Continue setting up{setupDraft.name ? `: ${setupDraft.name}` : ''}
            </DossierButton>
          ) : (
            <>
              <DossierButton variant="primary" onClick={() => (hasCampaign ? setConfirmNew(true) : beginSetup())}>
                Start new campaign
              </DossierButton>
              <ExistingForceButton />
            </>
          )}
          <LoadCampaignFile label="Continue from Campaign File" className="w-full h-12" onLoaded={() => router.push('/campaign')} />
        </div>
      )}

      <section className="flex flex-col gap-2">
        <div className="field-label text-text-secondary pb-1 border-b border-line">How it works</div>
        <ol className="m-0 p-0 list-none flex flex-col gap-2">
          {STEPS.map((text, i) => (
            <li key={text} className="flex gap-2.5 text-sm">
              <span className="font-display font-bold text-active w-4">{i + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <figure className="m-0 flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/welcome/sortie-steps.png" alt="A sortie's checklist: the book's setup and after-sortie steps in order" className="w-full border border-line" />
            <figcaption className="text-xs text-text-secondary">Every sortie follows the book&apos;s steps.</figcaption>
          </figure>
          <figure className="m-0 flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/welcome/campaign-log.png" alt="The Campaign Log: the Warchest and each sortie's earnings" className="w-full border border-line" />
            <figcaption className="text-xs text-text-secondary">The Campaign Log keeps the books for you.</figcaption>
          </figure>
        </div>
      </section>

      <ReplaceCampaignDialog
        open={confirmNew}
        title="Start a new campaign?"
        confirmLabel="Start new campaign"
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => { setConfirmNew(false); beginSetup() }}
      />
    </div>
  )
}
