import { useSyncExternalStore } from 'react'

const noSubscription = () => () => {}

/**
 * False while the server renders and while React hydrates, true afterwards. The campaign lives in
 * this browser's storage, so anything that changes the page's structure based on it must wait for
 * this; otherwise the server's HTML and the browser's first render disagree.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false)
}
