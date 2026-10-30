import { Section } from '@/components/sortie/fields'

const LINK = 'text-signal-blue underline underline-offset-2'

/** Licenses and credits (ADR 0005). The wording follows the project's NOTICE file. */
export function Credits() {
  return (
    <Section title="Credits and licenses">
      <p className="m-0 text-sm">
        Aces Campaign Log is an unofficial, non-commercial fan tool for BattleTech: Aces. It is not affiliated with or
        endorsed by Catalyst Game Labs, Topps or Microsoft. BattleTech, MechWarrior and related names are trademarks of
        their owners. You need the Aces box set to play.
      </p>
      <p className="m-0 text-sm">
        The app is free software under the{' '}
        <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer" className={LINK}>GNU GPL, version 3 or later</a>.
      </p>
      <p className="m-0 text-sm">
        Unit data and unit icons come from{' '}
        <a href="https://github.com/MegaMek/mm-data" target="_blank" rel="noopener noreferrer" className={LINK}>MegaMek Data</a>
        {' '}by the MegaMek Team, licensed under{' '}
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className={LINK}>CC BY-NC-SA 4.0</a>
        : non-commercial use, with attribution, shared under the same license.
      </p>
      <p className="m-0 text-[13px] text-text-secondary">
        MechWarrior Copyright Microsoft Corporation. MegaMek Data was created under Microsoft&apos;s{' '}
        <a href="https://www.xbox.com/en-US/developers/rules" target="_blank" rel="noopener noreferrer" className={LINK}>Game Content Usage Rules</a>
        {' '}and is not endorsed by or affiliated with Microsoft.
      </p>
      <p className="m-0 text-sm">
        Questions, bugs or ideas? Join the{' '}
        <a href="https://discord.gg/FxBBjc8Ez9" target="_blank" rel="noopener noreferrer" className={LINK}>Discord</a>
        {' '}or email{' '}
        <a href="mailto:folkfirebrand@gmail.com" className={LINK}>folkfirebrand@gmail.com</a>.
      </p>
    </Section>
  )
}
