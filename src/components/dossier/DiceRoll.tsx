import { cn } from '@/lib/utils'
import { dossierButtonClass } from './DossierButton'

export interface DiceOutcome {
  text: string
  tone: 'computed' | 'danger'
}

/**
 * A 2D6 entry: players type the result from real dice, or ask the app to roll.
 * The app never rolls on its own.
 */
export function DiceRoll({ id, label, target, value, onChange, onRoll, outcome }: {
  id: string
  label: string
  /** The number to meet, e.g. "4+". Crew checks have none. */
  target?: string
  value: number | null
  onChange: (value: number | null) => void
  onRoll: () => void
  outcome?: DiceOutcome
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <label htmlFor={id} className="flex-1 text-[15px]">
          {label}{target && <> <span className="font-label font-bold text-active">{target}</span></>}
        </label>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={2}
          max={12}
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="w-[58px] h-touch bg-text-primary text-ink font-mono font-bold text-[24px] text-center"
        />
        <button type="button" onClick={onRoll} className={dossierButtonClass('secondary', 'text-sm')}>
          ROLL 2D6
        </button>
      </div>
      {outcome && (
        <p className={cn('m-0 text-sm', outcome.tone === 'danger' ? 'text-danger' : 'text-result')}>{outcome.text}</p>
      )}
    </div>
  )
}
