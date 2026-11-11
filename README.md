# Aces Campaign Log Companion

A digital companion app for **BattleTech: Aces** — digitizes the paper campaign log sheets into a hosted web UI with local-first data storage and JSON export/import for sharing between devices and sessions.

## Features

### Campaign setup
- **Guided setup** — campaign and force name, Difficulty Level (Rookie to Legendary, or Custom), and a Starting Warchest Balance that includes 40 SP per unspent PV
- **Existing Force** — carry units and Named Pilots over from a finished campaign, with Carried-over SP and the Existing-Force Modifier applied per the book
- **Force import** — load MegaMek `.mul` files (MekBay exports them), Unit Builder JSON, or the app's own force files; units are matched to the unit list, and the rest come in as custom units

### Player Force
- **Unit list** — 8,000+ units from MegaMek Data, searchable and filterable by faction, era and damage by range, with a stats preview before adding
- **PV fit** — a summary bar shows the force against the sortie's PV Limit
- **OMNI units** — reconfigure OmniMechs on the unit card
- **Named Pilots** — up to 6, with callsign, unit type and a cropped photo; assign them to units from a dropdown on either the pilot or the unit card
- **Memorial** — Truly Destroyed units, pilots killed in action, and Dismissed pilots

### Sorties
- **Sortie checklist** — the book's seven Sortie Setup Steps and seven After-Sortie Steps, in order
- **Opposing Force** — pick enemy units from the same unit list; copies are numbered and their PV totalled
- **Play Mode** — Alpha Strike Cards for both sides: armor and structure pips, heat to shutdown, critical hits, motive damage, Edge tokens and limited-use specials, with live move, sprint, damage and to-hit. Marks stay pending until applied or the round ends; "Battle over" records the Primary Objective and opens the After-Sortie Steps
- **Casualties** — Salvage Checks and Crew Checks; type in real dice or let the app roll
- **Sortie Log** — income and expenses (objectives, difficulty, recon, rearming, personnel, repairs) with Earnings worked out as you go
- **Improve pilots** — Skill, Edge Tokens and Edge Abilities tracks with an SP guard, half SP for pilots who sat out, and a +20 SP MVP award
- **Purchases** — buy units at PV × 40 SP, sell at PV × 20 SP, and hire replacement pilots
- **Drafts until completed** — Failed Sorties change nothing, and the latest Completed Sortie can be reopened

### Campaign Log and saving
- **Campaign Log** — one row per sortie with the running Warchest balance
- **Autosave** — everything is saved to `localStorage` on every change; there is no save button or account
- **Campaign File** — download the campaign as JSON to back it up or move devices, load it anywhere (with a confirmation before overwriting), or start a new campaign from inside the current one

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **State:** Zustand with `persist` middleware → `localStorage`
- **Deployment:** Vercel

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test
```

Jest and Testing Library tests in `src/__tests__/` cover the rules, derived selectors, store actions and key screens.

## Deploy

Zero-config deploy to Vercel. No environment variables required.

## Threshold Values

`src/lib/thresholds.ts` contains the SP cost tables for the Skill, Edge Tokens, and Edge Abilities tracks. They match the printed Named Pilot card. Only `thresholds.ts` needs to change; all derived values update automatically.

## Contact

Questions, bugs or ideas? Join the [Discord](https://discord.gg/FxBBjc8Ez9) or email [folkfirebrand@gmail.com](mailto:folkfirebrand@gmail.com).

## License

The app's code is licensed under the [GNU GPL, version 3 or later](LICENSE). Unit data and unit icons come from [MegaMek Data](https://github.com/MegaMek/mm-data) under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), which is separate from the code license. See [NOTICE](NOTICE) and [ADR 0005](docs/adr/0005-gpl-code-and-cc-unit-data.md).

This is an unofficial, non-commercial fan tool. It is not affiliated with or endorsed by Lynnvander Studios, Catalyst Game Labs, Topps or Microsoft. BattleTech: Aces is designed and developed by Lynnvander Studios.
