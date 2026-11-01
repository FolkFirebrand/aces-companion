'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { selectDifficultyName, selectWarchestBalance } from '@/store/selectors'
import { MAIN_TABS, TabBar, isTabActive } from '@/components/dossier/TabBar'
import { cn } from '@/lib/utils'
import { SaveMenu } from './SaveMenu'

// The welcome page and the setup wizard come before there's a campaign to navigate.
function outsideCampaign(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/setup')
}

/** Every screen after the welcome page: the force and the Save menu; wide screens add the tabs and the Warchest. */
export function TopBar() {
  const pathname = usePathname()
  const campaign = useCampaignStore(s => s.campaign)
  const draft = useCampaignStore(s => s.setupDraft)
  if (pathname === '/') return null
  const inCampaign = !outsideCampaign(pathname)
  const forceName = inCampaign ? campaign.forceName : draft?.forceName

  return (
    <div className="bg-surface-deep border-b border-line">
      <div className="max-w-6xl mx-auto px-gutter min-h-12 flex items-center gap-6">
        <span className="field-label text-active truncate">{forceName || 'NEW FORCE'}</span>
        {inCampaign && (
          <nav aria-label="Main" className="hidden md:flex">
            {MAIN_TABS.map(tab => {
              const active = isTabActive(tab, pathname)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'h-touch px-4 flex items-center font-label text-sm tracking-[1px] border-b-[3px]',
                    active ? 'font-bold text-active border-active' : 'font-semibold text-text-secondary border-transparent hover:text-text-primary'
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-6">
          {inCampaign && (
            <span className="hidden md:inline field-label text-text-secondary">
              WARCHEST <span className="text-active">{selectWarchestBalance(campaign)} SP</span> · {selectDifficultyName(campaign).toUpperCase()}
            </span>
          )}
          <SaveMenu />
        </div>
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
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom,0px)] bg-surface">
      <TabBar tabs={MAIN_TABS} currentPath={pathname} />
    </div>
  )
}
