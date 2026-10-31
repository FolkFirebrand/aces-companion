import { render, screen, within } from '@testing-library/react'
import { TabBar, MAIN_TABS } from '@/components/dossier/TabBar'
import { LedgerRow } from '@/components/dossier/LedgerRow'

describe('TabBar', () => {
  it('marks the tab for the current page', () => {
    render(<TabBar tabs={MAIN_TABS} currentPath="/roster" />)

    expect(screen.getByRole('link', { name: 'ROSTER' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'LOG' })).not.toHaveAttribute('aria-current')
  })

  it('keeps LOG active while a sortie is open', () => {
    render(<TabBar tabs={MAIN_TABS} currentPath="/sortie/abc-123" />)

    expect(screen.getByRole('link', { name: 'LOG' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps ROSTER active on a pilot file', () => {
    render(<TabBar tabs={MAIN_TABS} currentPath="/pilots/p1" />)

    expect(screen.getByRole('link', { name: 'ROSTER' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('LedgerRow', () => {
  it('shows a Victory row with its figures and balance, linking to the sortie', () => {
    render(
      <LedgerRow
        href="/sortie/s1"
        title="03 · COLD IRON"
        state={{ label: 'VICTORY', tone: 'computed' }}
        detail="+590 earned · −260 pilots · −0 bought"
        balance={980}
        keywords={['Salvage Rights']}
      />
    )

    const row = screen.getByRole('link')
    expect(row).toHaveAttribute('href', '/sortie/s1')
    expect(within(row).getByText('03 · COLD IRON')).toBeInTheDocument()
    expect(within(row).getByText('VICTORY')).toBeInTheDocument()
    expect(within(row).getByText('980')).toBeInTheDocument()
    expect(within(row).getByText('KEYWORD · SALVAGE RIGHTS')).toBeInTheDocument()
  })

  it('marks a Failed Sortie inactive and says it had no effect', () => {
    render(
      <LedgerRow
        href="/sortie/s2"
        title="03 · COLD IRON"
        state={{ label: 'FAILED · REPLAYED', tone: 'danger' }}
        detail="No effect on the Warchest"
        balance={650}
        inactive
      />
    )

    const row = screen.getByRole('link')
    expect(row).toHaveAttribute('data-inactive', 'true')
    expect(within(row).getByText('FAILED · REPLAYED')).toBeInTheDocument()
    expect(within(row).getByText('No effect on the Warchest')).toBeInTheDocument()
  })
})
