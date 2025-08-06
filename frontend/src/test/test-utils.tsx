import React, { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions, renderHook as renderHookLib } from '@testing-library/react'
import { vi } from 'vitest'
import { useHapticStore } from '@/contexts/hapticStore'
import type { IHapticSystemState, IChannelParameters } from '@/types/hapticTypes'
import { CHANNEL_IDS } from '@/types/hapticTypes'

// Create test query client with disabled features for testing
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

// Mock initial state for tests
export const createMockHapticState = (
  overrides?: Partial<IHapticSystemState>
): IHapticSystemState => ({
  channels: [
    { channelId: CHANNEL_IDS.DEVICE1_X, frequency: 0, amplitude: 0, phase: 0, polarity: true },
    { channelId: CHANNEL_IDS.DEVICE1_Y, frequency: 0, amplitude: 0, phase: 0, polarity: true },
    { channelId: CHANNEL_IDS.DEVICE2_X, frequency: 0, amplitude: 0, phase: 0, polarity: true },
    { channelId: CHANNEL_IDS.DEVICE2_Y, frequency: 0, amplitude: 0, phase: 0, polarity: true },
  ],
  status: null,
  vectorForce: {
    device1: null,
    device2: null,
  },
  connection: {
    isConnected: false,
    error: null,
  },
  ...overrides,
})

// Test wrapper with all providers
interface AllTheProvidersProps {
  children: React.ReactNode
  queryClient?: QueryClient
  initialHapticState?: Partial<IHapticSystemState>
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({
  children,
  queryClient = createTestQueryClient(),
  initialHapticState = {},
}) => {
  // Initialize store with test state
  React.useEffect(() => {
    const store = useHapticStore.getState()
    const mockState = createMockHapticState(initialHapticState)

    // Reset store to mock state
    store.reset()
    store.setChannels(mockState.channels)
    store.setStatus(mockState.status)
    store.setConnection(mockState.connection.isConnected, mockState.connection.error)

    if (mockState.vectorForce.device1) {
      store.setVectorForce(1, mockState.vectorForce.device1)
    }
    if (mockState.vectorForce.device2) {
      store.setVectorForce(2, mockState.vectorForce.device2)
    }
  }, [initialHapticState])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Enhanced render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient
    initialHapticState?: Partial<IHapticSystemState>
  }
) => {
  const { queryClient, initialHapticState, ...renderOptions } = options || {}

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient} initialHapticState={initialHapticState}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Mock factory functions for common test data
export const createMockChannel = (
  channelId: number,
  overrides?: Partial<IChannelParameters>
): IChannelParameters => ({
  channelId,
  frequency: 60,
  amplitude: 0.5,
  phase: 0,
  polarity: true,
  ...overrides,
})

export const createMockChannels = (count: number = 4): IChannelParameters[] => {
  const channelIds = [
    CHANNEL_IDS.DEVICE1_X,
    CHANNEL_IDS.DEVICE1_Y,
    CHANNEL_IDS.DEVICE2_X,
    CHANNEL_IDS.DEVICE2_Y,
  ]

  return channelIds.slice(0, count).map(id => createMockChannel(id))
}

// Utility to wait for async operations
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

// Mock implementations for external dependencies
export const mockImplementations = {
  // Mock WebSocket for useWebSocket tests
  createMockWebSocket: () => {
    const mockWS = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    }

    // Mock the constructor
    globalThis.WebSocket = vi.fn(() => mockWS) as any

    return mockWS
  },

  // Mock fetch for API calls
  mockFetch: (response: any, options?: { ok?: boolean; status?: number }) => {
    const mockResponse = {
      ok: options?.ok ?? true,
      status: options?.status ?? 200,
      json: vi.fn().mockResolvedValue(response),
      text: vi.fn().mockResolvedValue(JSON.stringify(response)),
    }

    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)
    return mockResponse
  },

  // Mock Chart.js
  mockChartJS: () => {
    const mockChart = {
      data: {},
      update: vi.fn(),
      destroy: vi.fn(),
      resize: vi.fn(),
      clear: vi.fn(),
      render: vi.fn(),
      getElementsAtEventForMode: vi.fn().mockReturnValue([]),
      getSortedVisibleDatasetMetas: vi.fn().mockReturnValue([]),
      getDatasetMeta: vi.fn().mockReturnValue({}),
    }

    // Mock Chart constructor
    vi.mock('chart.js', () => ({
      Chart: vi.fn(() => mockChart),
      CategoryScale: {},
      LinearScale: {},
      PointElement: {},
      LineElement: {},
      Title: {},
      Tooltip: {},
      Legend: {},
      register: vi.fn(),
    }))

    return mockChart
  },
}

// Helper functions for testing user interactions
export const userInteractionHelpers = {
  // Helper to trigger input change with proper event structure
  createInputChangeEvent: (value: string | number) => ({
    target: { value: value.toString() },
  }),

  // Helper to trigger checkbox change
  createCheckboxChangeEvent: (checked: boolean) => ({
    target: { checked },
  }),

  // Helper to simulate async operations
  flushPromises: () => new Promise(resolve => setTimeout(resolve, 0)),
}

// Custom renderHook with providers
export const renderHook = <Result, Props>(
  hook: (props: Props) => Result,
  options?: {
    initialProps?: Props
    queryClient?: QueryClient
    initialHapticState?: Partial<IHapticSystemState>
  }
) => {
  const { queryClient, initialHapticState, ...renderOptions } = options || {}

  return renderHookLib(hook, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient} initialHapticState={initialHapticState}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Export everything needed for tests except renderHook (we provide our own)
export {
  screen,
  waitFor,
  act,
  fireEvent,
  cleanup,
  createEvent,
  getByRole,
  getByLabelText,
  getByText,
  getByDisplayValue,
  getByTitle,
  getByTestId,
  getAllByRole,
  getAllByLabelText,
  getAllByText,
  getAllByDisplayValue,
  getAllByTitle,
  getAllByTestId,
  queryByRole,
  queryByLabelText,
  queryByText,
  queryByDisplayValue,
  queryByTitle,
  queryByTestId,
  queryAllByRole,
  queryAllByLabelText,
  queryAllByText,
  queryAllByDisplayValue,
  queryAllByTitle,
  queryAllByTestId,
  findByRole,
  findByLabelText,
  findByText,
  findByDisplayValue,
  findByTitle,
  findByTestId,
  findAllByRole,
  findAllByLabelText,
  findAllByText,
  findAllByDisplayValue,
  findAllByTitle,
  findAllByTestId,
  within,
  prettyDOM,
} from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
export { customRender as render }
export { AllTheProviders }
