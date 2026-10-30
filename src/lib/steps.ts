// The Aces Rulebook's two numbered checklists (p. 30–36). Names are the book's step names;
// summaries are our own words.

export type StepSection = 'setup' | 'after'

export interface StepDefinition {
  id: string
  section: StepSection
  number: number
  name: string
  page: number
  summary: string
  /** Tick-off steps have nothing to record; the player just confirms them. */
  tickOff: boolean
}

export const STEPS: StepDefinition[] = [
  { id: 'setup-1', section: 'setup', number: 1, name: 'Record Campaign Log', page: 30, summary: 'Write down the date, Sortie Number and name.', tickOff: false },
  { id: 'setup-2', section: 'setup', number: 2, name: 'Read Story and Briefing', page: 30, summary: 'Read the story and briefing aloud.', tickOff: true },
  { id: 'setup-3', section: 'setup', number: 3, name: 'Perform Reconnaissance', page: 30, summary: 'Pay for any reconnaissance options and note what you chose.', tickOff: false },
  { id: 'setup-4', section: 'setup', number: 4, name: 'Set Up the Play Area', page: 31, summary: 'Place terrain and waypoints from the sortie map.', tickOff: true },
  { id: 'setup-5', section: 'setup', number: 5, name: 'Player Force', page: 31, summary: 'Check the PV limit, gather units and reconfigure OMNIs.', tickOff: false },
  { id: 'setup-6', section: 'setup', number: 6, name: 'Opposing Force', page: 31, summary: 'Set up the command deck, units and Aces decks.', tickOff: false },
  { id: 'setup-7', section: 'setup', number: 7, name: 'Special Rules, Orders and Tokens', page: 31, summary: 'Read the sortie\'s special rules aloud and place any tokens.', tickOff: true },
  { id: 'after-1', section: 'after', number: 1, name: 'Trigger Game-End Waypoints', page: 33, summary: 'Resolve any waypoints that trigger when the game ends.', tickOff: false },
  { id: 'after-2', section: 'after', number: 2, name: 'Read Sortie Outcome', page: 33, summary: 'Read the outcome aloud and note any keywords.', tickOff: false },
  { id: 'after-3', section: 'after', number: 3, name: 'Check for Casualties', page: 33, summary: 'Salvage and crew rolls for each destroyed unit.', tickOff: false },
  { id: 'after-4', section: 'after', number: 4, name: 'Calculate Income and Expenses', page: 34, summary: 'Fill in the Sortie Log to find your Earnings.', tickOff: false },
  { id: 'after-5', section: 'after', number: 5, name: 'Improving Named Pilots', page: 35, summary: 'Share SP between Named Pilots and choose an MVP.', tickOff: false },
  { id: 'after-6', section: 'after', number: 6, name: 'Purchase Additional Units', page: 36, summary: 'Buy units at PV × 40 SP; sell them at PV × 20 SP.', tickOff: false },
  { id: 'after-7', section: 'after', number: 7, name: 'Next Steps', page: 36, summary: 'Note which sortie to play next.', tickOff: false },
]

export const ALL_STEP_IDS = STEPS.map(s => s.id)
export const SETUP_STEP_IDS = STEPS.filter(s => s.section === 'setup').map(s => s.id)

export function findStep(id: string): StepDefinition | undefined {
  return STEPS.find(s => s.id === id)
}
