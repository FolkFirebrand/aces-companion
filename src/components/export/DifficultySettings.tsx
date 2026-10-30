'use client'

import { useCampaignStore } from '@/store/campaign'
import { selectDifficulty, selectExistingForceModifier } from '@/store/selectors'
import { DIFFICULTY_LEVELS } from '@/lib/rules'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DifficultyLevel } from '@/lib/types'

function percent(value: number): string {
  return value > 0 ? `+${value}%` : `${value}%`
}

export function DifficultySettings() {
  const { campaign, updateCampaignMeta } = useCampaignStore()
  const { pvPercent, spPercent } = selectDifficulty(campaign)
  const existingForce = selectExistingForceModifier(campaign)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="difficulty-level" className="text-xs text-bt-text-primary/60 uppercase">Difficulty Level</Label>
        <select
          id="difficulty-level"
          value={campaign.difficultyLevel}
          onChange={e => updateCampaignMeta({ difficultyLevel: e.target.value as DifficultyLevel })}
          className="rounded border border-bt-border bg-bt-background text-bt-text-primary text-sm px-2 h-9 w-56"
        >
          {Object.entries(DIFFICULTY_LEVELS).map(([id, level]) => (
            <option key={id} value={id}>
              {level.name} (PV {percent(level.pvPercent)}, SP {level.spPercent}%)
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </div>

      {campaign.difficultyLevel === 'custom' && (
        <div className="flex gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="custom-pv" className="text-xs text-bt-text-primary/60 uppercase">Player Force PV %</Label>
            <Input id="custom-pv" type="number" value={campaign.customPvPercent}
              onChange={e => updateCampaignMeta({ customPvPercent: Number(e.target.value) })}
              className="bg-bt-background border-bt-border focus:border-bt-accent w-28" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="custom-sp" className="text-xs text-bt-text-primary/60 uppercase">SP Earned %</Label>
            <Input id="custom-sp" type="number" value={campaign.customSpPercent}
              onChange={e => updateCampaignMeta({ customSpPercent: Number(e.target.value) })}
              className="bg-bt-background border-bt-border focus:border-bt-accent w-28" />
          </div>
        </div>
      )}

      <p className="text-sm text-bt-text-primary/60">
        Player Force PV {percent(pvPercent)} · SP Earned {spPercent}% · Existing-Force Modifier {percent(existingForce)}
        <span className="block text-xs">Aces Rulebook p. 28–29</span>
      </p>
    </div>
  )
}
