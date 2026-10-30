import { cn } from '@/lib/utils'

export type DossierButtonVariant = 'primary' | 'secondary' | 'danger'

const VARIANTS: Record<DossierButtonVariant, string> = {
  // One per screen: the main next action.
  primary: 'h-button-primary w-full px-4 bg-amber text-on-amber font-stencil text-lg tracking-[1px] hover:brightness-110 disabled:bg-steel-600 disabled:text-text-disabled disabled:opacity-100 disabled:hover:brightness-100',
  secondary: 'h-touch px-3.5 bg-transparent text-signal-blue border-2 border-signal-blue font-condensed font-semibold text-[15px] tracking-[1px] hover:bg-signal-blue/10',
  danger: 'h-touch px-3.5 self-start bg-transparent text-danger border border-danger font-condensed font-semibold text-sm tracking-[1px] hover:bg-danger/10',
}

/** Class names for a Dossier button, for links styled as buttons. */
export function dossierButtonClass(variant: DossierButtonVariant, className?: string): string {
  return cn('inline-flex items-center justify-center uppercase disabled:opacity-50 disabled:cursor-not-allowed', VARIANTS[variant], className)
}

export function DossierButton({ variant, className, type = 'button', ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant: DossierButtonVariant }) {
  return <button type={type} className={dossierButtonClass(variant, className)} {...props} />
}
