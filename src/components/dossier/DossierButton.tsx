import { cn } from '@/lib/utils'

export type DossierButtonVariant = 'primary' | 'secondary' | 'danger'

const VARIANTS: Record<DossierButtonVariant, string> = {
  // One per screen: the main next action.
  primary: 'chamfer h-button-primary w-full px-4 bg-active text-on-active font-display font-bold text-base sm:text-lg tracking-[1px] leading-tight hover:brightness-110 disabled:bg-surface-raised disabled:text-text-disabled disabled:opacity-100 disabled:hover:brightness-100',
  secondary: 'h-touch px-3.5 bg-transparent text-active border border-active font-label font-semibold text-[15px] tracking-[1px] hover:bg-active/10',
  danger: 'h-touch px-3.5 self-start bg-transparent text-danger border border-danger font-label font-semibold text-sm tracking-[1px] hover:bg-danger/10',
}

/** Class names for a Dossier button, for links styled as buttons. */
export function dossierButtonClass(variant: DossierButtonVariant, className?: string): string {
  return cn('inline-flex items-center justify-center uppercase disabled:opacity-50 disabled:cursor-not-allowed', VARIANTS[variant], className)
}

export function DossierButton({ variant, className, type = 'button', ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant: DossierButtonVariant }) {
  return <button type={type} className={dossierButtonClass(variant, className)} {...props} />
}
