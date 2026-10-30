# Aces Campaign Log

The bookkeeping side of an Aces campaign: the player force, its named pilots, and the running record of sorties played and Support Points earned and spent. Terms follow the rulebook's own wording wherever it has one.

## Campaign records

**Campaign Log**:
The running record of every sortie played, one row per sortie, carrying the warchest balance forward.
_Avoid_: History, ledger

**Sortie Log**:
The income-and-expenses breakdown for a single sortie, whose bottom line is that sortie's Earnings.
_Avoid_: Sortie sheet, mission report

**Warchest**:
The force's pool of unspent Support Points. Always the Starting Warchest Balance plus every sortie's Earnings, minus SP allocated to Named Pilots, minus Purchases.
_Avoid_: Bank, balance, funds

**Starting Warchest Balance**:
The SP a campaign begins with: 400 SP for a new force, plus 40 SP for each PV left unspent when building it.
_Avoid_: Opening balance, initial SP

**Earnings**:
A sortie's Total Income minus its Total Expenses. Can be negative.
_Avoid_: Profit, net, payout

## Difficulty

**Difficulty Level**:
The campaign's chosen challenge — Rookie, Standard, Veteran, Elite, Legendary, or Custom — setting both a Player Force PV % and an SP Earned %.
_Avoid_: Difficulty modifier (when meaning the level itself)

**Existing-Force Modifier**:
An extra Player Force PV penalty (−10% to −40%) based on the Named Pilots' combined Total SP Earned, applied from the sortie after a new band is reached.

## Campaigns

**Aces Rulebook**:
The rulebook from the BattleTech: Aces box set; the source every step and page reference in the app points to.

**Campaign File**:
A downloaded backup of one whole campaign, which can be loaded on any device to continue it or to start a new campaign with the same force.
_Avoid_: Export, save file, JSON

**Existing Force**:
A Player Force and its Named Pilots carried from a finished campaign into a new one, adjusted per the book's existing-force steps.
_Avoid_: Veteran force, imported force

## Sorties

**Sortie**:
A single scenario played as part of the campaign.
_Avoid_: Mission, battle, game

**Sortie Number**:
The number the Campaign Book gives a sortie (e.g. 05). It repeats when a Failed Sortie is replayed, so it is not the order sorties were played in.
_Avoid_: Sortie ID, mission number

**Failed Sortie**:
A sortie whose Primary Objective was not completed. It is replayed; it may be noted on the Campaign Log but changes nothing — no Earnings, casualties, or pilot improvement.
_Avoid_: Loss, defeat

**Completed Sortie**:
A sortie whose results have been applied to the Player Force. Until then it is a draft; only the latest Completed Sortie can be reopened.
_Avoid_: Closed, finalized, submitted

**Listed PV**:
The PV a sortie's instructions allow the player force to field, before modifiers.

**PV Limit**:
The PV the player may actually field in a sortie: Listed PV × (100% + Difficulty Level PV % + Existing-Force Modifier).
_Avoid_: PV cap, budget

**Sortie Setup Steps**:
The book's seven numbered steps taken before play (record log, story, reconnaissance, play area, player force, opposing force, special rules).

**After-Sortie Steps**:
The book's seven numbered steps taken after play (game-end waypoints, outcome, casualties, income and expenses, improve pilots, purchases, next steps).

**Fielded Units**:
The units from the Player Force gathered to play a particular sortie, up to that sortie's PV limit.
_Avoid_: Drop Deck, deployed units, lance

**Opposing Force**:
The enemy units a sortie's Campaign Book entry tells the player to field, set up in Sortie Setup step 6. They belong to that sortie only and never join the Player Force or count in the books.
_Avoid_: OpFor (in user-facing text), enemy force, AI force

**Custom Unit**:
A unit entered by hand rather than picked from the unit list, e.g. a homebrew design or one the list doesn't have.
_Avoid_: Typed-in unit, manual unit

**Play Mode**:
The "Play the Sortie" screen where the battle is tracked on Alpha Strike Cards, round by round. Marks stay pending until applied to a card or until the round ends.
_Avoid_: Battle tracker (in user-facing text), game mode

**Alpha Strike Card**:
A unit's card in Play Mode: its Alpha Strike stats, live move, damage and to-hit, and the armor and structure pips marked as it takes damage.
_Avoid_: Record sheet, unit sheet

**Participated**:
A Named Pilot participated in a sortie when assigned to one of its Fielded Units. Pilots who sat out earn half SP.
_Avoid_: Deployed, active

**Force Commander**:
The Named Pilot (or unit) chosen at setup to command the player side for a sortie.

**Keyword**:
A campaign flag gained from waypoint or outcome text, checked by later sorties.
_Avoid_: Tag, flag, unlock

## Casualties and damage

**Damage State**:
A Fielded Unit's condition at the end of a sortie: undamaged, armor damage only, structure damage or criticals, crippled, destroyed, or truly destroyed. It sets the unit's repair cost.

**Salvage Check**:
A 2D6 roll for a destroyed unit to see whether it can be repaired (BattleMech 4+, combat vehicle 6+, battle armor 8+, infantry 10+).

**Truly Destroyed**:
A destroyed unit beyond repair — a failed Salvage Check, or an automatic case (ammo/fuel critical without CASE, emplacement, airborne crash). It leaves the Player Force for the Memorial.
_Avoid_: Lost, dead, written off

**Crew Check**:
A 2D6 roll for each destroyed unit's crew: 2–3 killed, 4–6 wounded, 7+ unscathed.

**Wounded**:
A Named Pilot who cannot be fielded in the next sortie, recovering after it.

**Memorial**:
The list of Truly Destroyed units, Named Pilots killed in action, and Named Pilots Dismissed (marked as such).
_Avoid_: Graveyard, losses

## Spending

**Purchases**:
The net SP a sortie's step 6 costs the Warchest: units bought at PV × 40 SP, less units sold at PV × 20 SP.
_Avoid_: Shopping, acquisitions

## Pilots

**Named Pilot**:
One of the force's 2–6 hero pilots who earn SP and improve over the campaign. Every other unit is crewed by a generic Skill 4 crew.
_Avoid_: Hero, character, MechWarrior, barracks pilot

**Dismissed**:
A Named Pilot removed from the force by the players' choice, as opposed to killed in action. Recorded on the Memorial as dismissed.
_Avoid_: Fired (clashes with weapons fire), deleted, retired

**Total SP Earned**:
All SP a Named Pilot has ever received: 150 at creation, plus their share of each sortie, plus MVP bonuses, plus any Carried-over SP. Always fully allocated across Skill, Edge Tokens, and Edge Abilities.
_Avoid_: Pilot XP, pilot SP balance

**MVP**:
The Most Valuable Pilot chosen after a sortie, earning a 20 SP bonus that does not come out of the Warchest.

**Carried-over SP**:
SP a Named Pilot earned in a previous campaign and brings into this one.
_Avoid_: Legacy SP, imported SP
