'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import type { Campaign } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { useDownloadBackup } from '@/components/campaign/LoadCampaignFile'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Starts a new campaign with an Existing Force (Aces Rulebook p. 29): from the campaign in this
 * browser, or from a finished campaign's Campaign File.
 */
export function ExistingForceButton() {
  const router = useRouter()
  const { campaign, hasCampaignData, readCampaignFile, startExistingForceSetup } = useCampaignStore()
  const downloadBackup = useDownloadBackup()
  const fileRef = useRef<HTMLInputElement>(null)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState('')
  const hasCampaign = hasCampaignData()

  function begin(finished: Campaign) {
    startExistingForceSetup(finished)
    router.push('/setup')
  }

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!selected) return
    const result = readCampaignFile(await selected.text())
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    setChoosing(false)
    begin(result.file.campaign)
  }

  return (
    <>
      <DossierButton variant="secondary" onClick={() => (hasCampaign ? setChoosing(true) : fileRef.current?.click())}>
        New campaign with Existing Force
      </DossierButton>
      <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleSelect} className="hidden" aria-hidden="true" tabIndex={-1} />
      {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}

      <Dialog open={choosing} onOpenChange={o => { if (!o) setChoosing(false) }}>
        <DialogContent className="bg-steel-800 border-steel-500 text-text-primary">
          <DialogHeader>
            <DialogTitle className="font-stencil text-2xl font-normal uppercase text-amber">Carry over a force?</DialogTitle>
          </DialogHeader>
          <p className="m-0 text-sm text-text-secondary">
            Start a new campaign with the force and Named Pilots from a finished campaign. The new campaign replaces
            the one in this browser when you start it. Download a backup first if you might want it back.
          </p>
          <div className="flex flex-col gap-2">
            <DossierButton variant="primary" onClick={() => { setChoosing(false); begin(campaign) }}>
              Carry over {campaign.forceName || campaign.name || 'this campaign’s force'}
            </DossierButton>
            <DossierButton variant="secondary" onClick={() => fileRef.current?.click()}>Use a Campaign File</DossierButton>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <DossierButton variant="secondary" onClick={() => setChoosing(false)} className="border-steel-500 text-text-secondary">Cancel</DossierButton>
            <DossierButton variant="secondary" onClick={downloadBackup}>Download backup</DossierButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
