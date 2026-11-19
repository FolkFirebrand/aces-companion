/** When to offer installing the app on a phone's home screen. */

export const INSTALL_DISMISSED_KEY = 'aces-install-dismissed'
export const REASK_AFTER_MS = 30 * 24 * 60 * 60 * 1000

export type InstallPlatform = 'android' | 'ios'

/** Phones only: tablets and desktops are never offered the install. */
export function phonePlatform(userAgent: string): InstallPlatform | null {
  if (/iPhone|iPod/.test(userAgent)) return 'ios'
  if (/Android/.test(userAgent) && /Mobile/.test(userAgent)) return 'android'
  return null
}

/** True once 30 days have passed since "Not now", or if it was never dismissed. */
export function canReask(dismissedAt: string | null, now: number): boolean {
  const at = Number(dismissedAt)
  if (!dismissedAt || !Number.isFinite(at)) return true
  return now - at >= REASK_AFTER_MS
}
