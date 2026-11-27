'use client'

import { useHydrated } from '@/lib/useHydrated'
import { MatchScreen } from '@/components/wolfnet/MatchScreen'

export default function WolfnetMatchPage() {
  // The match lives in this browser's storage.
  return useHydrated() ? <MatchScreen /> : null
}
