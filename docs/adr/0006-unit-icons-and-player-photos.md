# Units show MegaMek's icons, pinned on GitHub, or the player's own photo

We planned to show mm-data's unit art through a version-pinned CDN, but none of that was available. mm-data removed its fluff art in January 2026 (mm-data PR #236). The art MekBay shows is hosted on its own server with no stated license, and looks like Catalyst's technical-readout line art. jsDelivr also refuses mm-data, which is over its 50 MB limit.

So a unit shows MegaMek's own unit icon: the small top-down sprite MegaMek draws on its map, from mm-data's `data/images/units/` (CC BY-NC-SA 4.0, ADR 0005). Icons load from raw.githubusercontent.com at the mm-data commit recorded in the unit-list manifest, so a later change in mm-data can't alter them. Each icon is kept in Cache Storage once viewed, for offline use. Players can replace a unit's icon with their own photo, for example of their painted miniature, stored like pilot photos.

## Consequences

- The build script pins the mm-data commit, keeps only icon paths that exist at it, and names the unit-list file after both the catalog version and that commit, so browsers fetch the new file after a rebuild.
- What a unit shows, in order: the player's photo, a picture from an older Unit Builder import, the MegaMek icon, then a plain placeholder.
- No fluff or line art, no Master Unit List images, no logos.
- Player photos are stored in the campaign (as pilot photos are), so they travel in Campaign Files and count toward the browser's storage limit.
