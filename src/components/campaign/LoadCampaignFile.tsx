'use client'

import { useRef, useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { downloadTextFile } from '@/lib/campaign-io'
import type { CampaignFile, OlderThanBrowser } from '@/lib/campaign-file'
import { DossierButton } from '@/components/dossier/DossierButton'
import type { DossierButtonVariant } from '@/components/dossier/DossierButton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function useDownloadBackup() {
  const exportCampaignFile = useCampaignStore(s => s.exportCampaignFile)
  return () => {
    const { fileName, contents } = exportCampaignFile()
    downloadTextFile(fileName, contents)
  }
}

/**
 * Asks before replacing the campaign in this browser, offering a Campaign File backup first
 * whenever there is anything to lose (#7).
 */
export function ReplaceCampaignDialog({ open, title, warning, confirmLabel, onConfirm, onCancel }: {
  open: boolean
  title: string
  warning?: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const hasCampaignData = useCampaignStore(s => s.hasCampaignData)
  const downloadBackup = useDownloadBackup()
  const worthSaving = hasCampaignData()

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel() }}>
      <DialogContent className="bg-surface border-line text-text-primary">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-2xl uppercase text-active">{title}</DialogTitle>
        </DialogHeader>
        {warning && <p className="m-0 text-sm text-danger">{warning}</p>}
        <p className="m-0 text-sm text-text-secondary">
          This replaces the campaign in this browser.{worthSaving && ' Download a backup first if you might want it back.'}
        </p>
        <DialogFooter className="gap-2 flex-wrap">
          <DossierButton variant="secondary" onClick={onCancel} className="border-line text-text-secondary">Cancel</DossierButton>
          {worthSaving && <DossierButton variant="secondary" onClick={downloadBackup}>Download backup</DossierButton>}
          <DossierButton variant="danger" onClick={onConfirm}>{confirmLabel}</DossierButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Picks a Campaign File, checks it, warns if it is older than this browser's copy, then loads it. */
export function LoadCampaignFile({ label, variant = 'secondary', className, onLoaded }: {
  label: string
  variant?: DossierButtonVariant
  className?: string
  onLoaded?: () => void
}) {
  const { readCampaignFile, loadCampaignFile } = useCampaignStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ file: CampaignFile; olderThanBrowser: OlderThanBrowser | null } | null>(null)

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
    setPending({ file: result.file, olderThanBrowser: result.olderThanBrowser })
  }

  return (
    <>
      <DossierButton variant={variant} className={className} onClick={() => fileRef.current?.click()}>{label}</DossierButton>
      <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleSelect} className="hidden" aria-hidden="true" tabIndex={-1} />
      {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
      <ReplaceCampaignDialog
        open={pending !== null}
        title="Load this Campaign File?"
        warning={pending?.olderThanBrowser
          ? `This file is from ${pending.olderThanBrowser.fileProgress}, but this browser has progress ${pending.olderThanBrowser.browserProgress}. Loading it loses the newer progress.`
          : undefined}
        confirmLabel="Replace campaign"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return
          loadCampaignFile(pending.file)
          setPending(null)
          onLoaded?.()
        }}
      />
    </>
  )
}
