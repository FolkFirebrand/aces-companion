# Aces Campaign Log Companion

A digital companion app for **BattleTech: Aces** — digitizes the paper campaign log sheets into a hosted web UI with local-first data storage and JSON export/import for sharing between devices and sessions.

## Features

- **Roster** — manage your unit roster and up to 6 named pilots, track wounded status, and maintain a memorial for lost units and pilots
- **Campaign Log** — sortie history table with running warchest balance; create new sorties in one click
- **Sortie Log** — per-sortie income/expense breakdown (objectives, recon, rearming, personnel, repairs) with real-time earnings calculation
- **Pilots** — named pilot cards with Skill, Edge Tokens, and Edge Abilities stat tracks; SP guard prevents spending beyond available points; MVP button grants +20 SP per award
- **Export / Import** — download campaign as JSON to back up or move between devices; confirmation modal before overwriting

All data is saved automatically to `localStorage` on every change — no save button required.

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

This is an unofficial, non-commercial fan tool. It is not affiliated with or endorsed by Catalyst Game Labs, Topps or Microsoft.
