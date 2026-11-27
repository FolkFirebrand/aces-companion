// Hands a device a short-lived Ably pass for one Wolfnet match's channel. The Ably key stays here on the server
// (ABLY_API_KEY); without it, live matches fall back to tabs in one browser.
import type { NextRequest } from 'next/server'
import Ably from 'ably'
import { channelName } from '@/lib/wolfnet/sync'
import { normalizeMatchCode } from '@/lib/wolfnet/codes'

const FOUR_HOURS = 4 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const key = process.env.ABLY_API_KEY
  if (!key) return Response.json({ error: 'Live matches are not set up on this site.' }, { status: 503 })
  const code = normalizeMatchCode(request.nextUrl.searchParams.get('code') ?? '')
  const clientId = request.nextUrl.searchParams.get('clientId') ?? ''
  if (!code || !/^[\w-]{1,64}$/.test(clientId)) return Response.json({ error: 'Bad match code or player.' }, { status: 400 })

  const tokenRequest = await new Ably.Rest({ key }).auth.createTokenRequest({
    clientId,
    ttl: FOUR_HOURS,
    capability: { [channelName(code)]: ['publish', 'subscribe', 'presence', 'history'] },
  })
  return Response.json(tokenRequest, { headers: { 'Cache-Control': 'no-store' } })
}
