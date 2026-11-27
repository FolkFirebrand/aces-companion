'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useWolfnetStore } from '@/store/wolfnet'
import { useHydrated } from '@/lib/useHydrated'
import { ForceEditor } from '@/components/wolfnet/ForceEditor'

export default function WolfnetForcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const force = useWolfnetStore(s => s.forces.find(f => f.id === id))
  const hydrated = useHydrated()

  // Forces live in this browser, so only after hydration can a missing one be told apart.
  if (!hydrated) return null
  if (!force) return notFound()
  return <ForceEditor force={force} />
}
