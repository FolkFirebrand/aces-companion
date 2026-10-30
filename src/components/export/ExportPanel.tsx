'use client'

import { useCampaignStore } from '@/store/campaign'
import { DifficultySettings } from './DifficultySettings'
import { DossierButton } from '@/components/dossier/DossierButton'
import { LoadCampaignFile, useDownloadBackup } from '@/components/campaign/LoadCampaignFile'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ExportPanel() {
  const { campaign, updateCampaignMeta } = useCampaignStore()
  const downloadCampaignFile = useDownloadBackup()

  return (
    <div className="max-w-lg space-y-8">
      {/* Campaign settings */}
      <div className="border border-bt-border rounded p-4 bg-bt-surface space-y-4">
        <h2 className="text-bt-accent">Campaign Settings</h2>
        {[
          { label: 'Campaign Name', key: 'name' },
          { label: 'Force Name', key: 'forceName' },
          { label: 'Commanding Officer', key: 'commandingOfficer' },
        ].map(({ label, key }) => (
          <div key={key} className="flex flex-col gap-1">
            <Label className="text-xs text-bt-text-primary/60 uppercase">{label}</Label>
            <Input
              value={(campaign as unknown as Record<string, unknown>)[key] as string ?? ''}
              onChange={e => updateCampaignMeta({ [key]: e.target.value })}
              className="bg-bt-background border-bt-border focus:border-bt-accent"
            />
          </div>
        ))}
        <DifficultySettings />
        <div className="flex flex-col gap-1">
          <Label htmlFor="starting-warchest" className="text-xs text-bt-text-primary/60 uppercase">Starting Warchest Balance (SP)</Label>
          <Input id="starting-warchest" type="number" value={campaign.startingWarchest}
            onChange={e => updateCampaignMeta({ startingWarchest: Number(e.target.value) })}
            className="bg-bt-background border-bt-border focus:border-bt-accent w-28" />
        </div>
      </div>

      {/* Export / Import */}
      <div className="border border-bt-border rounded p-4 bg-bt-surface space-y-4">
        <h2 className="text-bt-accent">Data</h2>
        <p className="text-sm text-bt-text-primary/60">
          Download a Campaign File to back up your campaign or move it to another device.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <DossierButton variant="primary" onClick={downloadCampaignFile} className="sm:flex-1">
            Download Campaign File
          </DossierButton>
          <LoadCampaignFile label="Load Campaign File" className="sm:flex-1 h-button-primary" />
        </div>
      </div>

    </div>
  )
}
