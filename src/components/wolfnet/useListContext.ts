import { useEffect, useState } from 'react'
import { loadFullUnitListFile } from '@/lib/unit-list/load'
import type { ListContext } from '@/lib/wolfnet/rules'

/** The whole unit list, for faction and era checks; null until loaded (or if it can't be). */
export function useListContext(): ListContext | null {
  const [context, setContext] = useState<ListContext | null>(null)
  useEffect(() => {
    let live = true
    loadFullUnitListFile().then(file => {
      if (live) setContext({ entries: new Map(file.units.map(e => [e.id, e])), factions: file.factions ?? [] })
    }, () => {})
    return () => { live = false }
  }, [])
  return context
}
