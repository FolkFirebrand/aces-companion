import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { ALL_STEP_IDS } from '@/lib/steps'
import type { Sortie } from '@/lib/types'

/**
 * Logs a sortie through to Completed, as a player would: start it, fill it in, tick every step,
 * complete it. `beforeComplete` runs while it is still a draft (e.g. to buy units).
 */
export function logCompletedSortie(fields: Partial<Sortie> = {}, beforeComplete?: (sortieId: string) => void): string {
  const store = useCampaignStore.getState
  let id = ''
  act(() => {
    id = store().addSortie()
    store().updateSortie(id, fields)
  })
  if (beforeComplete) act(() => beforeComplete(id))
  act(() => {
    ALL_STEP_IDS.forEach(step => store().setStepDone(id, step, true))
    store().completeSortie(id)
  })
  return id
}
