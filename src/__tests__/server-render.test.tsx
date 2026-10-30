/**
 * @jest-environment node
 */
import { renderToString } from 'react-dom/server'
import SortiePage from '@/app/sortie/[id]/page'
import SortieStepPage from '@/app/sortie/[id]/step/[stepId]/page'
import PilotDetailPage from '@/app/pilots/[id]/page'

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

// Route params as a promise React's use() can read without suspending.
function params<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: 'fulfilled', value })
}

// The server never has the campaign: it lives in the browser's storage. A page that decides
// "not found" on the server answers a real sortie or pilot link with a 404.
describe('pages for a sortie or pilot, rendered on the server', () => {
  it('do not decide the sortie is missing', () => {
    expect(() => renderToString(<SortiePage params={params({ id: 'abc' })} />)).not.toThrow()
    expect(() => renderToString(<SortieStepPage params={params({ id: 'abc', stepId: 'setup-1' })} />)).not.toThrow()
  })

  it('do not decide the pilot is gone', () => {
    expect(renderToString(<PilotDetailPage params={params({ id: 'abc' })} />)).not.toContain('no longer in your force')
  })

  it('still 404 a step that does not exist', () => {
    expect(() => renderToString(<SortieStepPage params={params({ id: 'abc', stepId: 'no-such-step' })} />)).toThrow()
  })
})
