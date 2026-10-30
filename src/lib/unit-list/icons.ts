import { useEffect, useState } from 'react'
import { UNIT_LIST } from './manifest'

const CACHE_NAME = 'aces-unit-icons'

/** MegaMek's icon for a unit, from mm-data on GitHub at the commit the unit list was built with (ADR 0006). */
export function unitIconUrl(path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/MegaMek/mm-data/${UNIT_LIST.iconsCommit}/data/images/units/${encoded}`
}

async function cachedIcon(url: string): Promise<string> {
  // Cache Storage keeps icons already seen for offline use at the table.
  const cache = typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME).catch(() => null)
  let response = await cache?.match(url)
  if (!response) {
    response = await fetch(url)
    if (!response.ok) throw new Error(`Icon not found (HTTP ${response.status})`)
    await cache?.put(url, response.clone())
  }
  return URL.createObjectURL(await response.blob())
}

/** The icon's address to show (a local copy once cached), or null while loading or when there is none. */
export function useUnitIcon(path: string | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    let live = true
    let objectUrl: string | null = null
    cachedIcon(unitIconUrl(path)).then(
      url => { objectUrl = url; if (live) setSrc(url); else URL.revokeObjectURL(url) },
      () => { if (live) setSrc(null) },
    )
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setSrc(null)
    }
  }, [path])
  return path ? src : null
}
