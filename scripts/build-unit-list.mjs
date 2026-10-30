// Builds the unit list from MegaMek's generated unit catalog (ADR 0005, #34).
//
//   npm run build:unit-list                       downloads the catalog from MekBay
//   npm run build:unit-list -- --input units.json uses a catalog file already downloaded
//   add --mm-data-sha <commit> to pin the unit icons to a given mm-data commit (default: its latest)
//   add --factions <file> to use MekBay's faction file already downloaded (ADR 0008)
//
// Writes public/unit-list/units-<catalog version>-<mm-data commit>-<factions version>.json (CC BY-NC-SA 4.0, with LICENSE.txt beside it)
// and src/lib/unit-list/manifest.ts, which tells the app which file to load. Commit all three.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertCatalog, unitListFactions } from '../src/lib/unit-list/convert.ts'

const CATALOG_URL = 'https://db.mekbay.com/units.json'
const FACTIONS_URL = 'https://db.mekbay.com/factions.json'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'unit-list')

const inputIndex = process.argv.indexOf('--input')
let catalog
if (inputIndex > -1) {
  catalog = JSON.parse(readFileSync(process.argv[inputIndex + 1], 'utf8'))
} else {
  console.log(`Downloading ${CATALOG_URL} …`)
  const response = await fetch(CATALOG_URL)
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
  catalog = await response.json()
}

// Faction availability per era comes from MekBay's faction file (ADR 0008).
const factionsIndex = process.argv.indexOf('--factions')
let factionCatalog
if (factionsIndex > -1) {
  factionCatalog = JSON.parse(readFileSync(process.argv[factionsIndex + 1], 'utf8'))
} else {
  console.log(`Downloading ${FACTIONS_URL} …`)
  const response = await fetch(FACTIONS_URL)
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
  factionCatalog = await response.json()
}

// Unit icons come from mm-data at one pinned commit (ADR 0006); icons it doesn't have are dropped.
const GITHUB_API = 'https://api.github.com/repos/MegaMek/mm-data'
async function github(path) {
  const response = await fetch(`${GITHUB_API}/${path}`, { headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`GitHub ${path}: HTTP ${response.status}`)
  return response.json()
}
const shaIndex = process.argv.indexOf('--mm-data-sha')
const iconsCommit = shaIndex > -1 ? process.argv[shaIndex + 1] : (await github('commits/main')).sha
const imagesDir = await github(`contents/data/images?ref=${iconsCommit}`)
const unitsTree = await github(`git/trees/${imagesDir.find(d => d.name === 'units').sha}?recursive=1`)
if (unitsTree.truncated) throw new Error('The mm-data icon tree was truncated; cannot check icon paths.')
const iconPaths = new Set(unitsTree.tree.filter(t => t.type === 'blob').map(t => t.path))

const catalogVersion = String(catalog.version)
const factionsVersion = String(factionCatalog.version)
const units = convertCatalog(catalog.units, iconPaths, factionCatalog)
const file = {
  source: `MegaMek's generated unit catalog (from MegaMek Data, https://github.com/MegaMek/mm-data), as published by MekBay at ${CATALOG_URL}`,
  license: 'CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/)',
  attribution: 'MegaMek Data (C) The MegaMek Team. Trimmed to Alpha Strike stats for Aces Campaign Log.',
  catalogVersion,
  iconsCommit,
  fetchedAt: new Date().toISOString(),
  factionsSource: `Faction availability per era from MekBay's faction file at ${FACTIONS_URL}; era names and dates as on Sarna (https://www.sarna.net/wiki/BattleTech_eras)`,
  factionsVersion,
  factions: unitListFactions(factionCatalog),
  units,
}

mkdirSync(outDir, { recursive: true })
for (const old of readdirSync(outDir).filter(f => /^units-.*\.json$/.test(f))) rmSync(join(outDir, old))
const fileName = `units-${catalogVersion}-${iconsCommit.slice(0, 7)}-${factionsVersion}.json`
writeFileSync(join(outDir, fileName), JSON.stringify(file))
writeFileSync(join(outDir, 'LICENSE.txt'), `The unit list in this folder is derived from MegaMek Data
(https://github.com/MegaMek/mm-data), (C) The MegaMek Team, via MegaMek's generated
unit catalog as published by MekBay (${CATALOG_URL}).

It is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0
International (CC BY-NC-SA 4.0): https://creativecommons.org/licenses/by-nc-sa/4.0/
Each unit's faction availability per era comes from MekBay's faction file
(${FACTIONS_URL}), which publishes no license of its own (see the app's ADR 0008).

The unit data is not covered by the app's GPL license. Use it only non-commercially, credit the
MegaMek Team, and share anything derived from it under the same license.

MechWarrior Copyright Microsoft Corporation. MegaMek Data was created under Microsoft's
"Game Content Usage Rules" (https://www.xbox.com/en-US/developers/rules) and it is not
endorsed by or affiliated with Microsoft.
`)
writeFileSync(join(root, 'src', 'lib', 'unit-list', 'manifest.ts'), `// Generated by scripts/build-unit-list.mjs. Do not edit by hand.
export const UNIT_LIST = {
  file: '/unit-list/${fileName}',
  catalogVersion: '${catalogVersion}',
  iconsCommit: '${iconsCommit}',
  factionsVersion: '${factionsVersion}',
  fetchedAt: '${file.fetchedAt}',
  count: ${units.length},
} as const
`)
console.log(`Wrote ${units.length} units (${units.filter(u => u.icon).length} with icons, mm-data ${iconsCommit.slice(0, 7)}) to public/unit-list/${fileName}`)
