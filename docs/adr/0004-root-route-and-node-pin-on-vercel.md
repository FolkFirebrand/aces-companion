# One root route and a pinned Node major on Vercel

Two production outages in May 2026 set these rules for deploying to Vercel.

- **The root URL has exactly one handler: `src/app/page.tsx`.** A redirect for `/` in `next.config.ts` alongside an App Router `redirect()` in the root page raced on Vercel and served a 404. Never add a `/` redirect in `next.config.ts`. The root page must exist anyway, because Next.js 16's type validator requires a root segment. When the welcome page replaces the redirect, it simply becomes that page.
- **`engines.node` names one major (`"22.x"`), never an open range.** An open `>=20.9.0` let Vercel move to Node 24 when it was released, breaking every deployment. The project was pinned to `20.x`; that line reached end-of-life in April 2026, so the pin moved to `22.x` (supported to April 2027). Move it deliberately, one major at a time, after a preview deploy succeeds.
