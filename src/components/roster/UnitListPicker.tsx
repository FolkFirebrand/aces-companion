'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadUnitListFile } from '@/lib/unit-list/load'
import { ACES_UNIT_TYPES, ERAS, searchUnitList, unitListName, unitListRoles } from '@/lib/unit-list/convert'
import type { AcesTypeCode, UnitListEntry, UnitListFaction, UnitListQuery } from '@/lib/unit-list/convert'
import { unitIconUrl } from '@/lib/unit-list/icons'
import { NumberInput, Select, TextInput } from '@/components/sortie/fields'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<AcesTypeCode, string> = { BM: "'Mech", CV: 'Vehicle', BA: 'B. Armor', CI: 'Infantry' }
const SIZES = [1, 2, 3, 4]
const MOVES = [4, 6, 8, 10, 12]
const RANGES = ['Short', 'Medium', 'Long']
const LIMIT = 50

type Filters = Pick<UnitListQuery, 'pvMin' | 'pvMax' | 'role' | 'minMove' | 'minDamage' | 'era'> & { types: AcesTypeCode[]; sizes: number[]; damageRanges: number[]; factions: number[] }
const NO_FILTERS: Filters = { types: [], sizes: [], damageRanges: [], factions: [] }

function chip(on: boolean) {
  return cn('h-touch border-2 font-condensed font-bold text-[13px] tracking-[1px] uppercase', on ? 'border-amber text-amber' : 'border-steel-500 text-text-secondary')
}

/**
 * Search MegaMek's unit list (ADR 0005) and pick a unit. `pvLeft` adds a hint in setup; `tapToAdd` marks each result
 * with + for pickers that add on tap; `aside` sits right of the Filters toggle.
 */
export function UnitListPicker({ onPick, initialText = '', pvLeft, label = 'Search the unit list', tapToAdd = false, aside }: {
  onPick: (entry: UnitListEntry) => void
  initialText?: string
  pvLeft?: number
  label?: string
  tapToAdd?: boolean
  aside?: React.ReactNode
}) {
  const [units, setUnits] = useState<UnitListEntry[] | null>(null)
  const [factions, setFactions] = useState<UnitListFaction[]>([])
  const [error, setError] = useState('')
  const [text, setText] = useState(initialText)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  useEffect(() => {
    let live = true
    loadUnitListFile().then(file => { if (live) { setUnits(file.units); setFactions(file.factions ?? []) } }, err => { if (live) setError(err instanceof Error ? err.message : 'The unit list could not be loaded.') })
    return () => { live = false }
  }, [])

  const roles = useMemo(() => (units ? unitListRoles(units) : []), [units])
  const filtersOn = [filters.pvMin, filters.pvMax, filters.role, filters.minMove, filters.minDamage, filters.era].filter(v => v !== undefined && v !== '').length
    + (filters.types.length ? 1 : 0) + (filters.sizes.length ? 1 : 0) + (filters.factions.length ? 1 : 0)
  const searching = text.trim() !== '' || filtersOn > 0
  const matches = useMemo(
    () => (units && searching ? searchUnitList(units, { text, ...filters, limit: Number.POSITIVE_INFINITY }) : []),
    [units, searching, text, filters],
  )
  const results = matches.slice(0, LIMIT)
  const set = (change: Partial<Filters>) => setFilters(f => ({ ...f, ...change }))

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor="unit-list-search" className={cn('dossier-label', tapToAdd ? 'text-amber' : 'text-text-secondary')}>{label}</label>
      <div className="relative">
        <TextInput id="unit-list-search" type="search" value={text} onChange={setText} placeholder="Search the unit list, e.g. Atlas AS7-D"
          autoComplete="off" className="max-w-none pr-12 [&::-webkit-search-cancel-button]:hidden" />
        {text && (
          <button type="button" aria-label="Clear search" onClick={() => setText('')}
            className="absolute right-0 top-0 w-touch h-touch text-text-secondary hover:text-text-primary">✕</button>
        )}
      </div>
      <div className="relative">
      {aside && <div className="absolute right-0 top-0 min-h-touch flex items-center">{aside}</div>}
      <details>
        <summary className="min-h-touch w-fit flex items-center cursor-pointer list-none dossier-label text-signal-blue">
          Filters{filtersOn ? ` · ${filtersOn} on` : ''} ›
        </summary>
        <div className="flex flex-col gap-3 pt-2">
          {filtersOn > 0 && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className="self-start dossier-label text-signal-blue min-h-8">Clear filters</button>
          )}
          <div className="flex flex-col gap-1">
            <span className="dossier-label text-text-secondary">Type</span>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Unit types">
              {(Object.keys(ACES_UNIT_TYPES) as AcesTypeCode[]).map(t => {
                const on = filters.types.includes(t)
                return (
                  <button key={t} type="button" aria-pressed={on} className={chip(on)}
                    onClick={() => set({ types: on ? filters.types.filter(x => x !== t) : [...filters.types, t] })}>
                    {TYPE_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>
          {factions.length > 0 && (
            <>
              <FactionPicker factions={factions} selected={filters.factions} onChange={selected => set({ factions: selected })} />
              <label className="flex flex-col gap-1">
                <span className="dossier-label text-text-secondary">Era</span>
                <Select id="unit-list-era" value={String(filters.era ?? '')} onChange={v => set({ era: v ? Number(v) : undefined })}>
                  <option value="">Any era</option>
                  {ERAS.map((era, i) => <option key={era.name} value={i}>{era.name} ({era.from}–{era.to ?? ''})</option>)}
                </Select>
              </label>
            </>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="dossier-label text-text-secondary">PV from</span>
              <NumberInput id="unit-list-pv-min" value={filters.pvMin ?? 0} min={0} onChange={v => set({ pvMin: v > 0 ? v : undefined })} className="max-w-none" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="dossier-label text-text-secondary">PV to</span>
              <NumberInput id="unit-list-pv-max" value={filters.pvMax ?? 0} min={0} onChange={v => set({ pvMax: v > 0 ? v : undefined })} className="max-w-none" />
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <span className="dossier-label text-text-secondary">Size</span>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Size">
              {SIZES.map(size => {
                const on = filters.sizes.includes(size)
                return (
                  <button key={size} type="button" aria-pressed={on} className={chip(on)}
                    onClick={() => set({ sizes: on ? filters.sizes.filter(s => s !== size) : [...filters.sizes, size] })}>
                    {size}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="dossier-label text-text-secondary">Role</span>
              <Select id="unit-list-role" value={filters.role ?? ''} onChange={v => set({ role: v || undefined })}>
                <option value="">Any role</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="dossier-label text-text-secondary">Move at least</span>
              <Select id="unit-list-move" value={String(filters.minMove ?? '')} onChange={v => set({ minMove: v ? Number(v) : undefined })}>
                <option value="">Any</option>
                {MOVES.map(m => <option key={m} value={m}>{m}&quot;</option>)}
              </Select>
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="unit-list-damage" className="dossier-label text-text-secondary">Damage at least</label>
            <div className="grid grid-cols-4 gap-1.5">
              <NumberInput id="unit-list-damage" value={filters.minDamage ?? 0} min={0} onChange={v => set({ minDamage: v > 0 ? v : undefined })} className="max-w-none" />
              <div className="col-span-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Damage ranges">
                {RANGES.map((range, r) => {
                  const on = filters.damageRanges.includes(r)
                  return (
                    <button key={range} type="button" aria-pressed={on} className={chip(on)}
                      onClick={() => set({ damageRanges: on ? filters.damageRanges.filter(x => x !== r) : [...filters.damageRanges, r] })}>
                      {range}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </details>
      </div>

      {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
      {!units && !error && <p className="m-0 text-sm text-text-secondary">Loading the unit list…</p>}
      {units && searching && (
        <p className="m-0 text-[13px] text-text-secondary">
          {matches.length === 0 ? 'No units match.' : `${matches.length.toLocaleString()} unit${matches.length === 1 ? ' matches' : 's match'}`}
          {pvLeft !== undefined && matches.length > 0 && ` · ${matches.filter(e => e.pv <= pvLeft).length} fit your ${pvLeft} PV left`}
        </p>
      )}

      {results.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col border-t border-steel-500">
          {results.map(e => (
            <li key={e.id}>
              <button type="button" onClick={() => onPick(e)} className="w-full min-h-touch flex items-center gap-3 py-2 border-b border-steel-500 text-left hover:bg-steel-700">
                <span className="w-10 h-10 shrink-0 bg-steel-900 border border-steel-500 flex items-center justify-center overflow-hidden" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.icon && <img src={unitIconUrl(e.icon)} alt="" loading="lazy" className="w-full h-full object-contain" />}
                </span>
                <span className="flex-1 flex flex-col min-w-0">
                  <span className="font-condensed font-bold text-[15px] tracking-[0.5px] truncate">{unitListName(e)}</span>
                  <span className="text-[13px] text-text-secondary">
                    {TYPE_LABELS[e.type]} · Size {e.size} · A{e.armor} S{e.structure} · {e.damage.join('/')}{e.role ? ` · ${e.role}` : ''}
                  </span>
                </span>
                <span className={cn('font-stencil text-lg whitespace-nowrap', pvLeft !== undefined && e.pv > pvLeft ? 'text-danger' : 'text-amber')}>
                  {e.pv} <span className="text-xs text-text-secondary">PV</span>
                </span>
                {tapToAdd && (
                  <span aria-hidden="true" className="w-8 h-8 shrink-0 flex items-center justify-center border-2 border-signal-blue text-signal-blue font-condensed font-bold text-lg">+</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {tapToAdd && results.length > 0 && <p className="m-0 text-[13px] text-text-secondary">Tap a unit to add it. Tap again to add another.</p>}
      {matches.length > LIMIT && <p className="m-0 text-[13px] text-text-secondary">Showing the first {LIMIT}. Narrow the search or add a filter.</p>}
    </div>
  )
}

/** Multi-select of factions, grouped as MekBay groups them (ADR 0008). */
function FactionPicker({ factions, selected, onChange }: { factions: UnitListFaction[]; selected: number[]; onChange: (selected: number[]) => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = (f: UnitListFaction) => !q || f.name.toLowerCase().includes(q)
  const groups = [...new Set(factions.filter(shown).map(f => f.group))]
  const toggle = (i: number) => onChange(selected.includes(i) ? selected.filter(x => x !== i) : [...selected, i])
  return (
    <div className="flex flex-col gap-1">
      <span className="dossier-label text-text-secondary">Faction</span>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(i => (
            <button key={i} type="button" onClick={() => toggle(i)} aria-label={`Remove ${factions[i].name}`}
              className="min-h-8 px-2 border-2 border-amber text-amber font-condensed font-bold text-[12px] tracking-[0.5px] uppercase">
              {factions[i].name} ✕
            </button>
          ))}
        </div>
      )}
      <details className="border border-steel-500">
        <summary className="min-h-touch px-3 flex items-center cursor-pointer list-none text-[15px] text-text-secondary">
          {selected.length ? `${selected.length} selected · change` : 'Any faction · choose'}
        </summary>
        <div className="px-3 pt-1">
          <TextInput id="unit-list-faction-search" value={query} onChange={setQuery} placeholder="Type to find a faction" autoComplete="off" aria-label="Find a faction" className="max-w-none" />
        </div>
        <div className="max-h-72 overflow-y-auto px-3 pt-1 pb-2 flex flex-col">
          {groups.length === 0 && <p className="m-0 pt-2 text-sm text-text-secondary">No factions match.</p>}
          {groups.map(group => (
            <div key={group} role="group" aria-label={group} className="pt-2">
              <div className="dossier-label text-text-secondary pb-1">{group}</div>
              {factions.map((f, i) => f.group === group && shown(f) && (
                <label key={f.name} className="flex items-center gap-2.5 min-h-8 text-sm cursor-pointer">
                  <input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)}
                    className="w-[18px] h-[18px] shrink-0 accent-[var(--color-amber)]" />
                  {f.name}
                </label>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
