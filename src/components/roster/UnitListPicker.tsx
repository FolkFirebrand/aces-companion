'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadUnitListFile } from '@/lib/unit-list/load'
import { ACES_UNIT_TYPES, ERAS, MOVE_TYPES, UNIT_LIST_SORTS, searchUnitList, sortUnitList, unitFromEntry, unitListName, unitListRoles, unitListSpecials } from '@/lib/unit-list/convert'
import type { AcesTypeCode, MoveTypeKey, UnitListEntry, UnitListSort, UnitListFaction, UnitListQuery } from '@/lib/unit-list/convert'
import { unitIconUrl } from '@/lib/unit-list/icons'
import { OptionalNumberInput, Select, TextInput } from '@/components/sortie/fields'
import { StatusTag } from '@/components/dossier/StatusTag'
import { UnitStats } from './UnitStats'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<AcesTypeCode, string> = { BM: "'Mech", CV: 'Vehicle', BA: 'B. Armor', CI: 'Infantry' }
const SIZES = [1, 2, 3, 4]
const OVS = [1, 2, 3, 4]
const RANGES = ['S', 'M', 'L']
const LIMIT = 50

/** Plain names for the commoner specials; the rest show their code alone, as on the unit card. */
const SPECIAL_NAMES: Record<string, string> = {
  AC: 'Autocannon', AECM: 'Angel ECM', AM: "Anti-'Mech", AMS: 'Anti-missile system', ARM: 'Armored components',
  BH: 'Bloodhound probe', C3I: 'Improved C3', C3M: 'C3 master', C3S: 'C3 slave', CAR: 'Cargo', CASE: 'CASE', CASEII: 'CASE II',
  CR: 'Critical-resistant', ECM: 'ECM', ENE: 'Energy', FLK: 'Flak', HT: 'Heat', IF: 'Indirect fire', IT: 'Infantry transport',
  LECM: 'Light ECM', LMAS: 'Light mimetic armor', LPRB: 'Light probe', LRM: 'LRM', LTAG: 'Light TAG', MAS: 'Mimetic armor',
  MEC: 'Mechanized', MEL: 'Melee', MHQ: 'Mobile HQ', OMNI: 'Omni', PRB: 'Active probe', RCN: 'Recon', REAR: 'Rear weapons',
  SRCH: 'Searchlight', SRM: 'SRM', STL: 'Stealth', TAG: 'TAG', TOR: 'Torpedo', TSM: 'Triple-strength myomer', TUR: 'Turret',
  UMU: 'Underwater maneuvering', XMEC: 'Extended mechanized',
}

type Filters = Pick<UnitListQuery, 'pvMin' | 'pvMax' | 'role' | 'minMove' | 'minTmm' | 'minArmor' | 'minStructure' | 'minOv' | 'era'> & {
  types: AcesTypeCode[]; sizes: number[]; factions: number[]; moveTypes: MoveTypeKey[]; minDamage: [short?: number, medium?: number, long?: number]; specials: string[]
}
const NO_FILTERS: Filters = { types: [], sizes: [], factions: [], moveTypes: [], minDamage: [], specials: [] }

function toggled<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item]
}

/** Each filter that is on, as a short label and how to turn it off. */
function activeFilters(f: Filters, factions: UnitListFaction[], set: (change: Partial<Filters>) => void): { key: string; label: string; clear: () => void }[] {
  const on: { key: string; label: string; clear: () => void }[] = []
  const add = (key: string, label: string, clear: Partial<Filters>) => on.push({ key, label, clear: () => set(clear) })
  if (f.types.length) add('types', f.types.map(t => TYPE_LABELS[t]).join(', '), { types: [] })
  if (f.sizes.length) add('sizes', `Size ${f.sizes.join(', ')}`, { sizes: [] })
  if (f.pvMin !== undefined || f.pvMax !== undefined) add('pv', `PV ${f.pvMin ?? 0}–${f.pvMax ?? '∞'}`, { pvMin: undefined, pvMax: undefined })
  if (f.role) add('role', f.role, { role: undefined })
  if (f.factions.length) add('factions', f.factions.length === 1 ? factions[f.factions[0]]?.name ?? '1 faction' : `${f.factions.length} factions`, { factions: [] })
  if (f.era !== undefined) add('era', ERAS[f.era].name, { era: undefined })
  if (f.moveTypes.length || f.minMove !== undefined) {
    const how = f.moveTypes.length ? f.moveTypes.map(t => MOVE_TYPES[t].label).join('/') : 'Move'
    add('move', f.minMove !== undefined ? `${how} ${f.minMove}"+` : how, { moveTypes: [], minMove: undefined })
  }
  if (f.minTmm !== undefined) add('minTmm', `TMM ${f.minTmm}+`, { minTmm: undefined })
  if (f.minArmor !== undefined) add('minArmor', `A ${f.minArmor}+`, { minArmor: undefined })
  if (f.minStructure !== undefined) add('minStructure', `S ${f.minStructure}+`, { minStructure: undefined })
  if (f.minDamage.some(d => d !== undefined)) {
    add('minDamage', `Dmg ${f.minDamage.map((d, r) => (d === undefined ? null : `${RANGES[r]}${d}+`)).filter(Boolean).join(' ')}`, { minDamage: [] })
  }
  if (f.minOv !== undefined) add('minOv', `OV ${f.minOv}+`, { minOv: undefined })
  for (const code of f.specials) add(`special-${code}`, code, { specials: f.specials.filter(c => c !== code) })
  return on
}

function chip(on: boolean) {
  return cn('h-touch border-2 font-label font-bold text-[13px] tracking-[1px] uppercase', on ? 'border-active text-active' : 'border-line text-text-secondary')
}

/**
 * Search MegaMek's unit list (ADR 0005) and pick a unit. `pvLeft` adds a hint in setup; with `tapToAdd`, tapping a
 * result opens its full stats and its + button picks it; `aside` sits right of the Filters button.
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
  const [showFilters, setShowFilters] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [sort, setSort] = useState<UnitListSort>('name')

  useEffect(() => {
    let live = true
    loadUnitListFile().then(file => { if (live) { setUnits(file.units); setFactions(file.factions ?? []) } }, err => { if (live) setError(err instanceof Error ? err.message : 'The unit list could not be loaded.') })
    return () => { live = false }
  }, [])

  const roles = useMemo(() => (units ? unitListRoles(units) : []), [units])
  const specials = useMemo(() => (units ? unitListSpecials(units) : []), [units])
  const set = (change: Partial<Filters>) => setFilters(f => ({ ...f, ...change }))
  const active = activeFilters(filters, factions, set)
  const filtersOn = active.length
  const searching = text.trim() !== '' || filtersOn > 0
  const matches = useMemo(
    () => (units && searching ? sortUnitList(searchUnitList(units, { text, ...filters, limit: Number.POSITIVE_INFINITY }), sort, filters.moveTypes) : []),
    [units, searching, text, filters, sort],
  )
  const results = matches.slice(0, LIMIT)
  const minInput = (id: string, key: 'pvMin' | 'pvMax' | 'minMove' | 'minTmm' | 'minArmor' | 'minStructure') => (
    <OptionalNumberInput id={id} value={filters[key]} onChange={v => set({ [key]: v })} />
  )
  const onIn = (prefix: string[]) => active.filter(f => prefix.some(p => f.key.startsWith(p))).length

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor="unit-list-search" className={cn('field-label', tapToAdd ? 'text-active' : 'text-text-secondary')}>{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-expanded={showFilters} aria-controls="unit-list-filters" onClick={() => setShowFilters(o => !o)}
          className={cn('h-touch px-3 flex items-center gap-2 border border-active text-active font-label font-bold text-[13px] tracking-[1px] uppercase',
            showFilters && 'bg-surface-raised')}>
          Filters
          {filtersOn > 0 && (
            <span className="min-w-5 h-5 px-1 flex items-center justify-center bg-active text-on-active text-xs" aria-label={`${filtersOn} on`}>{filtersOn}</span>
          )}
          <span aria-hidden="true">{showFilters ? '▴' : '▾'}</span>
        </button>
        {filtersOn > 0 && (
          <button type="button" onClick={() => setFilters(NO_FILTERS)}
            className="h-touch px-3 border-2 border-danger text-danger font-label font-bold text-[13px] tracking-[1px] uppercase">
            Clear filters ✕
          </button>
        )}
        {aside && <div className="ml-auto min-h-touch flex items-center">{aside}</div>}
      </div>
      {!showFilters && active.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Filters on">
          {active.map(f => (
            <button key={f.key} type="button" onClick={f.clear} aria-label={`Remove filter ${f.label}`}
              className="min-h-8 px-2 border border-active text-active font-label font-bold text-[12px] tracking-[0.5px] uppercase">
              {f.label} ✕
            </button>
          ))}
        </div>
      )}
      {showFilters && (
        <div id="unit-list-filters" className="flex flex-col bg-surface border border-line">
          <FilterSection title="Unit" defaultOpen on={onIn(['types', 'sizes', 'pv', 'role', 'factions', 'era'])}>
            <div className="flex flex-col gap-1">
              <span className="field-label text-text-secondary">Type</span>
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Unit types">
                {(Object.keys(ACES_UNIT_TYPES) as AcesTypeCode[]).map(t => {
                  const on = filters.types.includes(t)
                  return <button key={t} type="button" aria-pressed={on} className={chip(on)} onClick={() => set({ types: toggled(filters.types, t) })}>{TYPE_LABELS[t]}</button>
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="field-label text-text-secondary">Size</span>
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Size">
                {SIZES.map(size => {
                  const on = filters.sizes.includes(size)
                  return <button key={size} type="button" aria-pressed={on} className={chip(on)} onClick={() => set({ sizes: toggled(filters.sizes, size) })}>{size}</button>
                })}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="field-label text-text-secondary">PV from</span>
                {minInput('unit-list-pv-min', 'pvMin')}
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-label text-text-secondary">PV to</span>
                {minInput('unit-list-pv-max', 'pvMax')}
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-label text-text-secondary">Role</span>
                <Select id="unit-list-role" value={filters.role ?? ''} onChange={v => set({ role: v || undefined })}>
                  <option value="">Any role</option>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
              </label>
            </div>
            {factions.length > 0 && (
              <>
                <FactionPicker factions={factions} selected={filters.factions} onChange={selected => set({ factions: selected })} />
                <label className="flex flex-col gap-1">
                  <span className="field-label text-text-secondary">Era</span>
                  <Select id="unit-list-era" value={String(filters.era ?? '')} onChange={v => set({ era: v ? Number(v) : undefined })}>
                    <option value="">Any era</option>
                    {ERAS.map((era, i) => <option key={era.name} value={i}>{era.name} ({era.from}–{era.to ?? ''})</option>)}
                  </Select>
                </label>
              </>
            )}
          </FilterSection>

          <FilterSection title="Movement" on={onIn(['move'])}>
            <div className="flex flex-col gap-1">
              <span className="field-label text-text-secondary">Moves by <span className="normal-case tracking-normal font-body font-normal">(any of)</span></span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Move types">
                {(Object.keys(MOVE_TYPES) as MoveTypeKey[]).map(t => {
                  const on = filters.moveTypes.includes(t)
                  return <button key={t} type="button" aria-pressed={on} className={cn(chip(on), 'px-3')} onClick={() => set({ moveTypes: toggled(filters.moveTypes, t) })}>{MOVE_TYPES[t].label}</button>
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="field-label text-text-secondary">
                  {filters.moveTypes.length ? `${filters.moveTypes.map(t => MOVE_TYPES[t].label).join(' or ')} at least (")` : 'Move at least (")'}
                </span>
                {minInput('unit-list-move', 'minMove')}
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-label text-text-secondary">TMM at least</span>
                {minInput('unit-list-tmm', 'minTmm')}
              </label>
            </div>
          </FilterSection>

          <FilterSection title="Armor & structure" on={onIn(['minArmor', 'minStructure'])}>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="field-label text-text-secondary">Armor at least</span>
                {minInput('unit-list-armor', 'minArmor')}
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-label text-text-secondary">Structure at least</span>
                {minInput('unit-list-structure', 'minStructure')}
              </label>
            </div>
          </FilterSection>

          <FilterSection title="Firepower" on={onIn(['minDamage', 'minOv'])}>
            <div className="flex flex-col gap-1">
              <span className="field-label text-text-secondary">Damage at least</span>
              <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Damage at least, by range">
                {RANGES.map((range, r) => (
                  <label key={range} className="flex items-center border border-line bg-surface-deep">
                    <span className="w-9 shrink-0 text-center field-label text-text-secondary">{range}</span>
                    <OptionalNumberInput id={`unit-list-damage-${range}`} value={filters.minDamage[r]} aria-label={`${range} damage at least`}
                      onChange={v => { const next = [...filters.minDamage] as Filters['minDamage']; next[r] = v; set({ minDamage: next }) }}
                      className="border-0 border-l border-line" />
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="field-label text-text-secondary">Overheat (OV)</span>
              <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Overheat at least">
                <button type="button" aria-pressed={filters.minOv === undefined} className={chip(filters.minOv === undefined)} onClick={() => set({ minOv: undefined })}>Any</button>
                {OVS.map(ov => {
                  const on = filters.minOv === ov
                  return <button key={ov} type="button" aria-pressed={on} className={chip(on)} onClick={() => set({ minOv: on ? undefined : ov })}>{ov === 4 ? '4' : `${ov}+`}</button>
                })}
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Specials" on={onIn(['special-'])}>
            <SpecialPicker specials={specials} selected={filters.specials} onChange={selected => set({ specials: selected })} />
          </FilterSection>
        </div>
      )}

      <div className="relative">
        <TextInput id="unit-list-search" type="search" value={text} onChange={setText} placeholder="Search the unit list, e.g. Atlas AS7-D"
          autoComplete="off" className="max-w-none pr-12 [&::-webkit-search-cancel-button]:hidden" />
        {text && (
          <button type="button" aria-label="Clear search" onClick={() => setText('')}
            className="absolute right-0 top-0 w-touch h-touch text-text-secondary hover:text-text-primary">✕</button>
        )}
      </div>

      {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
      {!units && !error && <p className="m-0 text-sm text-text-secondary">Loading the unit list…</p>}
      {units && searching && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[13px] text-text-secondary">
            {matches.length === 0 ? 'No units match.' : `${matches.length.toLocaleString()} unit${matches.length === 1 ? ' matches' : 's match'}`}
            {pvLeft !== undefined && matches.length > 0 && ` · ${matches.filter(e => e.pv <= pvLeft).length} fit your ${pvLeft} PV left`}
          </p>
          {matches.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="field-label text-text-secondary">Sort</span>
              <Select id="unit-list-sort" value={sort} onChange={v => setSort(v as UnitListSort)} className="h-9 w-auto py-0 text-sm">
                {(Object.keys(UNIT_LIST_SORTS) as UnitListSort[]).map(s => <option key={s} value={s}>{UNIT_LIST_SORTS[s]}</option>)}
              </Select>
            </label>
          )}
        </div>
      )}

      {results.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col border-t border-line">
          {results.map(e => {
            const pv = (
              <span className={cn('font-display font-bold text-lg whitespace-nowrap', pvLeft !== undefined && e.pv > pvLeft ? 'text-danger' : 'text-active')}>
                {e.pv} <span className="text-xs text-text-secondary">PV</span>
              </span>
            )
            const summary = (
              <>
                <span className="w-10 h-10 shrink-0 bg-surface-deep border border-line flex items-center justify-center overflow-hidden" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.icon && <img src={unitIconUrl(e.icon)} alt="" loading="lazy" className="w-full h-full object-contain" />}
                </span>
                <span className="flex-1 flex flex-col min-w-0">
                  <span className="font-label font-bold text-[15px] tracking-[0.5px] truncate">{unitListName(e)}</span>
                  <span className="text-[13px] text-text-secondary">
                    {TYPE_LABELS[e.type]} · Size {e.size} · {moveText(e)} · A{e.armor} S{e.structure} · {e.damage.join('/')}
                    {e.ov > 0 && <span className="text-danger"> · OV{e.ov}</span>}{e.role ? ` · ${e.role}` : ''}
                  </span>
                </span>
                {pv}
              </>
            )
            if (!tapToAdd) {
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onPick(e)} className="w-full min-h-touch flex items-center gap-3 py-2 border-b border-line text-left hover:bg-ground">
                    {summary}
                  </button>
                </li>
              )
            }
            const open = openId === e.id
            return (
              <li key={e.id} className={cn('border-b border-line', open && 'bg-surface')}>
                <div className="flex items-center gap-2">
                  <button type="button" aria-expanded={open} aria-controls={`unit-list-card-${e.id}`} onClick={() => setOpenId(open ? null : e.id)}
                    className={cn('flex-1 min-w-0 min-h-touch flex items-center gap-3 py-2 text-left', !open && 'hover:bg-ground')}>
                    {summary}
                  </button>
                  <button type="button" onClick={() => onPick(e)} aria-label={`Add ${unitListName(e)}`}
                    className="w-touch h-touch shrink-0 flex items-center justify-center border border-active text-active font-label font-bold text-lg hover:bg-active hover:text-on-active">
                    +
                  </button>
                </div>
                {open && <UnitListCard id={`unit-list-card-${e.id}`} entry={e} />}
              </li>
            )
          })}
        </ul>
      )}
      {tapToAdd && results.length > 0 && <p className="m-0 text-[13px] text-text-secondary">Tap a unit to see its full stats. Tap + to add it to your force; tap + again to add another.</p>}
      {matches.length > LIMIT && <p className="m-0 text-[13px] text-text-secondary">Showing the first {LIMIT}. Narrow the search or add a filter.</p>}
    </div>
  )
}

/** Every move a unit has, as on its card, e.g. 6"/8"j. */
function moveText(entry: UnitListEntry): string {
  return Object.entries(entry.move).map(([code, inches]) => `${inches}"${code}`).join('/') || '0"'
}

/** A unit-list entry's full card: everything the force would get if it were added. */
function UnitListCard({ id, entry }: { id: string; entry: UnitListEntry }) {
  const unit = unitFromEntry(entry)
  return (
    <div id={id} className="flex gap-3 px-3 pb-3 pt-1">
      <span className="w-24 h-24 shrink-0 bg-surface-deep border border-line flex items-center justify-center overflow-hidden" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {entry.icon && <img src={unitIconUrl(entry.icon)} alt="" className="w-full h-full object-contain" />}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          <StatusTag tone="neutral">{unit.unitType}</StatusTag>
          <StatusTag tone="neutral">Size {unit.size}</StatusTag>
          <StatusTag tone="neutral">{unit.pvAtSkill4} PV at Skill 4</StatusTag>
          {entry.omni && <StatusTag tone="neutral">Omni</StatusTag>}
        </div>
        <UnitStats unit={unit} />
      </div>
    </div>
  )
}

/** A foldable group of filters; its heading counts the filters on in it. */
function FilterSection({ title, on, defaultOpen = false, children }: { title: string; on: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen || on > 0)
  const id = `unit-list-section-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section className="border-b border-line last:border-b-0" aria-label={title}>
      <h3 className="m-0">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}
          className="w-full min-h-touch px-3 flex items-center gap-2 font-display font-bold text-[13px] tracking-[2px] uppercase text-active hover:bg-surface-raised">
          {title}
          {on > 0 && <span className="min-w-5 h-5 px-1 flex items-center justify-center bg-active text-on-active text-xs tracking-normal" aria-label={`${on} on`}>{on}</span>}
          <span aria-hidden="true" className="ml-auto text-text-secondary">{open ? '▴' : '▾'}</span>
        </button>
      </h3>
      {open && <div id={id} className="flex flex-col gap-3 px-3 pb-3">{children}</div>}
    </section>
  )
}

/** Multi-select of specials by code, commonest first; a unit must have every one chosen. */
function SpecialPicker({ specials, selected, onChange }: { specials: { code: string; count: number }[]; selected: string[]; onChange: (selected: string[]) => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = specials.filter(s => !q || s.code.toLowerCase().includes(q) || SPECIAL_NAMES[s.code]?.toLowerCase().includes(q))
  return (
    <div className="flex flex-col gap-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map(code => (
            <button key={code} type="button" onClick={() => onChange(selected.filter(c => c !== code))} aria-label={`Remove ${code}`}
              className="min-h-8 px-2 border-2 border-active text-active font-label font-bold text-[12px] tracking-[0.5px] uppercase">
              {code} ✕
            </button>
          ))}
          {selected.length > 1 && <span className="text-[13px] text-text-secondary">Units must have all of these.</span>}
        </div>
      )}
      <TextInput id="unit-list-special-search" value={query} onChange={setQuery} placeholder="Find a special, e.g. IF, ECM, jump" autoComplete="off" aria-label="Find a special" className="max-w-none" />
      <div className="max-h-56 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-x-3 border border-line px-2 py-1">
        {shown.length === 0 && <p className="m-0 py-2 text-sm text-text-secondary">No specials match.</p>}
        {shown.map(s => (
          <label key={s.code} className="flex items-center gap-2 min-h-8 text-sm cursor-pointer min-w-0">
            <input type="checkbox" checked={selected.includes(s.code)} onChange={() => onChange(toggled(selected, s.code))}
              className="w-[18px] h-[18px] shrink-0 accent-[var(--color-active)]" />
            <span className="font-mono font-bold">{s.code}</span>
            <span className="truncate text-text-secondary">{SPECIAL_NAMES[s.code] ?? ''}</span>
            <span className="ml-auto pl-1 font-mono text-[11px] text-text-secondary tabular-nums">{s.count}</span>
          </label>
        ))}
      </div>
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
      <span className="field-label text-text-secondary">Faction</span>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(i => (
            <button key={i} type="button" onClick={() => toggle(i)} aria-label={`Remove ${factions[i].name}`}
              className="min-h-8 px-2 border-2 border-active text-active font-label font-bold text-[12px] tracking-[0.5px] uppercase">
              {factions[i].name} ✕
            </button>
          ))}
        </div>
      )}
      <details className="border border-line">
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
              <div className="field-label text-text-secondary pb-1">{group}</div>
              {factions.map((f, i) => f.group === group && shown(f) && (
                <label key={f.name} className="flex items-center gap-2.5 min-h-8 text-sm cursor-pointer">
                  <input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)}
                    className="w-[18px] h-[18px] shrink-0 accent-[var(--color-active)]" />
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
