// The ten AS350 scenarios, numbered as on the Random Scenario Roll Table. Summaries are our own short reminders;
// the rules book's scenario page (given as `page`) has the full setup, map and scoring.

export interface Scenario {
  number: number
  name: string
  page: number
  /** Open beta in AS350 3.0; tournaments may leave it out of the roll. */
  beta?: true
  objective: string
  scoring: string[]
}

export const SCENARIOS: Scenario[] = [
  {
    number: 1, name: 'Bunkers', page: 16,
    objective: "Destroy the opponent's three bunkers (20 HP each), attacking only through the door's line-of-sight zone or by infiltrating with infantry.",
    scoring: ['1 point for every 15 bunker damage dealt in total.', 'Ties: most bunkers destroyed, then most bunker damage.'],
  },
  {
    number: 2, name: 'Capture the Flag', page: 17,
    objective: "Carry flags from the three centre objectives back to your team base.",
    scoring: ['1 point per flag deposited in your uncontested base.'],
  },
  {
    number: 3, name: 'Domination', page: 18,
    objective: 'Hold objectives with grounded, uncontested, dismounted units in the End Phase.',
    scoring: ['Win by holding 4 of the 5 objectives in one End Phase.', 'At time: 1 point per objective you hold. Not cumulative.'],
  },
  {
    number: 4, name: 'King of the Hill', page: 19,
    objective: 'Have the greater combined size of grounded units on the 5" objective in the End Phase.',
    scoring: ['1 point per round you have the greater combined size; ties score nothing.', 'ProtoMechs and infantry don\'t count toward size.'],
  },
  {
    number: 5, name: 'Stand Up Fight', page: 20,
    objective: "Destroy the opponent's units.",
    scoring: ['65 PV destroyed: 1 point · 130 PV: 2 · 195 PV: 3 · every unit: 4.', 'Crippled units count half their PV.'],
  },
  {
    number: 6, name: 'Overrun', page: 21,
    objective: "Control zones A and B and the opponent's home zone by combined unit size.",
    scoring: ['Zones A and B: 1 point each. Opponent\'s home zone: 2 points.', 'Points scored at the end; ties go to whoever holds the opponent\'s home zone.'],
  },
  {
    number: 7, name: 'Headhunter', page: 22,
    objective: 'Destroy the two enemy Command Units, then capture the tokens they leave.',
    scoring: ['1 point per Command Unit destroyed, 1 more per token captured.', 'One Command Unit must be your highest-PV deployed unit; neither may be infantry.'],
  },
  {
    number: 8, name: 'Hold the Line', page: 23,
    objective: "Capture all three of the opponent's 1\" objectives near their home edge.",
    scoring: ['Left and right objectives: 1 point each. Centre: 2 points.'],
  },
  {
    number: 9, name: 'Under Pressure', page: 24, beta: true,
    objective: "Hold the pressure plates to open the opponent's bunker doors, then damage the bunkers (20 HP each).",
    scoring: ['1 point for every 10 damage to a single bunker.', 'Listed as Pressure Plate on the roll table.'],
  },
  {
    number: 10, name: 'Stranglehold', page: 25, beta: true,
    objective: "Destroy the opponent's encampments with aimed shots and outnumber them in their half.",
    scoring: ['1 point per encampment destroyed.', "1 point each End Phase you have the greater combined size in the opponent's half."],
  },
]

export function scenarioByNumber(number: number | null): Scenario | undefined {
  return SCENARIOS.find(s => s.number === number)
}

/** Rolls a scenario: a D10 on the roll table, rerolling beta scenarios when they're left out. */
export function rollScenario(includeBeta: boolean, random: () => number = Math.random): number {
  const pool = SCENARIOS.filter(s => includeBeta || !s.beta)
  return pool[Math.floor(random() * pool.length)].number
}

/** Stand Up Fight's points for the PV destroyed: 65, 130 and 195 PV, or 4 when every unit is destroyed. */
export function standUpFightPoints(destroyedPv: number, allDestroyed: boolean): number {
  if (allDestroyed) return 4
  return destroyedPv >= 195 ? 3 : destroyedPv >= 130 ? 2 : destroyedPv >= 65 ? 1 : 0
}
