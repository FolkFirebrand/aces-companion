# The force is free to change until the first sortie is completed

Not every player builds their force through setup: some skip it, upload a force file, fix units on the Roster, or load a file from elsewhere. So until the first sortie is completed the campaign is *setting up*: units join and leave for free by any route, and the Starting Warchest Balance is worked out again after every change as a base (400 SP, or an Existing Force's carried Warchest) plus 40 SP per unspent PV. Completing the first sortie puts the campaign *under way*: the Starting Warchest is fixed, and units only join or leave by being bought or sold in a sortie, so every SP shows on the Campaign Log. Reopening that sortie returns the campaign to setting up.

## Consequences

- The base is saved (`warchestBase`); the Starting Warchest is not trusted while setting up, so a stale figure from an older save or another route corrects itself.
- A roster with no units converts no PV, so a blank campaign starts at 400 SP rather than 16,400.
- A typed Starting Warchest while setting up sets the base under the current unspent-PV SP, for players carrying a paper campaign over.
- A draft first sortie no longer locks the force; removing a unit also drops it from draft sorties.
