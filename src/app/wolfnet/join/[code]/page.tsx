'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useHydrated } from '@/lib/useHydrated'
import { normalizeMatchCode } from '@/lib/wolfnet/codes'
import { MatchSetup } from '@/components/wolfnet/MatchSetup'

/** A join link: /wolfnet/join/K7QX2M. */
export default function WolfnetJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeMatchCode(use(params).code)
  const hydrated = useHydrated()
  if (!code) return notFound()
  return hydrated ? <MatchSetup role="guest" code={code} /> : null
}
