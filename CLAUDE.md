# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A digital companion app for **BattleTech: Aces** (Catalyst Game Labs / Lynnvander Studios) that digitizes the paper campaign log sheets into a hosted web UI with local-first data storage and JSON export/import. Reference PDFs: `Aces_PrintableLogSheets.pdf`, `Aces_MapGrid_rev.pdf`. Deployed on Vercel — no environment variables required.

## Commands

```bash
npm install       # install dependencies
npm run dev       # start dev server at localhost:3000
npm run build     # production build
npm run lint      # ESLint
npm test          # run all tests
npm test -- --testPathPattern=thresholds   # run a single test file
npm run test:watch  # watch mode
```

## Architecture

**Tech stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui + Base UI, Zustand, Vercel.

> ⚠️ **Next.js version warning:** This project uses Next.js 16, which has breaking changes from prior versions — APIs, conventions, and file structure may differ from training data. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for the relevant guide.

**State layer** — single Zustand store at [src/store/campaign.ts](src/store/campaign.ts) holds the entire `Campaign` object. The `persist` middleware auto-saves everything to `localStorage` under the key `aces-campaign` on every change — there is no save button. `loadCampaign` / `resetStore` are the import and new-campaign entry points.

**Selectors** — [src/store/selectors.ts](src/store/selectors.ts) computes all derived values (available SP, warchest balance, sortie earnings, pilot stat levels, next-tier costs). Components import selectors directly rather than computing anything inline.

**Threshold tables** — [src/lib/thresholds.ts](src/lib/thresholds.ts) holds the SP cost lookup tables (`SKILL_THRESHOLDS`, `EDGE_TOKEN_THRESHOLDS`, `EDGE_ABILITY_THRESHOLDS`). `lookupStatFromSP` and `nextTierCost` are the two utility functions everything else depends on. Tables are sorted descending by SP required. All three tables match the printed Named Pilot card (verified 2026-10-29). Only this file needs changing; all derived values update automatically.

**Pages and components:**
- `/roster` — units, every Named Pilot (max 6; drag onto a unit to assign), memorial, "Start Sortie" button. The old Pilots tab folded in here; `/pilots` redirects to it (`next.config.ts`)
- `/campaign` — sortie history table, running warchest, "Start Sortie" button
- `/sortie/[id]` — the sortie checklist: setup steps → Play the Sortie → after-sortie steps
- `/sortie/[id]/play` — Play Mode; "Battle over" asks for the Primary Objective and opens After-Sortie step 1
- `/pilots/[id]` — pilot detail: Skill / Edge Tokens / Edge Abilities stat tracks with SP guard, MVP button, callsign, unit type, edge ability picklist
- `/export` — JSON download and import with confirmation modal

**Tests** — Jest + Testing Library, files in [src/\_\_tests\_\_/](src/__tests__/). UUID is mocked in [src/\_\_mocks\_\_/uuid.ts](src/__mocks__/uuid.ts).

## Domain Concepts

Understanding these game terms is essential for working on this codebase:

- **SP (Support Points)**: Campaign currency for purchases, repairs, and pilot advancement.
- **PV (Point Value)**: Unit cost at Skill 4; purchase cost = PV × 40 SP; used for force composition limits.
- **Warchest**: Running SP balance accumulated across sorties (sum of all sortie earnings).
- **Sortie**: A single mission. Has Income (Primary Objective + Other Objectives × Difficulty Modifier) minus Expenses (Recon, Rearming, Personnel, Repairs) = Earnings.
- **Named Pilots**: Player characters who earn SP, advance via Skill/Edge tracks, can be wounded/killed. New pilots start at 150 SP, Skill 4, pilotType BattleMech.
- **Waypoints**: Branching recon choices that modify SP totals (tracked as `waypointsSP` on a sortie).
- **Difficulty Modifier**: Multiplier applied to total income per sortie.

**Pilot SP tracks** — each pilot has three independent SP-spent buckets (`spSpentOnSkill`, `spSpentOnEdgeTokens`, `spSpentOnEdgeAbilities`). `selectAvailableSP = totalSpEarned − sum of three buckets`. The store's `spendOnStat` checks available SP before spending; `refundStat` decrements the bucket.

**Repair costs** — `REPAIR_MULTIPLIERS`: destroyed × 100, crippled × 60, structure/criticals × 40, armor only × 20. Non-'Mechs use `size = 0.5`.

**Rearming** — units without the ENE special × 20 SP per sortie.

**Personnel** — wounded/killed crew × 100 SP; new/replacement Named Pilots × 150 SP.

## Agent skills

### Issue tracker

GitHub Issues on `FolkFirebrand/aces-companion`. Always pass `-R FolkFirebrand/aces-companion` to `gh`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Design system

All UI follows the **Company Dossier** design system: https://claude.ai/artifact/KDNaW45CRMQcSp77vkQ188 (read its `project/README.md` and `project/tokens.json` before UI work). Approved screen mockups: https://claude.ai/artifact/JcENCFL5KR9edy1XLvunNC. The current app styling is a throwaway first draft and is being replaced.
