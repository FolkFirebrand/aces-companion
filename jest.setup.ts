import '@testing-library/jest-dom'

// Mock localStorage for Zustand persist
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
// Server-render tests run in Node, where there is no window (and no storage, as on the real server).
if (typeof window !== 'undefined') Object.defineProperty(window, 'localStorage', { value: localStorageMock })
