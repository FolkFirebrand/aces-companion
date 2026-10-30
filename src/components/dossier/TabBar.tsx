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
  { label: 'ROSTER', href: '/roster' },
  { label: 'PILOTS', href: '/pilots' },
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
      className={cn('grid bg-steel-800 border-t-2 border-steel-500', className)}
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
              'h-tabbar flex items-center justify-center font-condensed text-sm tracking-[1px]',
              active
                ? 'font-bold text-amber border-t-[3px] border-amber -mt-[2px]'
                : 'font-semibold text-text-secondary hover:text-text-primary'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
