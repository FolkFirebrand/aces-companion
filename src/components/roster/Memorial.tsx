'use client'

import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import type { MemorialEntry, MemorialReason } from '@/lib/types'
import { StatusTag } from '@/components/dossier/StatusTag'
import { DossierButton } from '@/components/dossier/DossierButton'
import { Field, TextInput } from '@/components/sortie/fields'
import { cn } from '@/lib/utils'

const REASONS: Record<MemorialReason, { label: string; tone: 'hurt' | 'neutral' }> = {
  trulyDestroyed: { label: 'Truly destroyed', tone: 'hurt' },
  killedInAction: { label: 'Killed in action', tone: 'hurt' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
  manual: { label: 'Added by hand', tone: 'neutral' },
}

function TypePicker({ value, onChange, name }: { value: MemorialEntry['type']; onChange: (t: MemorialEntry['type']) => void; name: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['unit', 'pilot'] as const).map(t => (
        <label key={t} className={cn(
          'h-touch flex items-center justify-center border-2 font-label font-bold text-[13px] tracking-[1px] uppercase cursor-pointer',
          value === t ? 'border-active text-active' : 'border-line text-text-secondary'
        )}>
          <input type="radio" name={name} checked={value === t} onChange={() => onChange(t)} className="sr-only" />
          {t === 'unit' ? 'Unit' : 'Named Pilot'}
        </label>
      ))}
    </div>
  )
}

function EntryRow({ entry }: { entry: MemorialEntry }) {
  const { campaign, updateMemorialEntry, removeFromMemorial } = useCampaignStore()
  const [editing, setEditing] = useState(false)
  const sortie = campaign.sorties.find(s => s.id === entry.sortieId)
  const where = sortie ? `Sortie ${sortie.sortieNumber}${sortie.name ? `, ${sortie.name}` : ''}` : entry.note
  const reason = REASONS[entry.reason]

  return (
    <div className="flex flex-col gap-1 py-2.5 border-b border-line">
      <div className="flex justify-between items-baseline gap-2.5">
        <span className="font-label font-bold text-[17px] tracking-[1px] uppercase">{entry.name || 'Unnamed'}</span>
        <StatusTag tone={reason.tone}>{reason.label}</StatusTag>
      </div>
      <div className="flex justify-between items-center gap-2 text-sm text-text-secondary">
        <span>{entry.type === 'unit' ? 'Unit' : 'Named Pilot'}{where ? ` · ${where}` : ''}</span>
        <button type="button" onClick={() => setEditing(e => !e)} className="field-label text-result min-h-touch px-1">
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      {editing && (
        <div className="flex flex-col gap-2.5 pt-1">
          <Field id={`memorial-name-${entry.id}`} label="Name">
            <TextInput id={`memorial-name-${entry.id}`} value={entry.name} onChange={name => updateMemorialEntry(entry.id, { name })} />
          </Field>
          <Field id={`memorial-note-${entry.id}`} label="Note">
            <TextInput id={`memorial-note-${entry.id}`} value={entry.note ?? ''} onChange={note => updateMemorialEntry(entry.id, { note })} />
          </Field>
          {entry.reason === 'manual' ? (
            <DossierButton variant="danger" onClick={() => removeFromMemorial(entry.id)}>Remove entry</DossierButton>
          ) : (
            <p className="m-0 text-[13px] text-text-secondary">Added by a sortie. Reopen that sortie to remove it.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function Memorial() {
  const { campaign, addMemorialEntry } = useCampaignStore()
  const [name, setName] = useState('')
  const [type, setType] = useState<MemorialEntry['type']>('unit')
  const [note, setNote] = useState('')

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 pb-1 border-b-2 border-line">
        <h2 className="m-0 text-lg text-active">Memorial</h2>
        <span className="text-sm text-text-secondary">Units lost and Named Pilots killed in action.</span>
      </div>

      {campaign.memorial.length === 0
        ? <p className="m-0 text-sm text-text-secondary">No losses recorded.</p>
        : <div className="flex flex-col">{campaign.memorial.map(entry => <EntryRow key={entry.id} entry={entry} />)}</div>}

      <form
        className="flex flex-col gap-2.5 p-3 bg-surface border border-line"
        onSubmit={e => {
          e.preventDefault()
          if (!name.trim()) return
          addMemorialEntry({ name: name.trim(), type, note: note.trim() || undefined })
          setName(''); setNote('')
        }}
      >
        <span className="field-label text-active">Add an entry</span>
        <Field id="memorial-new-name" label="Name">
          <TextInput id="memorial-new-name" value={name} onChange={setName} />
        </Field>
        <TypePicker value={type} onChange={setType} name="memorial-new-type" />
        <Field id="memorial-new-note" label="Note (optional)">
          <TextInput id="memorial-new-note" value={note} onChange={setNote} placeholder="e.g. lost in an earlier campaign" />
        </Field>
        <DossierButton variant="secondary" type="submit" disabled={!name.trim()} className="self-start">+ Add to Memorial</DossierButton>
        <p className="m-0 text-[13px] text-text-secondary">Entries from a sortie are added when it&apos;s completed and removed if it&apos;s reopened.</p>
      </form>
    </section>
  )
}
