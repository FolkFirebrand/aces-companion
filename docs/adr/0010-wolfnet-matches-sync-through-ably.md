# Wolfnet 350 matches sync through Ably

The Wolfnet 350 module lets two players, each on their own device, play one match: each marks only their own Alpha Strike cards and objective points and watches the other side update live, read-only. Everything else in the app lives in one browser, so this needs a relay between devices. We use Ably channels: a match code names a channel (`wolfnet:<CODE>`), each device sends its whole side when it changes, and the other device shows it.

We considered a copy-and-paste snapshot code (no server, but no live damage or score), Supabase Realtime broadcast (no free project to spare, and the existing projects hold other apps' data and must not be used), Firebase (a stored database needing security rules) and Cloudflare Durable Objects or PartyKit (a second app to deploy). Ably needs no database, its presence shows whether the opponent is connected, and rewind replays recent messages after a reload.

## Consequences

- The Ably key lives only on the server, as `ABLY_API_KEY` on Vercel, restricted to `wolfnet:*` channels. `/api/wolfnet/token` hands a device a four-hour pass for one match's channel; devices never see the key.
- No match data is stored by us. Each device keeps its own side and the opponent's last-seen side in its browser storage, apart from the campaign.
- Only committed marks are sent; pending marks stay on the device until applied.
- The match code is the only lock: anyone with it can watch or join. The first other device to send a side is the opponent; later ones are ignored.
- Without the key (local development), messages only pass between tabs of one browser, which share a player and match, so it is a test stand-in, not two-player play.
