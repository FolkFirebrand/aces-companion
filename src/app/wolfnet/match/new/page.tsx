'use client'

import { useHydrated } from '@/lib/useHydrated'
import { MatchSetup } from '@/components/wolfnet/MatchSetup'

export default function WolfnetNewMatchPage() {
  return useHydrated() ? <MatchSetup role="host" /> : null
}
