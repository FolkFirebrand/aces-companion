'use client'

import { cn } from '@/lib/utils'

const INPUT = 'h-touch w-full bg-surface-deep border border-line px-3 text-[15px] text-text-primary focus:border-active'

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="field-label text-text-secondary">{label}</label>
      {children}
      {hint && <p className="m-0 text-sm text-text-secondary">{hint}</p>}
    </div>
  )
}

export function TextInput({ id, value, onChange, className, ...props }:
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { id: string; value: string; onChange: (value: string) => void }) {
  return <input id={id} value={value} onChange={e => onChange(e.target.value)} className={cn(INPUT, className)} {...props} />
}

export function NumberInput({ id, value, onChange, className, ...props }:
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { id: string; value: number; onChange: (value: number) => void }) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className={cn(INPUT, 'max-w-[140px] tabular-nums', className)}
      {...props}
    />
  )
}

export function Select({ id, value, onChange, children, className }:
  { id: string; value: string; onChange: (value: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className={cn(INPUT, className)}>
      {children}
    </select>
  )
}

/** A label-and-figure line, e.g. "PV Limit 250". */
export function Readout({ label, value, tone = 'text-active' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-2 border-b border-line">
      <span className="field-label text-text-secondary">{label}</span>
      <span className={cn('font-display font-bold text-xl tabular-nums whitespace-nowrap', tone)}>{value}</span>
    </div>
  )
}

export function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="field-label flex justify-between text-text-secondary pb-1 border-b-2 border-line">
        <span>{title}</span>
        {aside && <span>{aside}</span>}
      </div>
      {children}
    </section>
  )
}
