import { canReask, phonePlatform, REASK_AFTER_MS } from '@/lib/install-offer'

describe('phonePlatform', () => {
  it('spots iPhones', () => {
    expect(phonePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1')).toBe('ios')
  })
  it('spots Android phones', () => {
    expect(phonePlatform('Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('android')
  })
  it('skips Android tablets, iPads and desktops', () => {
    expect(phonePlatform('Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0 Safari/537.36')).toBeNull()
    expect(phonePlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')).toBeNull()
    expect(phonePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36')).toBeNull()
  })
})

describe('canReask', () => {
  const now = 1_800_000_000_000
  it('offers when never dismissed', () => {
    expect(canReask(null, now)).toBe(true)
  })
  it('waits 30 days after "Not now"', () => {
    expect(canReask(String(now - REASK_AFTER_MS + 1), now)).toBe(false)
    expect(canReask(String(now - REASK_AFTER_MS), now)).toBe(true)
  })
  it('ignores a garbled value', () => {
    expect(canReask('soon', now)).toBe(true)
  })
})
