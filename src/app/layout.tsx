import type { Metadata, Viewport } from 'next'
import { Chakra_Petch, Barlow_Semi_Condensed, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { TopBar, PhoneTabBar } from '@/components/nav/AppNav'
import { SiteFooter } from '@/components/nav/SiteFooter'
import { InstallPrompt } from '@/components/install/InstallPrompt'

const chakra = Chakra_Petch({ weight: ['500', '600', '700'], subsets: ['latin'], variable: '--font-chakra', display: 'swap' })
const barlow = Barlow_Semi_Condensed({ weight: ['400', '500', '600', '700'], subsets: ['latin'], variable: '--font-barlow', display: 'swap' })
const jetbrains = JetBrains_Mono({ weight: ['500', '700'], subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' })

export const metadata: Metadata = {
  title: 'Aces Campaign Log',
  description: 'Unofficial fan-made campaign log companion for BattleTech: Aces',
  appleWebApp: { capable: true, title: 'Aces', statusBarStyle: 'black' },
}

// surface-deep from globals.css: colours the phone's status bar to match the top bar.
export const viewport: Viewport = { themeColor: '#0f1613' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${chakra.variable} ${barlow.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <PhoneTabBar />
        <InstallPrompt />
      </body>
    </html>
  )
}
