'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { selectDifficultyName, selectWarchestBalance } from '@/store/selectors'
import { MAIN_TABS, TabBar, isTabActive } from '@/components/dossier/TabBar'
import { cn } from '@/lib/utils'

/** Wide screens: a top bar with the force, the tabs, and the Warchest. */
// The welcome page and the setup wizard come before there's a campaign to navigate.
function outsideCampaign(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/setup')
}

export function TopBar() {
  const pathname = usePathname()
  const campaign = useCampaignStore(s => s.campaign)
  if (outsideCampaign(pathname)) return null

  return (
    <div className="hidden md:block bg-steel-900 border-b border-steel-500">
      <div className="max-w-6xl mx-auto px-gutter flex items-center gap-6">
        <span className="dossier-label text-amber">{campaign.forceName || 'NEW FORCE'}</span>
        <nav aria-label="Main" className="flex">
          {MAIN_TABS.map(tab => {
            const active = isTabActive(tab, pathname)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'h-touch px-4 flex items-center font-condensed text-sm tracking-[1px] border-b-[3px]',
                  active ? 'font-bold text-amber border-amber' : 'font-semibold text-text-secondary border-transparent hover:text-text-primary'
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
        <span className="ml-auto dossier-label text-text-secondary">
          WARCHEST <span className="text-amber">{selectWarchestBalance(campaign)} SP</span> · {selectDifficultyName(campaign).toUpperCase()}
        </span>
      </div>
    </div>
  )
}

/** Phones and small tablets: the tab bar fixed to the bottom of the screen. */
export function PhoneTabBar() {
  const pathname = usePathname()
  const sorties = useCampaignStore(s => s.campaign.sorties)
  // Hidden inside a draft sortie's step flow, which has its own way back.
  if (outsideCampaign(pathname)) return null
  const sortieId = pathname.match(/^\/sortie\/([^/]+)/)?.[1]
  if (sortieId && sorties.find(s => s.id === sortieId)?.status === 'draft') return null
  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom,0px)] bg-steel-800">
      <TabBar tabs={MAIN_TABS} currentPath={pathname} />
    </div>
  )
}
