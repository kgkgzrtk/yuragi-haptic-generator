/**
 * Haptic system type definitions
 */

// Channel parameters
export interface IChannelParameters {
  channelId: number
  frequency: number // 0-120 Hz
  amplitude: number // 0.0-1.0
  phase: number // 0-360 degrees
  polarity: boolean // true=ascending, false=descending
}

// Vector force parameters
export interface IVectorForce {
  deviceId: 1 | 2
  angle: number // 0-360 degrees
  magnitude: number // 0.0-1.0
  frequency: number // 40-120 Hz
}

// Waveform data point
export interface IWaveformData {
  timestamp: string
  sampleRate: number
  channels: Array<{
    channelId: number
    data: number[] // Voltage data (backward compatibility)
    current?: number[] // Current data
    acceleration?: number[] // Acceleration data
  }>
}

// API response types
export interface IParametersResponse {
  channels: IChannelParameters[]
}

export interface IStatusResponse {
  sampleRate: number
  blockSize: number
}

// UI state types
export interface IHapticSystemState {
  channels: IChannelParameters[]
  status: IStatusResponse | null
  vectorForce: {
    device1: IVectorForce | null
    device2: IVectorForce | null
  }
  yuragi: IYURAGIState
  connection: {
    isConnected: boolean
    error: string | null
  }
  waveformColors: IWaveformColors
}

// Channel ID constants
export const CHANNEL_IDS = {
  DEVICE1_X: 0,
  DEVICE1_Y: 1,
  DEVICE2_X: 2,
  DEVICE2_Y: 3,
} as const

// YURAGI massage control types
export interface IYURAGIRequest {
  deviceId: 1 | 2
  preset: 'gentle' | 'moderate' | 'intense' | 'therapeutic'
  duration: number // in seconds, 30-300
  enabled: boolean
}

export interface IYURAGIStatus {
  enabled: boolean
  preset: string
  deviceId: 1 | 2
  duration?: number
  startTime?: string
  progress?: number // 0-100
}

// YURAGI store state
export interface IYURAGIState {
  device1: IYURAGIStatus | null
  device2: IYURAGIStatus | null
  isActive: boolean
}

// Waveform color customization
export interface IWaveformColors {
  [CHANNEL_IDS.DEVICE1_X]: string
  [CHANNEL_IDS.DEVICE1_Y]: string
  [CHANNEL_IDS.DEVICE2_X]: string
  [CHANNEL_IDS.DEVICE2_Y]: string
  [channelId: number]: string // Allow number indexing
}

// Default waveform colors (modern green theme)
export const DEFAULT_WAVEFORM_COLORS: IWaveformColors = {
  [CHANNEL_IDS.DEVICE1_X]: '#13ae4b', // Primary green
  [CHANNEL_IDS.DEVICE1_Y]: '#0bdc84', // Bright accent green
  [CHANNEL_IDS.DEVICE2_X]: '#039555', // Success green
  [CHANNEL_IDS.DEVICE2_Y]: '#c4dc34', // Yellow-green
}

// Parameter constraints
export const CONSTRAINTS = {
  FREQUENCY: { MIN: 0, MAX: 120 },
  AMPLITUDE: { MIN: 0, MAX: 1 },
  PHASE: { MIN: 0, MAX: 360 },
  VECTOR_FREQUENCY: { MIN: 40, MAX: 120 },
  YURAGI_DURATION: { MIN: 30, MAX: 300 },
} as const
