# App code under GPL-3.0-or-later; unit data and pictures from mm-data under CC BY-NC-SA 4.0

Version 2 adds a unit list and an Alpha Strike battle tracker. The Master Unit List no longer has a usable API and publishes no terms for third-party use, so the unit data and unit pictures come from MegaMek Data (mm-data), which is licensed CC BY-NC-SA 4.0. The app's own code is licensed GPL-3.0-or-later, so we may port damage, heat and critical-hit logic from the GPL community tools (MekBay, BattleTech Tools), crediting each port in NOTICE. We chose GPL over MIT for that reason, and to match those tools. The cost is that anyone building on this app must keep it GPL.

## Consequences

- The code (GPL) and the data (CC BY-NC-SA) are licensed separately. Generated unit-data files carry their own notice and stay non-commercial, attributed to the MegaMek Team, and share-alike.
- No Master Unit List data or images (except faction availability per era: see ADR 0008), and no Catalyst, BattleTech or Alpha Strike logos. Cards use our own Company Dossier style. (Unit pictures are MegaMek's unit icons or the player's own photos: see ADR 0006.)
- mm-data's Alpha Strike values are calculated by MegaMek and may occasionally differ from official cards, so a unit's PV and Size stay editable.
- The File tab credits MegaMek and states both licenses, along with the fan-project disclaimer.
