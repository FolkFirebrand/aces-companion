// Live matches: each device sends its own side on the match's channel and shows the other side read-only.
// On the site, Ably relays the messages (the key stays on the server; /api/wolfnet/token hands out a pass for one
// match's channel). Where no key is set up, e.g. local development, messages only go between tabs of one browser,
// which share one player and match; that is enough for tests to stand in for an opponent, not for two players.
import type { MatchRole, WnSide } from './types'

export type MatchMessage =
  | { kind: 'side'; from: string; role: MatchRole; scenario: number | null; side: WnSide }
  /** Sent on joining: asks the other device to send its side again. */
  | { kind: 'hello'; from: string }

export type LinkStatus = 'connecting' | 'live' | 'local' | 'offline'

export interface MatchLink {
  send: (message: MatchMessage) => void
  close: () => void
}

export interface LinkHandlers {
  onMessage: (message: MatchMessage) => void
  onStatus: (status: LinkStatus) => void
  /** Whether a device other than this one is in the match right now. */
  onOpponentOnline: (online: boolean) => void
}

export function channelName(code: string): string {
  return `wolfnet:${code}`
}

/** The side as the opponent sees it: committed marks only, without changes still pending on this device. */
export function publicSide(side: WnSide): WnSide {
  return {
    ...side,
    battle: { ...side.battle, units: Object.fromEntries(Object.entries(side.battle.units).map(([id, r]) => [id, { committed: r.committed, notes: r.notes, destroyedRound: r.destroyedRound }])) },
  }
}

function tokenUrl(code: string, playerId: string): string {
  return `/api/wolfnet/token?code=${encodeURIComponent(code)}&clientId=${encodeURIComponent(playerId)}`
}

/** Opens the match's channel: through Ably if the site has it set up, otherwise between tabs in this browser. */
export async function openMatchLink(code: string, playerId: string, handlers: LinkHandlers): Promise<MatchLink> {
  handlers.onStatus('connecting')
  const check = await fetch(tokenUrl(code, playerId)).catch(() => null)
  if (check?.status === 503 || !check) return openLocalLink(code, playerId, handlers, !check)
  return openAblyLink(code, playerId, handlers)
}

function openLocalLink(code: string, playerId: string, handlers: LinkHandlers, offline: boolean): MatchLink {
  if (typeof BroadcastChannel === 'undefined') {
    handlers.onStatus('offline')
    return { send: () => {}, close: () => {} }
  }
  const channel = new BroadcastChannel(channelName(code))
  channel.onmessage = event => {
    const message = event.data as MatchMessage
    if (message.from === playerId) return
    handlers.onOpponentOnline(true)
    handlers.onMessage(message)
  }
  handlers.onStatus(offline ? 'offline' : 'local')
  return { send: message => channel.postMessage(message), close: () => channel.close() }
}

async function openAblyLink(code: string, playerId: string, handlers: LinkHandlers): Promise<MatchLink> {
  const Ably = await import('ably')
  const client = new Ably.Realtime({
    clientId: playerId,
    authCallback: (_params, callback) => {
      fetch(tokenUrl(code, playerId))
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(tokenRequest => callback(null, tokenRequest), err => callback(err instanceof Error ? err.message : String(err), null))
    },
  })
  client.connection.on(change => {
    if (change.current === 'connected') handlers.onStatus('live')
    else if (['disconnected', 'suspended', 'failed', 'closed'].includes(change.current)) handlers.onStatus('offline')
    else handlers.onStatus('connecting')
  })
  // Rewind replays recent messages on joining, so a quick reload has the opponent's side straight away.
  const channel = client.channels.get(channelName(code), { params: { rewind: '10' } })
  const refreshPresence = () => {
    channel.presence.get().then(members => handlers.onOpponentOnline(members.some(m => m.clientId !== playerId)), () => {})
  }
  await channel.subscribe('match', message => {
    const data = message.data as MatchMessage
    if (data.from !== playerId) handlers.onMessage(data)
  })
  await channel.presence.subscribe(refreshPresence)
  await channel.presence.enter().catch(() => {})
  refreshPresence()
  return {
    send: message => { channel.publish('match', message).catch(() => {}) },
    close: () => {
      channel.presence.leave().catch(() => {})
      client.close()
    },
  }
}
