'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Share } from 'lucide-react'
import { useCampaignStore } from '@/store/campaign'
import { useDownloadBackup } from '@/components/campaign/LoadCampaignFile'
import { DossierButton } from '@/components/dossier/DossierButton'
import { canReask, INSTALL_DISMISSED_KEY, phonePlatform } from '@/lib/install-offer'
import type { InstallPlatform } from '@/lib/install-offer'

/** Chrome's install event; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Give people a moment with the app before asking. */
const SHOW_AFTER_MS = 10_000

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function rememberDismissal() {
  try { localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now())) } catch { /* private mode */ }
}

/**
 * Bottom sheet offering to put the app on a phone's home screen. Android gets the browser's own
 * install prompt; iPhone gets the Share → Add to Home Screen steps, since Safari has no prompt.
 * "Not now" hides it for 30 days. Never shown mid-sortie or inside the installed app.
 */
export function InstallPrompt() {
  const pathname = usePathname()
  // Set once the wait is over; the sheet stays shut while they're on the sortie screens.
  const [offer, setOffer] = useState<InstallPlatform | null>(null)
  const open = offer !== null && !pathname.startsWith('/sortie')
  const deferred = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const found = phonePlatform(navigator.userAgent)
    let dismissedAt: string | null = null
    try { dismissedAt = localStorage.getItem(INSTALL_DISMISSED_KEY) } catch { /* private mode */ }
    if (!found || isInstalled() || !canReask(dismissedAt, Date.now())) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const showSoon = () => { timer = setTimeout(() => setOffer(found), SHOW_AFTER_MS) }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      deferred.current = e as BeforeInstallPromptEvent
      if (!timer) showSoon()
    }
    const onInstalled = () => setOffer(null)

    // Android only offers an install once the browser says it can; iPhone always can.
    if (found === 'ios') showSoon()
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function notNow() {
    rememberDismissal()
    setOffer(null)
  }

  async function install() {
    const prompt = deferred.current
    deferred.current = null
    setOffer(null)
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'dismissed') rememberDismissal()
  }

  if (!offer) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) notNow() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-4 bg-surface border-t-2 border-active px-gutter pt-5 pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] text-text-primary outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom">
          <div className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size app icon */}
            <img src="/icons/icon-192.png" alt="" width={60} height={60} className="size-15 shrink-0 rounded-[14px]" />
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="m-0 font-display font-bold text-xl leading-tight">
                Put Aces on your home screen
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="m-0 text-[15px] text-text-secondary">
                Opens full screen, like an app. No app store needed.
              </DialogPrimitive.Description>
            </div>
          </div>
          {offer === 'ios' ? <IosSteps onNotNow={notNow} /> : (
            <div className="flex gap-3">
              <DossierButton variant="secondary" onClick={notNow} className="flex-1 border-line text-text-secondary">Not now</DossierButton>
              <DossierButton variant="primary" onClick={install} className="flex-[1.4] h-touch">Install app</DossierButton>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function IosSteps({ onNotNow }: { onNotNow: () => void }) {
  const hasCampaignData = useCampaignStore(s => s.hasCampaignData)
  const downloadBackup = useDownloadBackup()

  return (
    <>
      <ol className="m-0 flex flex-col gap-2 pl-5 text-base">
        <li>Tap Share <Share aria-label="(the square with an up arrow)" className="inline size-[18px] -mt-1 text-active" /> in the browser toolbar</li>
        <li>Choose <strong className="font-semibold">Add to Home Screen</strong></li>
      </ol>
      {hasCampaignData() && (
        <div className="flex flex-col gap-3 border border-line bg-ground p-3">
          <p className="m-0 text-sm text-text-secondary">
            The home-screen app keeps its own storage. To bring this campaign across, download a Campaign File now, then load it in the app.
          </p>
          <DossierButton variant="secondary" onClick={downloadBackup}>Download Campaign File</DossierButton>
        </div>
      )}
      <DossierButton variant="secondary" onClick={onNotNow} className="border-line text-text-secondary">Not now</DossierButton>
    </>
  )
}
