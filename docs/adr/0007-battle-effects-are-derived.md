# Battle effects are derived from the marks on a card, never stored

In play mode a sortie's battle record keeps only what the player marked on each Alpha Strike Card: armor and structure hits, heat, critical hits taken on each track, ammo hit, destroyed by hand, and notes. A card's live values (move, Sprint, TMM, damage including 0*, to-hit, destroyed, crippled, shutdown) are calculated from those marks and the unit's stats every time, like the Warchest and pilot SP (ADR 0001). The alternative was writing the reduced values onto the card as hits were marked. We chose derivation so that unmarking a pip, discarding pending changes, or reopening a sortie always gives the right numbers. It also means a rule fix corrects every saved battle, with no data to migrate.

The heat and critical-hit formulas follow BattleTech Tools' Alpha Strike play mode (credited in NOTICE). That means:

- MP hits halve move rounded, losing at least 2", and TMM likewise, losing at least 1;
- weapons hits take 1 damage off each range, and a value that lands on 0 becomes 0*;
- heat costs 2" of ground move per level and −1 TMM from heat 2, and Shutdown sets move to 0 and TMM to −4;
- to-hit is Skill + range + heat + 2 per fire-control hit.

"Crippled" follows Alpha Strike's Forced Withdrawal rule, which the Aces Rulebook cites for repairs: armor gone with structure at half or less, every damage value reduced to 0, or unable to move from damage.

## Consequences

- Marks saved before a track existed read as zero, so older battle records stay valid without a schema change.
- The After-Sortie Steps (#46) read the same derived values (destroyed, crippled, the automatic Truly Destroyed cause) rather than copies of them.
