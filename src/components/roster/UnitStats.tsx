import { StatusTag } from '@/components/dossier/StatusTag'
import type { Unit } from '@/lib/types'
import { cn } from '@/lib/utils'

function Stat({ abbr, title, value, tone }: { abbr: string; title: string; value: React.ReactNode; tone?: string }) {
  return (
    <span className="flex flex-col items-center min-w-10 px-1.5 py-1 bg-surface-deep border border-line">
      <abbr title={title} className="field-label text-[11px] text-text-secondary no-underline">{abbr}</abbr>
      <span className={cn('font-label font-bold text-base', tone)}>{value}</span>
    </span>
  )
}

/** A unit's Alpha Strike stats, read-only: role and tonnage, movement and armor, damage bands and specials. */
export function UnitStats({ unit, maxAbilities }: {
  unit: Pick<Unit, 'role' | 'tonnage' | 'tmm' | 'armor' | 'structure' | 'move' | 'overheat' | 'damage' | 'damageText' | 'abilities'>
  /** Shows this many specials and a "+n" tag for the rest; all of them when left out. */
  maxAbilities?: number
}) {
  const abilities = unit.abilities ?? []
  const shown = maxAbilities === undefined ? abilities : abilities.slice(0, maxAbilities)

  return (
    <>
      {(unit.role || unit.tonnage !== undefined) && (
        <span className="text-[13px] text-text-secondary uppercase tracking-[1px]">
          {[unit.role, unit.tonnage !== undefined ? `${unit.tonnage} tons` : null].filter(Boolean).join(' · ')}
        </span>
      )}

      {(unit.tmm !== undefined || unit.armor !== undefined || unit.structure !== undefined || unit.move?.length) && (
        <div className="flex flex-wrap gap-1.5">
          {unit.move?.map((m, i) => <Stat key={i} abbr="MV" title="Movement" value={`${m.move}${m.type ?? ''}`} />)}
          {unit.tmm !== undefined && <Stat abbr="TMM" title="Target Movement Modifier" value={unit.tmm} />}
          {unit.armor !== undefined && <Stat abbr="ARM" title="Armor" value={unit.armor} />}
          {unit.structure !== undefined && <Stat abbr="STR" title="Structure" value={unit.structure} />}
          {unit.overheat !== undefined && unit.overheat > 0 && <Stat abbr="OV" title="Overheat" value={unit.overheat} tone="text-danger" />}
        </div>
      )}

      {unit.damage && (
        <div className="flex items-center gap-2">
          <span className="field-label text-text-secondary">Damage</span>
          <div data-testid="damage-band" className="flex border border-line">
            {(['short', 'medium', 'long'] as const).map((range, i) => (
              <span key={range} className={cn('flex flex-col items-center px-2.5 py-0.5', i > 0 && 'border-l border-line')}>
                <span className="field-label text-[11px] text-text-secondary">{['S', 'M', 'L'][i]}</span>
                <span className="font-label font-bold">{unit.damageText?.[i] ?? unit.damage![range]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {abilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shown.map(a => <StatusTag key={a} tone={a === 'ENE' ? 'keyword' : 'neutral'}>{a}</StatusTag>)}
          {abilities.length > shown.length && <StatusTag tone="neutral">+{abilities.length - shown.length}</StatusTag>}
        </div>
      )}
    </>
  )
}
