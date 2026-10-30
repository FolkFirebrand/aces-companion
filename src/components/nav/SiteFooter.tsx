'use client'

import { Mail } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DossierButton } from '@/components/dossier/DossierButton'
import { LegalNotice } from '@/components/legal/LegalNotice'
import { CONTACT_EMAIL, DISCORD_URL, REPO_URL } from '@/lib/links'

// Brand marks from Simple Icons (CC0).
const DISCORD_PATH = 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z'
const GITHUB_PATH = 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'

const ICON_LINK = 'h-touch min-w-touch px-1.5 inline-flex items-center justify-center gap-1.5 text-text-secondary hover:text-text-primary'

function BrandIcon({ path }: { path: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current"><path d={path} /></svg>
}

/** Every page's footer: the fan-tool disclaimer, contact links and the license and legal notice. */
export function SiteFooter() {
  return (
    <footer className="max-w-6xl w-full mx-auto px-gutter pt-2 pb-[calc(var(--spacing-tabbar)+16px)] md:pb-3 text-xs leading-snug text-text-muted border-t border-steel-500 flex flex-wrap items-center gap-x-4 gap-y-1">
      <p className="m-0 flex-1 min-w-60">
        Unofficial fan-made tool. Not affiliated with or endorsed by the game&apos;s publishers. Requires the Aces box set.
      </p>
      <nav aria-label="Contact and legal" className="flex flex-wrap items-center">
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" aria-label="Discord" title="Discord" className={ICON_LINK}>
          <BrandIcon path={DISCORD_PATH} />
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub" title="GitHub" className={ICON_LINK}>
          <BrandIcon path={GITHUB_PATH} />
        </a>
        <a href={`mailto:${CONTACT_EMAIL}`} className={ICON_LINK}>
          <Mail aria-hidden="true" className="size-5" />
          <span className="font-condensed font-semibold text-sm tracking-[1px] uppercase">Email me</span>
        </a>
        <Dialog>
          <DialogTrigger className={`${ICON_LINK} font-condensed font-semibold text-sm tracking-[1px] uppercase`}>
            License &amp; legal
          </DialogTrigger>
          <DialogContent className="bg-steel-800 border-steel-500 text-text-primary sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-stencil text-2xl font-normal uppercase text-amber">License &amp; legal notice</DialogTitle>
            </DialogHeader>
            <LegalNotice />
            <DialogFooter className="bg-transparent border-steel-500">
              <DialogClose render={<DossierButton variant="secondary" />}>Dismiss</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </nav>
    </footer>
  )
}
