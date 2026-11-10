import { render, screen, within } from '@testing-library/react'
import { UnitCard } from '@/components/roster/UnitCard'
import type { Unit } from '@/lib/types'

jest.mock('@/components/roster/PilotSelect', () => ({
  PilotSelect: () => <div data-testid="pilot-select" />,
}))

const mockRichUnit: Unit = {
  id: 'unit-1',
  nameAndVariant: 'Atlas AS7-D',
  unitType: 'BattleMech',
  pvAtSkill4: 46,
  pilotId: null,
  size: 2, ene: false,
  totalSpEarned: 0,
  imageURL: 'https://example.com/atlas.png',
  tonnage: 100,
  armor: 8,
  structure: 4,
  tmm: 1,
  damage: { short: 6, medium: 5, long: 3, extreme: 2 },
  abilities: ['ENE'],
  move: [{ move: 4, type: 'j' }],
  role: 'Juggernaut',
  overheat: 0,
}

const noop = () => {}
const defaultProps = {
  unit: mockRichUnit,
  onUpdate: noop,
  onRemove: noop,
}

describe('UnitCard rich mode', () => {
  it('renders a Damage label', () => {
    render(<UnitCard {...defaultProps} />)
    expect(screen.getByText('Damage')).toBeInTheDocument()
  })

  it('renders S, M, L range cells', () => {
    render(<UnitCard {...defaultProps} />)
    expect(screen.getByText('S')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()
  })

  it('does not render an extreme range cell', () => {
    render(<UnitCard {...defaultProps} />)
    const damageBand = screen.getByTestId('damage-band')
    expect(within(damageBand).queryByText('E')).not.toBeInTheDocument()
  })
})
