import { useCallback, useEffect, useRef, useState } from 'react'
import { useWolfnetStore } from '@/store/wolfnet'
import { openMatchLink, publicSide } from '@/lib/wolfnet/sync'
import type { LinkStatus, MatchLink } from '@/lib/wolfnet/sync'

const SEND_DELAY_MS = 250

/** Keeps the match in step with the other device: sends this side when it changes, takes theirs when it arrives. */
export function useMatchSync(): { status: LinkStatus; opponentOnline: boolean } {
  const code = useWolfnetStore(s => s.match?.code)
  const playerId = useWolfnetStore(s => s.playerId)
  const me = useWolfnetStore(s => s.match?.me)
  const scenario = useWolfnetStore(s => s.match?.scenario)
  const [status, setStatus] = useState<LinkStatus>('connecting')
  const [opponentOnline, setOpponentOnline] = useState(false)
  const link = useRef<MatchLink | null>(null)
  const lastSent = useRef('')

  // Sends this side unless the other device already has exactly this; `force` answers a device that just joined.
  const sendSide = useCallback((force = false) => {
    const { match } = useWolfnetStore.getState()
    if (!match || !link.current) return
    const message = { kind: 'side' as const, from: match.me.playerId, role: match.role, scenario: match.scenario, side: publicSide(match.me) }
    const text = JSON.stringify({ ...message, side: { ...message.side, updatedAt: 0 } })
    if (!force && text === lastSent.current) return
    lastSent.current = text
    link.current.send(message)
  }, [])

  useEffect(() => {
    if (!code) return
    let live = true
    let opened: MatchLink | null = null
    openMatchLink(code, playerId, {
      onMessage: message => {
        if (message.kind === 'hello') sendSide(true)
        else useWolfnetStore.getState().receive(message)
      },
      onStatus: setStatus,
      onOpponentOnline: online => {
        setOpponentOnline(online)
        if (online) sendSide(true)
      },
    }).then(l => {
      if (!live) return l.close()
      opened = l
      link.current = l
      l.send({ kind: 'hello', from: playerId })
      sendSide(true)
    })
    return () => {
      live = false
      opened?.close()
      link.current = null
    }
  }, [code, playerId, sendSide])

  useEffect(() => {
    const timer = setTimeout(() => sendSide(), SEND_DELAY_MS)
    return () => clearTimeout(timer)
  }, [me, scenario, sendSide])

  return { status, opponentOnline }
}
