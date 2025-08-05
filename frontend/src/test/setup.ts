import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Mock Chart.js before any components import it
const chartMock = {
  data: {},
  options: {},
  update: vi.fn(),
  destroy: vi.fn(),
  resize: vi.fn(),
  clear: vi.fn(),
  render: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  getElementsAtEventForMode: vi.fn().mockReturnValue([]),
  getSortedVisibleDatasetMetas: vi.fn().mockReturnValue([]),
  getDatasetMeta: vi.fn().mockReturnValue({
    data: [],
    dataset: {},
    hidden: false,
    visible: true,
  }),
}

const Chart = vi.fn().mockImplementation(() => chartMock)
Chart.register = vi.fn()

vi.mock('chart.js', () => ({
  Chart,
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
  register: vi.fn(),
  default: Chart,
}))

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Line: vi.fn(() => null),
  Bar: vi.fn(() => null),
  getElementAtEvent: vi.fn().mockReturnValue([]),
  getElementsAtEvent: vi.fn().mockReturnValue([]),
  getDatasetAtEvent: vi.fn().mockReturnValue([]),
}))

// Mock chartjs-plugin-streaming
vi.mock('chartjs-plugin-streaming', () => ({
  StreamingPlugin: {},
  RealTimeScale: {},
}))
// Global test setup
beforeEach(() => {
  // Clear all timers between tests
  vi.clearAllTimers()

  // Reset all mocks
  vi.clearAllMocks()
})

// Setup fetch mock
globalThis.fetch = vi.fn()

// Mock WebSocket
globalThis.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
  readyState: WebSocket.CONNECTING,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
})) as any

// Mock matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Suppress console.warn for tests (can be overridden in specific tests)
const originalWarn = console.warn
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('React does not recognize')) {
    return
  }
  originalWarn.call(console, ...args)
}
