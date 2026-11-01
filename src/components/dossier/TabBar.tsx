import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface Tab {
  label: string
  href: string
  /** Path prefixes that also count as this tab (e.g. a sortie belongs to the Log). */
  alsoActiveOn?: string[]
}

export const MAIN_TABS: Tab[] = [
  { label: 'LOG', href: '/campaign', alsoActiveOn: ['/sortie'] },
  // Named Pilots live on the Roster beside the units they crew; a pilot's file still has its own page.
  { label: 'ROSTER', href: '/roster', alsoActiveOn: ['/pilots'] },
  { label: 'FILE', href: '/export' },
]

export function isTabActive(tab: Tab, currentPath: string): boolean {
  return [tab.href, ...(tab.alsoActiveOn ?? [])].some(
    prefix => currentPath === prefix || currentPath.startsWith(prefix + '/')
  )
}

export function TabBar({ tabs, currentPath, className }: { tabs: Tab[]; currentPath: string; className?: string }) {
  return (
    <nav
      aria-label="Main"
      className={cn('grid bg-surface-deep border-t border-line', className)}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(tab => {
        const active = isTabActive(tab, currentPath)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'h-tabbar flex items-center justify-center font-label text-sm tracking-[1.5px]',
              active
                ? 'font-bold text-active border-t-[3px] border-active -mt-px'
                : 'font-semibold text-text-muted hover:text-text-primary'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
