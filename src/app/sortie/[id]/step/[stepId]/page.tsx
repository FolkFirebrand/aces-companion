'use client'

import { use } from 'react'
import Link from 'next/link'
import { notFound, useRouter } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { useHydrated } from '@/lib/useHydrated'
import { selectSortieSteps } from '@/store/selectors'
import { findStep } from '@/lib/steps'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'
import { DossierButton } from '@/components/dossier/DossierButton'
import { StepContent } from '@/components/sortie/StepContent'
import { EarningsSummary } from '@/components/sortie/EarningsSummary'

const SECTION_LABEL = { setup: 'Sortie setup', after: 'After-sortie' }
const SHOWS_EARNINGS = ['after-3', 'after-4', 'after-5', 'after-6']

export default function SortieStepPage({ params }: { params: Promise<{ id: string; stepId: string }> }) {
  const { id, stepId } = use(params)
  const router = useRouter()
  const { campaign, setStepDone } = useCampaignStore()
  const sortie = campaign.sorties.find(s => s.id === id)
  const step = findStep(stepId)
  const hydrated = useHydrated()

  if (!step) return notFound()
  // The campaign lives in this browser, so only after hydration can a missing sortie be told apart.
  if (!hydrated) return null
  if (!sortie) return notFound()
  if (sortie.status === 'completed') {
    return (
      <PageBody>
        <p className="text-text-secondary">This sortie is completed. Reopen it to change its steps.</p>
        <Link href={`/sortie/${sortie.id}`} className="dossier-label text-signal-blue">&lt; Back to the sortie</Link>
      </PageBody>
    )
  }

  const steps = selectSortieSteps(sortie)
  const done = steps.find(s => s.id === stepId)?.done ?? false
  // The next unfinished data step after this one, wrapping round to any earlier one left behind.
  const here = steps.findIndex(s => s.id === stepId)
  const open = (s: (typeof steps)[number]) =>
    !s.done && s.id !== stepId && (sortie.outcome !== 'failed' || s.section === 'setup')
  const next = steps.slice(here + 1).find(open) ?? steps.slice(0, here).find(open)
  // Setup ends at the table: after the last setup step, or once none is left, the battle comes next.
  const lastSetup = steps.filter(s => s.section === 'setup').at(-1)?.id === stepId
  const toPlay = step.section === 'setup' && (lastSetup || next?.section !== 'setup')

  function markDoneAndContinue() {
    setStepDone(id, stepId, true)
    router.push(toPlay ? `/sortie/${id}/play` : next ? `/sortie/${id}/step/${next.id}` : `/sortie/${id}`)
  }

  return (
    <>
      <FileHeader
        label={`${SECTION_LABEL[step.section]} · ${step.number} of 7`}
        title={step.name}
        summary={step.summary}
      >
        <Link href={`/sortie/${id}`} className="dossier-label text-signal-blue self-start min-h-6">&lt; All steps</Link>
      </FileHeader>
      <PageBody>
        <div className="flex flex-col gap-4 max-w-xl">
          <StepContent stepId={stepId} sortie={sortie} />
          <div className="flex flex-col gap-2 pt-2">
            <DossierButton variant="primary" onClick={markDoneAndContinue}>
              {toPlay ? 'Done · Next: Play the Sortie' : next ? `Done · Next: ${next.name}` : 'Done · Back to all steps'}
            </DossierButton>
            {done && (
              <DossierButton variant="secondary" className="self-start" onClick={() => setStepDone(id, stepId, false)}>
                Mark as not done
              </DossierButton>
            )}
          </div>
        </div>
      </PageBody>
      {SHOWS_EARNINGS.includes(stepId) && <EarningsSummary sortie={sortie} />}
    </>
  )
}
