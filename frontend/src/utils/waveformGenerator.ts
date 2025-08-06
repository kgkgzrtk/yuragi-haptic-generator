/**
 * Waveform generation utilities with physics-based haptic actuator model
 * 
 * Based on electromechanical model of Linear Resonant Actuators (LRAs):
 * - Electrical: V(t) = R·I(t) + L·dI/dt + k_e·v(t)
 * - Mechanical: F = k_m·I, with mass-spring-damper dynamics
 * - 30Hz sawtooth input contains 6th harmonic at 180Hz (resonance)
 * 
 * References: IEEE papers on voice coil actuator modeling
 */

export interface WaveformParameters {
  channelId: number
  frequency: number
  amplitude: number
  phase: number // in degrees
  polarity: boolean // true = rising, false = falling
  isActive: boolean
}

// Physical model parameters based on typical LRA characteristics
const RESONANT_FREQUENCY = 180 // Hz (typical LRA resonance)
const DAMPING_RATIO = 0.35   // ζ (zeta) - moderate damping for controlled resonance
const NOISE_LEVEL = 0.008    // 0.8% sensor noise
// Electrical parameters
const COIL_RESISTANCE = 8.0  // Ω - typical voice coil resistance
const COIL_INDUCTANCE = 0.003 // H (3mH) - increased for more filtering effect
// Mechanical parameters  
const MOTOR_CONSTANT = 0.3   // N/A (k_m) - increased for stronger back-EMF effect
const BACK_EMF_CONSTANT = 0.3 // V·s/m (k_e) - typically equals k_m
const MOVING_MASS = 0.004    // kg (4g) - moderate mass for balanced response
// Calculate spring constant from resonance: k = (2πf)²m
const SPRING_CONSTANT = Math.pow(2 * Math.PI * RESONANT_FREQUENCY, 2) * MOVING_MASS
// Calculate damping coefficient from damping ratio
const DAMPING_COEFFICIENT = 2 * DAMPING_RATIO * Math.sqrt(SPRING_CONSTANT * MOVING_MASS)
// Scaling factors for visualization
const CURRENT_SCALE = 1.5   // Further reduced to emphasize current is smaller than voltage
const ACCELERATION_SCALE = 0.05  // Reduced to keep acceleration well within [-1, 1]

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

// Former resonator function - now integrated into solveElectromechanicalSystem
// The mechanical dynamics (mass-spring-damper) are now solved as part of the
// coupled electromechanical system, which provides more accurate modeling
// of the interaction between electrical and mechanical subsystems.

/**
 * Add noise to signal
 */
function addNoise(signal: number[], noiseLevel: number = NOISE_LEVEL): number[] {
  return signal.map(value => value + noiseLevel * (Math.random() - 0.5) * 2)
}

/**
 * Solve coupled electromechanical system
 * Electrical: V(t) = R*I(t) + L*dI/dt + k_e*v(t)
 * Mechanical: F = k_m*I = m*a + c*v + k*x
 * 
 * This creates a coupled system where:
 * - Current depends on velocity (back-EMF)
 * - Force (and thus acceleration) depends on current
 * - Velocity is integral of acceleration
 */
function solveElectromechanicalSystem(voltage: number[], sampleRate: number): {
  current: number[]
  position: number[]
  velocity: number[]
  acceleration: number[]
} {
  const dt = 1 / sampleRate
  const n = voltage.length
  
  // State variables
  const current = new Array(n).fill(0)
  const position = new Array(n).fill(0)
  const velocity = new Array(n).fill(0)
  const acceleration = new Array(n).fill(0)
  
  // Solve coupled system using Euler method
  for (let i = 1; i < n; i++) {
    // Calculate force from current
    const force = MOTOR_CONSTANT * current[i-1]
    
    // Mechanical equation: F = m*a + c*v + k*x
    // Solve for acceleration: a = (F - c*v - k*x) / m
    acceleration[i] = (force - DAMPING_COEFFICIENT * velocity[i-1] - SPRING_CONSTANT * position[i-1]) / MOVING_MASS
    
    // Update velocity and position
    velocity[i] = velocity[i-1] + acceleration[i] * dt
    position[i] = position[i-1] + velocity[i] * dt
    
    // Electrical equation with back-EMF: V = R*I + L*dI/dt + k_e*v
    // Solve for dI/dt: dI/dt = (V - R*I - k_e*v) / L
    const backEmf = BACK_EMF_CONSTANT * velocity[i]
    const dIdt = (voltage[i] - COIL_RESISTANCE * current[i-1] - backEmf) / COIL_INDUCTANCE
    current[i] = current[i-1] + dIdt * dt
  }
  
  return { current, position, velocity, acceleration }
}

/**
 * Generate voltage, current, and acceleration waveforms
 */
export function generatePhysicalWaveforms(params: GenerateSawtoothParams): {
  voltage: number[]
  current: number[]
  acceleration: number[]
} {
  // Generate voltage (sawtooth wave)
  const voltage = generateSawtoothWave(params)
  
  // Solve the coupled electromechanical system
  const system = solveElectromechanicalSystem(voltage, params.sampleRate)
  
  // Scale current for visibility
  const current = system.current.map(i => i * CURRENT_SCALE)
  
  // Apply scaling to acceleration
  const accelScaled = system.acceleration.map(a => a * ACCELERATION_SCALE)
  const acceleration = addNoise(accelScaled)
  
  return { voltage, current, acceleration }
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
    current: number[]
    acceleration: number[]
  }>
} {
  const timestamp = new Date().toISOString()

  const channelData = channels.map(channel => {
    let voltage: number[]
    let current: number[]
    let acceleration: number[]

    if (!channel.isActive || channel.amplitude === 0) {
      // Inactive channels get zero data
      const numSamples = Math.floor(duration * sampleRate)
      voltage = new Array(numSamples).fill(0)
      current = new Array(numSamples).fill(0)
      acceleration = new Array(numSamples).fill(0)
    } else {
      // Generate physical waveforms for active channels
      const waveforms = generatePhysicalWaveforms({
        frequency: channel.frequency,
        amplitude: channel.amplitude,
        phase: channel.phase,
        polarity: channel.polarity,
        duration,
        sampleRate,
        startTime
      })
      voltage = waveforms.voltage
      current = waveforms.current
      acceleration = waveforms.acceleration
    }

    return {
      channelId: channel.channelId,
      data: voltage, // Backward compatibility
      current,
      acceleration
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
