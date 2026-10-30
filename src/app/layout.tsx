import type { Metadata } from 'next'
import { Saira_Stencil_One, Saira_Condensed, IBM_Plex_Sans_Condensed } from 'next/font/google'
import './globals.css'
import { TopBar, PhoneTabBar } from '@/components/nav/AppNav'

const sairaStencil = Saira_Stencil_One({ weight: '400', subsets: ['latin'], variable: '--font-saira-stencil', display: 'swap' })
const sairaCondensed = Saira_Condensed({ weight: ['500', '600', '700'], subsets: ['latin'], variable: '--font-saira-condensed', display: 'swap' })
const plexCondensed = IBM_Plex_Sans_Condensed({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-plex-condensed', display: 'swap' })

export const metadata: Metadata = {
  title: 'Aces Campaign Log',
  description: 'Unofficial fan-made campaign log companion for BattleTech: Aces',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sairaStencil.variable} ${sairaCondensed.variable} ${plexCondensed.variable}`}>
      <body className="min-h-screen flex flex-col">
        <div className="hazard-band" />
        <TopBar />
        <main className="flex-1">{children}</main>
        <footer className="max-w-6xl w-full mx-auto px-gutter pt-3 pb-[calc(var(--spacing-tabbar)+16px)] md:pb-4 text-xs leading-snug text-text-muted border-t border-steel-500">
          Unofficial fan-made tool. Not affiliated with or endorsed by the game&apos;s publishers. Requires the Aces box set.
        </footer>
        <PhoneTabBar />
      </body>
    </html>
  )
}
