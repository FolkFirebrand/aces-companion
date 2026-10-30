# Warchest and pilot SP are derived from the Campaign Log, never stored

The Warchest balance and each Named Pilot's Total SP Earned are calculated from the Campaign Log (Starting Warchest Balance, each sortie's Earnings, pilot SP allocations, MVP awards, Purchases) rather than kept as editable numbers. This mirrors the paper Campaign Log, where every row's balance follows from the row above, so the app and the printed sheets can never disagree. Corrections are made by editing the sortie that caused them, not by overwriting a total.

## Consequences

- Failed Sorties are kept in the log but contribute nothing to either total.
- Introduced as a clean break: saved data from the earlier hand-typed model (used once) is not migrated.
