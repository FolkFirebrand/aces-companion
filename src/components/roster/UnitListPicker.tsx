'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadUnitList } from '@/lib/unit-list/load'
import { ACES_UNIT_TYPES, searchUnitList, unitListName, unitListRoles } from '@/lib/unit-list/convert'
import type { AcesTypeCode, UnitListEntry, UnitListQuery } from '@/lib/unit-list/convert'
import { unitIconUrl } from '@/lib/unit-list/icons'
import { NumberInput, Select, TextInput } from '@/components/sortie/fields'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<AcesTypeCode, string> = { BM: "'Mech", CV: 'Vehicle', BA: 'B. Armor', CI: 'Infantry' }
const SIZES = [1, 2, 3, 4]
const MOVES = [4, 6, 8, 10, 12]
const DAMAGES = [1, 2, 3, 4, 5, 6]
const LIMIT = 50

type Filters = Pick<UnitListQuery, 'pvMin' | 'pvMax' | 'role' | 'minMove' | 'minMediumDamage'> & { sizes: number[] }
const NO_FILTERS: Filters = { sizes: [] }

function chip(on: boolean) {
  return cn('h-touch border-2 font-condensed font-bold text-[13px] tracking-[1px] uppercase', on ? 'border-amber text-amber' : 'border-steel-500 text-text-secondary')
}

/** Search MegaMek's unit list (ADR 0005) and pick a unit. `pvLeft` adds a hint in setup. */
export function UnitListPicker({ onPick, initialText = '', pvLeft }: { onPick: (entry: UnitListEntry) => void; initialText?: string; pvLeft?: number }) {
  const [units, setUnits] = useState<UnitListEntry[] | null>(null)
  const [error, setError] = useState('')
  const [text, setText] = useState(initialText)
  const [types, setTypes] = useState<AcesTypeCode[]>([])
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  useEffect(() => {
    let live = true
    loadUnitList().then(list => { if (live) setUnits(list) }, err => { if (live) setError(err instanceof Error ? err.message : 'The unit list could not be loaded.') })
    return () => { live = false }
  }, [])

  const roles = useMemo(() => (units ? unitListRoles(units) : []), [units])
  const filtersOn = [filters.pvMin, filters.pvMax, filters.role, filters.minMove, filters.minMediumDamage].filter(v => v !== undefined && v !== '').length
    + (filters.sizes.length ? 1 : 0)
  const searching = text.trim() !== '' || types.length > 0 || filtersOn > 0
  const matches = useMemo(
    () => (units && searching ? searchUnitList(units, { text, types, ...filters, limit: Number.POSITIVE_INFINITY }) : []),
    [units, searching, text, types, filters],
  )
  const results = matches.slice(0, LIMIT)
  const set = (change: Partial<Filters>) => setFilters(f => ({ ...f, ...change }))

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor="unit-list-search" className="dossier-label text-text-secondary">Search the unit list</label>
      <TextInput id="unit-list-search" value={text} onChange={setText} placeholder="e.g. Atlas AS7-D" autoComplete="off" />
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Unit types">
        {(Object.keys(ACES_UNIT_TYPES) as AcesTypeCode[]).map(t => {
          const on = types.includes(t)
          return (
            <button key={t} type="button" aria-pressed={on} onClick={() => setTypes(on ? types.filter(x => x !== t) : [...types, t])} className={chip(on)}>
              {TYPE_LABELS[t]}
            </button>
          )
        })}
      </div>

      <details className="border-t border-steel-500 pt-2">
        <summary className="min-h-8 flex items-center cursor-pointer list-none dossier-label text-signal-blue">
          Filters{filtersOn ? ` · ${filtersOn} on` : ''}
        </summary>
        <div className="flex flex-col gap-3 pt-2">
          {filtersOn > 0 && (
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className="self-start dossier-label text-signal-blue min-h-8">Clear filters</button>
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
          <label className="flex flex-col gap-1">
            <span className="dossier-label text-text-secondary">Damage at medium, at least</span>
            <Select id="unit-list-damage" value={String(filters.minMediumDamage ?? '')} onChange={v => set({ minMediumDamage: v ? Number(v) : undefined })}>
              <option value="">Any</option>
              {DAMAGES.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </label>
        </div>
      </details>

      {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
      {!units && !error && <p className="m-0 text-sm text-text-secondary">Loading the unit list…</p>}
      {units && !searching && <p className="m-0 text-[13px] text-text-secondary">{units.length.toLocaleString()} units. Type a name or set a filter.</p>}
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
              </button>
            </li>
          ))}
        </ul>
      )}
      {matches.length > LIMIT && <p className="m-0 text-[13px] text-text-secondary">Showing the first {LIMIT}. Narrow the search or add a filter.</p>}
      <p className="m-0 text-[11px] text-text-secondary">Unit data and icons: MegaMek Data, CC BY-NC-SA 4.0.</p>
    </div>
  )
}
