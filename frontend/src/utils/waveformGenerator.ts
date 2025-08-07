/**
 * Waveform generation utilities with physics-based haptic actuator model
 *
 * Based on electromechanical model of Linear Resonant Actuators (LRAs):
 * - Electrical: V(t) = R·I(t) + L·dI/dt + k_e·v(t)
 * - Mechanical: F = k_m·I, with mass-spring-damper dynamics
 * - 60Hz base frequency with 6th harmonic at 360Hz (resonance)
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
const RESONANT_FREQUENCY = 360 // Hz (6x base frequency for strong resonance)
const DAMPING_RATIO = 0.35 // ζ (zeta) - moderate damping for controlled resonance
const NOISE_LEVEL = 0.008 // 0.8% sensor noise
// Electrical parameters
const COIL_RESISTANCE = 8.0 // Ω - typical voice coil resistance
const COIL_INDUCTANCE = 0.003 // H (3mH) - increased for more filtering effect
// Mechanical parameters
const MOTOR_CONSTANT = 0.3 // N/A (k_m) - increased for stronger back-EMF effect
const BACK_EMF_CONSTANT = 0.3 // V·s/m (k_e) - typically equals k_m
const MOVING_MASS = 0.004 // kg (4g) - moderate mass for balanced response
// Calculate spring constant from resonance: k = (2πf)²m
const SPRING_CONSTANT = Math.pow(2 * Math.PI * RESONANT_FREQUENCY, 2) * MOVING_MASS
// Calculate damping coefficient from damping ratio
const DAMPING_COEFFICIENT = 2 * DAMPING_RATIO * Math.sqrt(SPRING_CONSTANT * MOVING_MASS)
// Scaling factors for visualization
const ACCELERATION_SCALE = 0.2 // Adjusted for proper visualization scale

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
  const { frequency, amplitude, phase, polarity, duration, sampleRate, startTime = 0 } = params

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
 * 2nd order resonator filter using bilinear transform (Tustin method).
 * Implements transfer function: G(s) = ωn²/(s² + 2ζωn*s + ωn²)
 * 
 * This creates a strong resonance effect at the natural frequency,
 * similar to the backend implementation.
 */
function resonator(u: number[], fs: number, f_n: number = RESONANT_FREQUENCY, zeta: number = 0.08): number[] {
  // Convert to angular frequency
  const w_n = 2 * Math.PI * f_n
  const dt = 1 / fs
  
  // Bilinear transform coefficients
  const a0 = 4 + 4 * zeta * w_n * dt + Math.pow(w_n * dt, 2)
  const b0 = Math.pow(w_n * dt, 2)
  const b1 = 2 * b0
  const b2 = b0
  const a1 = 2 * (Math.pow(w_n * dt, 2) - 4)
  const a2 = 4 - 4 * zeta * w_n * dt + Math.pow(w_n * dt, 2)
  
  // Initialize output array
  const y = new Array(u.length).fill(0)
  
  // Apply IIR filter (Direct Form II)
  for (let n = 2; n < u.length; n++) {
    y[n] = (b0 * u[n] + b1 * u[n - 1] + b2 * u[n - 2] - a1 * y[n - 1] - a2 * y[n - 2]) / a0
  }
  
  return y
}

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
function solveElectromechanicalSystem(
  voltage: number[],
  sampleRate: number
): {
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
    const force = MOTOR_CONSTANT * current[i - 1]

    // Mechanical equation: F = m*a + c*v + k*x
    // Solve for acceleration: a = (F - c*v - k*x) / m
    acceleration[i] =
      (force - DAMPING_COEFFICIENT * velocity[i - 1] - SPRING_CONSTANT * position[i - 1]) /
      MOVING_MASS

    // Update velocity and position
    velocity[i] = velocity[i - 1] + acceleration[i] * dt
    position[i] = position[i - 1] + velocity[i] * dt

    // Electrical equation with back-EMF: V = R*I + L*dI/dt + k_e*v
    // Solve for dI/dt: dI/dt = (V - R*I - k_e*v) / L
    const backEmf = BACK_EMF_CONSTANT * velocity[i]
    const dIdt = (voltage[i] - COIL_RESISTANCE * current[i - 1] - backEmf) / COIL_INDUCTANCE
    current[i] = current[i - 1] + dIdt * dt
  }

  return { current, position, velocity, acceleration }
}

/**
 * Generate voltage, current, and acceleration waveforms
 * Based on the physical model where:
 * - Voltage drives current (V = R*I for simple case)
 * - Current drives force (F = k_m * I)
 * - Force through resonator gives acceleration
 */
export function generatePhysicalWaveforms(params: GenerateSawtoothParams): {
  voltage: number[]
  current: number[]
  acceleration: number[]
} {
  // Generate voltage (sawtooth wave)
  const voltage = generateSawtoothWave(params)

  // Ohm's law: Current = Voltage / R
  const current = voltage.map(v => v / COIL_RESISTANCE)

  // Force is proportional to current (F = k_m * I)
  // Then apply resonator to get acceleration (mass-spring-damper system)
  const force = voltage // Since we're using normalized values
  const accelerationRaw = resonator(force, params.sampleRate)
  
  // Scale and add noise to acceleration
  const accelerationScaled = accelerationRaw.map(a => a * ACCELERATION_SCALE)
  const acceleration = addNoise(accelerationScaled)

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
        startTime,
      })
      voltage = waveforms.voltage
      current = waveforms.current
      acceleration = waveforms.acceleration
    }

    return {
      channelId: channel.channelId,
      data: voltage, // Backward compatibility
      current,
      acceleration,
    }
  })

  return {
    timestamp,
    sampleRate,
    channels: channelData,
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
    isActive: channel.isActive,
  }
}
