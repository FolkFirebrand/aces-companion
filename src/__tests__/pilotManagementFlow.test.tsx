// src/__tests__/pilotManagementFlow.test.tsx
import { render, screen } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { PilotCard } from '@/components/pilots/PilotCard'
import type { NamedPilot, Unit } from '@/lib/types'

function makePilot(overrides: Partial<NamedPilot> = {}): NamedPilot {
  return {
    id: 'p1', callsign: 'Ghost', pilotType: 'BattleMech', wounded: false,
    mvpCount: 0, totalSpEarned: 150,
    spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0,
    edgeAbilitiesLearned: [], campaignHistory: [],
    ...overrides,
  }
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'u1', nameAndVariant: 'Atlas AS7-D', unitType: 'BattleMech',
    pvAtSkill4: 46, pilotId: null, size: 2, ene: false, totalSpEarned: 0,
    ...overrides,
  }
}

beforeEach(() => {
  useCampaignStore.getState().resetStore()
})

describe('PilotCard roster button', () => {
  it('shows "Add to Roster →" when pilot is unassigned', () => {
    render(<PilotCard pilot={makePilot()} assignedUnit={undefined} />)
    expect(screen.queryByText(/Add to Roster/i)).not.toBeNull()
  })

  it('shows "View on Roster →" when pilot is assigned', () => {
    render(<PilotCard pilot={makePilot()} assignedUnit={makeUnit({ pilotId: 'p1' })} />)
    expect(screen.queryByText(/View on Roster/i)).not.toBeNull()
  })
})

describe('PilotCard photo display', () => {
  it('renders img when pilot has photoUrl', () => {
    const pilotWithPhoto = makePilot({ photoUrl: 'data:image/jpeg;base64,abc' })
    render(<PilotCard pilot={pilotWithPhoto} assignedUnit={undefined} />)
    const img = screen.queryByRole('img')
    expect(img).not.toBeNull()
    expect((img as HTMLImageElement).src).toContain('data:image/jpeg')
  })

  it('renders no img when pilot has no photoUrl', () => {
    render(<PilotCard pilot={makePilot()} assignedUnit={undefined} />)
    expect(screen.queryByRole('img')).toBeNull()
  })
})
