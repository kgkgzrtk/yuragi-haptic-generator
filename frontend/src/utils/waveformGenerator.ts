/**
 * Waveform generation utilities for frontend visualization
 * Implements the same sawtooth wave generation logic as the backend
 */

export interface WaveformParameters {
  channelId: number
  frequency: number
  amplitude: number
  phase: number // in degrees
  polarity: boolean // true = rising, false = falling
  isActive: boolean
}

interface GenerateSawtoothParams {
  frequency: number
  amplitude: number
  phase: number
  polarity: boolean
  duration: number
  sampleRate: number
  startTime?: number // For phase continuity
}

/**
 * Generate a sawtooth waveform
 * Implements the same algorithm as backend channel.py
 */
export function generateSawtoothWave(params: GenerateSawtoothParams): number[] {
  const {
    frequency,
    amplitude,
    phase,
    polarity,
    duration,
    sampleRate,
    startTime = 0
  } = params

  const numSamples = Math.floor(duration * sampleRate)
  const waveform = new Array(numSamples)

  // Handle zero amplitude case
  if (amplitude === 0) {
    return new Array(numSamples).fill(0)
  }

  // Use absolute value of amplitude
  const absAmplitude = Math.abs(amplitude)

  // Generate time array starting from startTime (for phase continuity)
  for (let i = 0; i < numSamples; i++) {
    const t = startTime + i / sampleRate
    
    // Sawtooth wave formula: 2 * ((frequency * t + phase / 360) % 1) - 1
    // This generates a wave from -1 to 1
    const phaseInCycles = phase / 360.0
    const value = 2 * ((frequency * t + phaseInCycles) % 1.0) - 1
    
    // Apply amplitude and polarity
    waveform[i] = absAmplitude * (polarity ? value : -value)
  }

  return waveform
}

/**
 * Generate waveforms for multiple channels
 */
export function generateMultiChannelWaveform(
  channels: WaveformParameters[],
  duration: number,
  sampleRate: number,
  startTime: number = 0
): {
  timestamp: string
  sampleRate: number
  channels: Array<{
    channelId: number
    data: number[]
  }>
} {
  const timestamp = new Date().toISOString()
  
  const channelData = channels.map(channel => {
    let data: number[]
    
    if (!channel.isActive || channel.amplitude === 0) {
      // Inactive channels get zero data
      data = new Array(Math.floor(duration * sampleRate)).fill(0)
    } else {
      // Generate sawtooth wave for active channels
      data = generateSawtoothWave({
        frequency: channel.frequency,
        amplitude: channel.amplitude,
        phase: channel.phase,
        polarity: channel.polarity,
        duration,
        sampleRate,
        startTime
      })
    }
    
    return {
      channelId: channel.channelId,
      data
    }
  })
  
  return {
    timestamp,
    sampleRate,
    channels: channelData
  }
}

/**
 * Convert channel parameters from store format to waveform parameters
 */
export function channelToWaveformParams(channel: {
  channelId: number
  frequency: number
  gain: number
  phase: number
  polarity: boolean
  isActive: boolean
}): WaveformParameters {
  return {
    channelId: channel.channelId,
    frequency: channel.frequency,
    amplitude: channel.gain, // gain is used as amplitude
    phase: channel.phase,
    polarity: channel.polarity,
    isActive: channel.isActive
  }
}