import { REPO_URL } from '@/lib/links'

const LINK = 'text-result underline underline-offset-2'

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>{children}</a>
}

/** The license and legal notice (ADR 0005). The wording follows the project's NOTICE file. */
export function LegalNotice() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="m-0">
        Aces Campaign Log is an unofficial, non-commercial, fan-made tool for BattleTech: Aces. It is not affiliated
        with or endorsed by Lynnvander Studios, Catalyst Game Labs, The Topps Company, Inc. or Microsoft Corporation.
        You need the Aces box set to play.
      </p>
      <p className="m-0">
        BattleTech: Aces is designed and developed by{' '}
        <ExternalLink href="https://www.lynnvander.com">Lynnvander Studios</ExternalLink>.
      </p>
      <p className="m-0">
        The app&apos;s source code is free software under the{' '}
        <ExternalLink href="https://www.gnu.org/licenses/gpl-3.0.html">GNU GPL, version 3 or later</ExternalLink>.
        Read the <ExternalLink href={`${REPO_URL}/blob/master/NOTICE`}>NOTICE</ExternalLink> and the{' '}
        <ExternalLink href={`${REPO_URL}/blob/master/LICENSE`}>license</ExternalLink>.
      </p>
      <ul className="m-0 pl-5 flex flex-col gap-1.5 list-disc">
        <li>
          MechWarrior, BattleMech, &apos;Mech and AeroTech are registered trademarks of The Topps Company, Inc. All
          rights reserved.
        </li>
        <li>Catalyst Game Labs and the Catalyst Game Labs logo are trademarks of InMediaRes Productions, LLC.</li>
        <li>
          MechWarrior Copyright Microsoft Corporation. MegaMek Data was created under Microsoft&apos;s{' '}
          <ExternalLink href="https://www.xbox.com/en-US/developers/rules">Game Content Usage Rules</ExternalLink>
          {' '}and is not endorsed by or affiliated with Microsoft.
        </li>
      </ul>
      <p className="m-0">
        Unit data and unit icons come from{' '}
        <ExternalLink href="https://github.com/MegaMek/mm-data">MegaMek Data</ExternalLink>
        {' '}by the MegaMek Team. They are not covered by the app&apos;s GPL license; they are licensed under{' '}
        <ExternalLink href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</ExternalLink>:
        non-commercial use, with attribution, shared under the same license.
      </p>
      <p className="m-0">
        Faction availability per era comes from <ExternalLink href="https://mekbay.com">MekBay</ExternalLink>. Era
        names and dates follow <ExternalLink href="https://www.sarna.net/wiki/BattleTech_eras">Sarna</ExternalLink>.
      </p>
      <p className="m-0 text-text-secondary">
        This software is provided &ldquo;as is&rdquo;, without warranty of any kind, express or implied.
      </p>
    </div>
  )
}
