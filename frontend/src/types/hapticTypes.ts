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
    data: number[]  // Voltage data (backward compatibility)
    current?: number[]  // Current data
    acceleration?: number[]  // Acceleration data
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
  connection: {
    isConnected: boolean
    error: string | null
  }
}

// Channel ID constants
export const CHANNEL_IDS = {
  DEVICE1_X: 0,
  DEVICE1_Y: 1,
  DEVICE2_X: 2,
  DEVICE2_Y: 3,
} as const

// Parameter constraints
export const CONSTRAINTS = {
  FREQUENCY: { MIN: 0, MAX: 120 },
  AMPLITUDE: { MIN: 0, MAX: 1 },
  PHASE: { MIN: 0, MAX: 360 },
  VECTOR_FREQUENCY: { MIN: 40, MAX: 120 },
} as const
