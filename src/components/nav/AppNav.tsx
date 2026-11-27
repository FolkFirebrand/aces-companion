'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { selectDifficultyName, selectWarchestBalance } from '@/store/selectors'
import { MAIN_TABS, WOLFNET_TABS, TabBar, isTabActive } from '@/components/dossier/TabBar'
import { cn } from '@/lib/utils'
import { SaveMenu } from './SaveMenu'

// The welcome page and the setup wizard come before there's a campaign to navigate.
function outsideCampaign(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/setup') || inWolfnet(pathname)
}

export function inWolfnet(pathname: string): boolean {
  return pathname === '/wolfnet' || pathname.startsWith('/wolfnet/')
}

/** Marks the Wolfnet 350 module as still in beta. */
function BetaTag() {
  return <span className="shrink-0 border border-active text-active px-1.5 text-[10px] leading-4">BETA</span>
}

/** The link across to the other module: the Aces campaign and the Wolfnet 350 tournament format. */
function ModuleSwitch({ wolfnet }: { wolfnet: boolean }) {
  return (
    <Link href={wolfnet ? '/' : '/wolfnet'} className="field-label text-result whitespace-nowrap min-h-touch flex items-center gap-2">
      {wolfnet ? 'Aces campaign' : 'Wolfnet 350'}
      {!wolfnet && <BetaTag />}
      &gt;
    </Link>
  )
}

/** Every screen: the module's name, the link to the other module and, in a campaign, the Save menu; wide screens add the tabs. */
export function TopBar() {
  const pathname = usePathname()
  const campaign = useCampaignStore(s => s.campaign)
  const draft = useCampaignStore(s => s.setupDraft)
  const wolfnet = inWolfnet(pathname)
  if (pathname === '/') {
    return (
      <div className="bg-surface-deep border-b border-line">
        <div className="max-w-6xl mx-auto px-gutter min-h-12 flex items-center justify-end">
          <ModuleSwitch wolfnet={false} />
        </div>
      </div>
    )
  }
  const inCampaign = !outsideCampaign(pathname)
  const forceName = inCampaign ? campaign.forceName : draft?.forceName
  const tabs = wolfnet ? WOLFNET_TABS : MAIN_TABS

  return (
    <div className="bg-surface-deep border-b border-line">
      <div className="max-w-6xl mx-auto px-gutter min-h-12 flex items-center gap-6">
        {/* Back to the module's home: the welcome page, where campaigns are started and loaded, or Wolfnet's forces. */}
        <Link href={wolfnet ? '/wolfnet' : '/'} className="field-label text-active min-w-0 min-h-touch flex items-center gap-2">
          <span className="truncate">{wolfnet ? 'WOLFNET 350' : forceName || 'NEW FORCE'}</span>
          {wolfnet && <BetaTag />}
        </Link>
        {(inCampaign || wolfnet) && (
          <nav aria-label="Main" className="hidden md:flex">
            {tabs.map(tab => {
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
          <ModuleSwitch wolfnet={wolfnet} />
          {!wolfnet && <SaveMenu />}
        </div>
      </div>
    </div>
  )
}

/** Phones and small tablets: the tab bar fixed to the bottom of the screen. */
export function PhoneTabBar() {
  const pathname = usePathname()
  const sorties = useCampaignStore(s => s.campaign.sorties)
  if (inWolfnet(pathname)) {
    // The match screen has its own footer bar.
    if (pathname === '/wolfnet/match') return null
    return (
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom,0px)] bg-surface">
        <TabBar tabs={WOLFNET_TABS} currentPath={pathname} />
      </div>
    )
  }
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
