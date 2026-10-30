import { useEffect, useState } from 'react'
import { UNIT_LIST } from './manifest'
import type { UnitListEntry, UnitListFile } from './convert'

const CACHE_NAME = 'aces-unit-list'
let pending: Promise<UnitListFile> | null = null

async function fetchUnitList(): Promise<UnitListFile> {
  // Cache Storage keeps the list for offline use at the table; the file name changes with each catalog version.
  const cache = typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME).catch(() => null)
  const cached = await cache?.match(UNIT_LIST.file)
  if (cached) return (await cached.json()) as UnitListFile

  const response = await fetch(UNIT_LIST.file)
  if (!response.ok) throw new Error(`The unit list could not be loaded (HTTP ${response.status}).`)
  if (cache) {
    await cache.put(UNIT_LIST.file, response.clone())
    for (const request of await cache.keys()) {
      if (!request.url.endsWith(UNIT_LIST.file)) await cache.delete(request)
    }
  }
  return (await response.json()) as UnitListFile
}

/** Loads the unit list file once per visit: from the browser's cache when it has it, otherwise from the site. */
export function loadUnitListFile(): Promise<UnitListFile> {
  pending ??= fetchUnitList().catch(err => {
    pending = null
    throw err
  })
  return pending
}

/** The units in the unit list. */
export function loadUnitList(): Promise<UnitListEntry[]> {
  return loadUnitListFile().then(file => file.units)
}

/** The unit list once loaded (null until then, or if it can't be loaded). */
export function useUnitList(enabled = true): UnitListEntry[] | null {
  const [units, setUnits] = useState<UnitListEntry[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadUnitList().then(list => { if (live) setUnits(list) }, () => {})
    return () => { live = false }
  }, [enabled])
  return units
}
