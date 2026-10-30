# Faction and era availability come from MekBay's faction file

The unit list needs a faction filter (pick several) and an era filter. mm-data's unit catalog has neither, only each unit's introduction year. MekBay, MegaMek's own web app, publishes a faction file (https://db.mekbay.com/factions.json) listing which units each of 82 factions fields in each era. We use it.

That file is keyed by Master Unit List ids and follows the MUL's era list, so it is almost certainly derived from the MUL. It publishes no license of its own, and MekBay's GPL covers its code, not this data. This partly overrides ADR 0005's "no Master Unit List data". We accept that for a free, non-commercial fan tool: which faction fields which unit in which era is close to plain fact. We considered MegaMek's force generator files in mm-data, which are CC BY-NC-SA, but chose MekBay's file because it matches what MekBay players see and its eras map directly.

## Consequences

- We take only faction names, their groups, and the lists of units per era. No era descriptions, faction logos or other MUL text or art.
- Era names and dates are our own list, taken from Sarna (https://www.sarna.net/wiki/BattleTech_eras). MekBay's Early Republic and Late Republic both map to the Republic Age.
- Units are matched by MUL id. About 1 in 4 units in the unit list have no MUL id or no faction entry, so they never match a faction or era filter.
- The build script records the faction file's version in the unit-list file name, so browsers fetch the new file after a rebuild.
- If the MUL or MekBay ever objects, we drop this file and fall back to mm-data's force generator data or introduction years.
