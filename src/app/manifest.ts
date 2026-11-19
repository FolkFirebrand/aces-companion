import type { MetadataRoute } from 'next'

/** Lets phones install the site as an app (home-screen icon, opens full screen). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aces Campaign Log',
    short_name: 'Aces',
    description: 'Unofficial fan-made campaign log companion for BattleTech: Aces',
    start_url: '/',
    display: 'standalone',
    // Manifest colours can't read CSS tokens: these are surface-deep and ground from globals.css.
    background_color: '#1a2420',
    theme_color: '#0f1613',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
