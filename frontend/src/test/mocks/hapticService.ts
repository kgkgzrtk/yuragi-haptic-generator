import type {
  IParametersResponse,
  IStatusResponse,
  IChannelParameters,
  IVectorForce,
  IWaveformData,
} from '@/types/hapticTypes'
import { CHANNEL_IDS } from '@/types/hapticTypes'

// Mock responses
export const mockParametersResponse: IParametersResponse = {
  channels: [
    { channelId: CHANNEL_IDS.DEVICE1_X, frequency: 60, amplitude: 0.5, phase: 0, polarity: true },
    { channelId: CHANNEL_IDS.DEVICE1_Y, frequency: 60, amplitude: 0.5, phase: 90, polarity: true },
    { channelId: CHANNEL_IDS.DEVICE2_X, frequency: 80, amplitude: 0.7, phase: 0, polarity: false },
    {
      channelId: CHANNEL_IDS.DEVICE2_Y,
      frequency: 80,
      amplitude: 0.7,
      phase: 180,
      polarity: false,
    },
  ],
}

export const mockStatusResponse: IStatusResponse = {
  sampleRate: 44100,
  blockSize: 512,
}

export const mockWaveformData: IWaveformData = {
  timestamp: new Date().toISOString(),
  sampleRate: 44100,
  channels: [
    {
      channelId: CHANNEL_IDS.DEVICE1_X,
      data: Array.from({ length: 512 }, (_, i) => Math.sin((2 * Math.PI * 60 * i) / 44100)),
    },
    {
      channelId: CHANNEL_IDS.DEVICE1_Y,
      data: Array.from({ length: 512 }, (_, i) => Math.cos((2 * Math.PI * 60 * i) / 44100)),
    },
    {
      channelId: CHANNEL_IDS.DEVICE2_X,
      data: Array.from({ length: 512 }, (_, i) => Math.sin((2 * Math.PI * 80 * i) / 44100) * 0.7),
    },
    {
      channelId: CHANNEL_IDS.DEVICE2_Y,
      data: Array.from({ length: 512 }, (_, i) => Math.cos((2 * Math.PI * 80 * i) / 44100) * 0.7),
    },
  ],
}

export const mockVectorForce: IVectorForce = {
  deviceId: 1,
  angle: 45,
  magnitude: 0.8,
  frequency: 100,
}

// Mock haptic service implementation
export const mockHapticService = {
  // Health check
  checkHealth: vi.fn().mockResolvedValue({ status: 'ok', timestamp: new Date().toISOString() }),

  // Parameters
  getParameters: vi.fn().mockResolvedValue(mockParametersResponse),
  updateParameters: vi.fn().mockResolvedValue(mockParametersResponse),
  updateChannelParameters: vi
    .fn()
    .mockImplementation((channelId: number, params: Partial<IChannelParameters>) => {
      const updatedChannels = mockParametersResponse.channels.map(ch =>
        ch.channelId === channelId ? { ...ch, ...params } : ch
      )
      return Promise.resolve({ channels: updatedChannels })
    }),

  // Streaming
  getStatus: vi.fn().mockResolvedValue(mockStatusResponse),
  startStreaming: vi.fn().mockResolvedValue({ message: 'Streaming started' }),
  stopStreaming: vi.fn().mockResolvedValue({ message: 'Streaming stopped' }),

  // Waveform data
  getWaveformData: vi.fn().mockResolvedValue(mockWaveformData),

  // Vector force
  getVectorForce: vi.fn().mockResolvedValue(mockVectorForce),
  setVectorForce: vi.fn().mockImplementation((deviceId: number, force: IVectorForce) => {
    return Promise.resolve({ ...force, deviceId })
  }),
  clearVectorForce: vi.fn().mockResolvedValue({ message: 'Vector force cleared' }),
}

// Mock API responses with different scenarios
export const mockApiResponses = {
  success: (data: any) => ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  }),

  error: (status: number = 500, message: string = 'Internal Server Error') => ({
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ error: message }),
    text: vi.fn().mockResolvedValue(JSON.stringify({ error: message })),
  }),

  networkError: () => {
    throw new Error('Network Error')
  },

  timeout: () => new Promise(() => {}), // Never resolves
}

// Utilities for setting up different mock scenarios
export const setupMockScenarios = {
  // Successful API calls
  success: () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockApiResponses.success(mockParametersResponse))
      .mockResolvedValueOnce(mockApiResponses.success(mockStatusResponse))
      .mockResolvedValueOnce(mockApiResponses.success(mockWaveformData))
  },

  // Network errors
  networkError: () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'))
  },

  // Server errors
  serverError: () => {
    global.fetch = vi.fn().mockResolvedValue(mockApiResponses.error(500, 'Server Error'))
  },

  // Mixed responses (some success, some fail)
  mixed: () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockApiResponses.success(mockParametersResponse))
      .mockResolvedValueOnce(mockApiResponses.error(500, 'Server Error'))
      .mockResolvedValueOnce(mockApiResponses.success(mockWaveformData))
  },

  // Slow responses
  slow: () => {
    global.fetch = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve(mockApiResponses.success(mockParametersResponse)), 2000)
          )
      )
  },
}

export default mockHapticService
