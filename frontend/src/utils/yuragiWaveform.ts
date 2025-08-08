/**
 * YURAGI waveform generation utilities
 *
 * Implements massage-pattern waveforms with circular motion, amplitude modulation,
 * and pink noise based on the backend modulation.py algorithms.
 *
 * Components:
 * - CircularMotion: Circular coordinates with fluctuations
 * - AmplitudeModulation: Massage-like amplitude variations
 * - PinkNoise: 1/f noise generation
 * - PresetParameters: Therapeutic massage presets
 */

export interface YuragiParameters {
  // Circular motion parameters
  rotationFreq: number // Hz (rotation frequency)
  radius: number // Base radius
  phase: number // Initial phase in degrees

  // Amplitude modulation parameters
  baseAmplitude: number // Base amplitude level
  envelopeFreq: number // Envelope modulation frequency in Hz
  envelopeDepth: number // Depth of envelope modulation (0-1)

  // Noise parameters
  noiseLevel: number // Level of amplitude noise
  noiseBandwidth: number // Bandwidth for noise generation

  // Fluctuation parameters
  fluctuationAmplitude: number // Angular fluctuation amplitude in degrees
  fluctuationBandwidth: number // Bandwidth for 1/f noise generation in Hz
  fmDepth: number // FM modulation depth for angular velocity

  // Generation parameters
  duration: number // Duration in seconds
  sampleRate: number // Sample rate in Hz
  seed?: number // Random seed for reproducible noise
}

export interface CircularMotionResult {
  x: number[] // X coordinates
  y: number[] // Y coordinates
  theta: number[] // Angle array
  omega: number[] // Instantaneous angular velocity
}

export interface PresetParameters {
  gentle: YuragiParameters
  moderate: YuragiParameters
  intense: YuragiParameters
  therapeutic: YuragiParameters
  therapeutic_fluctuation: YuragiParameters
}

/**
 * Simple seeded random number generator
 * Using Linear Congruential Generator for consistent cross-platform results
 */
class SeededRNG {
  private seed: number
  private hasSpare: boolean = false
  private spare: number = 0

  constructor(seed: number) {
    this.seed = seed % 2147483647
    if (this.seed <= 0) {
      this.seed += 2147483646
    }
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  randn(): number {
    // Box-Muller transform for normal distribution
    if (this.hasSpare) {
      this.hasSpare = false
      return this.spare
    }

    this.hasSpare = true
    const u = this.next()
    const v = this.next()
    const mag = Math.sqrt(-2.0 * Math.log(u))
    this.spare = mag * Math.cos(2.0 * Math.PI * v)
    return mag * Math.sin(2.0 * Math.PI * v)
  }
}

/**
 * Generate pink noise with 1/f^alpha spectral characteristics
 * Based on backend NoiseGenerator.pink_noise() implementation
 */
export function generatePinkNoise(
  nSamples: number,
  alpha: number = 1.0,
  intensity: number = 1.0,
  seed?: number
): number[] {
  // Handle edge cases
  if (nSamples === 0) {
    return []
  }
  if (nSamples < 0) {
    throw new Error('Number of samples must be non-negative')
  }

  // Validate alpha range
  if (alpha < -2.0 || alpha > 5.0) {
    throw new Error(`Alpha value ${alpha} is outside reasonable range [-2.0, 5.0]`)
  }

  // Initialize RNG
  const rng = seed !== undefined ? new SeededRNG(seed) : new SeededRNG(Date.now())

  // Generate white noise
  const whiteNoise = new Array(nSamples)
  for (let i = 0; i < nSamples; i++) {
    whiteNoise[i] = rng.randn()
  }

  // Handle trivial case of white noise (alpha = 0)
  if (Math.abs(alpha) < 1e-10) {
    const mean = whiteNoise.reduce((a, b) => a + b, 0) / nSamples
    const centered = whiteNoise.map(x => x - mean)
    const std = Math.sqrt(centered.reduce((sum, x) => sum + x * x, 0) / (nSamples - 1))
    if (std > 0) {
      return centered.map(x => (x / std) * intensity)
    }
    return centered.map(x => x * intensity)
  }

  // For very small sample sizes, use direct filtering
  if (nSamples <= 4) {
    const mean = whiteNoise.reduce((a, b) => a + b, 0) / nSamples
    const centered = whiteNoise.map(x => x - mean)
    const std =
      nSamples > 1 ? Math.sqrt(centered.reduce((sum, x) => sum + x * x, 0) / (nSamples - 1)) : 1.0
    if (std > 0) {
      return centered.map(x => (x / std) * intensity)
    }
    return centered.map(x => x * intensity)
  }

  // FFT-based filtering using Web API or fallback
  const fftWhite = fft(whiteNoise)

  // Create 1/f^alpha filter
  const filterMagnitude = new Array(nSamples).fill(1.0)
  const fMin = 1.0 / nSamples // Minimum non-zero frequency

  for (let k = 0; k < nSamples; k++) {
    if (k === 0) {
      // DC component - keep as is
      filterMagnitude[k] = 1.0
    } else if (k <= nSamples / 2) {
      // Positive frequencies
      const normFreq = Math.max(k / nSamples, fMin)
      filterMagnitude[k] = Math.pow(normFreq, -alpha / 2.0)
    } else {
      // Negative frequencies: mirror the positive frequencies
      const mirrorK = nSamples - k
      const normFreq = Math.max(mirrorK / nSamples, fMin)
      filterMagnitude[k] = Math.pow(normFreq, -alpha / 2.0)
    }
  }

  // Limit maximum gain to prevent overflow
  const maxGain = 1000.0
  for (let i = 0; i < filterMagnitude.length; i++) {
    filterMagnitude[i] = Math.min(filterMagnitude[i], maxGain)
  }

  // Apply filter
  const fftFiltered = fftWhite.map((val, i) => val * filterMagnitude[i])

  // Convert back to time domain
  const pinkNoise = ifft(fftFiltered)

  // Normalize to zero mean and unit variance
  const mean = pinkNoise.reduce((a, b) => a + b, 0) / nSamples
  const centered = pinkNoise.map(x => x - mean)
  const std =
    nSamples > 1 ? Math.sqrt(centered.reduce((sum, x) => sum + x * x, 0) / (nSamples - 1)) : 1.0

  if (std > 1e-15) {
    return centered.map(x => (x / std) * intensity)
  }

  return centered.map(x => x * intensity)
}

/**
 * Simple FFT implementation for pink noise generation
 * Simplified version for real-valued input
 */
function fft(signal: number[]): number[] {
  const n = signal.length
  if (n <= 1) {
    return signal
  }

  // Simple DFT for small sizes or fallback
  const result = new Array(n).fill(0)

  for (let k = 0; k < n; k++) {
    let realSum = 0
    let imagSum = 0

    for (let j = 0; j < n; j++) {
      const angle = (-2 * Math.PI * k * j) / n
      realSum += signal[j] * Math.cos(angle)
      imagSum += signal[j] * Math.sin(angle)
    }

    // Store magnitude for filtering
    result[k] = Math.sqrt(realSum * realSum + imagSum * imagSum)
  }

  return result
}

/**
 * Simple IFFT implementation
 */
function ifft(spectrum: number[]): number[] {
  const n = spectrum.length
  if (n <= 1) {
    return spectrum
  }

  // Simple inverse DFT
  const result = new Array(n).fill(0)

  for (let j = 0; j < n; j++) {
    let sum = 0

    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k * j) / n
      sum += (spectrum[k] * Math.cos(angle)) / n
    }

    result[j] = sum
  }

  return result
}

/**
 * Generate 1/f noise for modulation (simplified version of backend _generate_1f_noise)
 */
function generate1fNoise(n: number, seed?: number): number[] {
  if (n === 0) {
    return []
  }

  const rng = seed !== undefined ? new SeededRNG(seed) : new SeededRNG(Date.now())

  // Generate white noise
  const white = new Array(n)
  for (let i = 0; i < n; i++) {
    white[i] = rng.randn()
  }

  // Apply simple 1/f filtering with scaling factor
  const scaleFactor = 0.3
  const filtered = generatePinkNoise(n, 1.0, scaleFactor, seed)

  // Normalize to zero mean and bounded variance
  const mean = filtered.reduce((a, b) => a + b, 0) / n
  const centered = filtered.map(x => x - mean)
  const std = Math.sqrt(centered.reduce((sum, x) => sum + x * x, 0) / n)

  if (std > 0) {
    return centered.map(x => x / (std * 3.1))
  }

  return centered
}

/**
 * Generate circular motion coordinates with fluctuations
 * Based on backend CircularMotionGenerator.modulate()
 */
export function generateCircularMotion(
  radius: number,
  rotationFreq: number,
  phase: number,
  fluctuationAmplitude: number = 10.0,
  fmDepth: number = 0.05,
  duration: number,
  sampleRate: number,
  seed?: number
): CircularMotionResult {
  const numSamples = Math.floor(duration * sampleRate)
  const t = new Array(numSamples)

  // Generate time array
  for (let i = 0; i < numSamples; i++) {
    t[i] = i / sampleRate
  }

  if (numSamples === 0) {
    return { x: [], y: [], theta: [], omega: [] }
  }

  // Base rotation
  const baseTheta = t.map(time => 2 * Math.PI * rotationFreq * time + (phase * Math.PI) / 180)

  // Generate 1/f noise for directional fluctuations
  const nTheta = generate1fNoise(numSamples, seed)
  const deltaTheta = (fluctuationAmplitude * Math.PI) / 180 // Convert to radians
  const dTheta = nTheta.map(n => deltaTheta * n)

  // Generate FM modulation for angular velocity variation
  const fmNoise = generate1fNoise(numSamples, seed ? seed + 1 : undefined)
  const omegaInst = fmNoise.map(n => 2 * Math.PI * rotationFreq * (1 + fmDepth * n))

  // Combine base rotation with fluctuations
  const theta = baseTheta.map((base, i) => base + dTheta[i])

  // Calculate Cartesian coordinates
  const x = theta.map(angle => radius * Math.cos(angle))
  const y = theta.map(angle => radius * Math.sin(angle))

  return { x, y, theta, omega: omegaInst }
}

/**
 * Generate amplitude modulation with envelope and noise
 * Based on backend AmplitudeModulator.modulate()
 */
export function generateAmplitudeModulation(
  baseAmplitude: number,
  envelopeFreq: number = 0.4,
  envelopeDepth: number = 0.25,
  noiseLevel: number = 0.1,
  duration: number,
  sampleRate: number,
  seed?: number
): number[] {
  const numSamples = Math.floor(duration * sampleRate)
  const t = new Array(numSamples)

  // Generate time array
  for (let i = 0; i < numSamples; i++) {
    t[i] = i / sampleRate
  }

  if (numSamples === 0) {
    return []
  }

  // Periodic envelope modulation
  const envelope = t.map(
    time => envelopeDepth * 0.7 * Math.sin(2 * Math.PI * envelopeFreq * time + 2 * Math.PI * 0.13)
  )

  // Generate amplitude noise using 1/f characteristics
  const nA = generate1fNoise(numSamples, seed)
  const noise = nA.map(n => noiseLevel * n)

  // Combine base amplitude, envelope, and noise
  const A = envelope.map((env, i) => baseAmplitude * (1.0 + env + noise[i]))

  // Apply clipping to prevent over-modulation
  return A.map(amp => Math.max(0.2 * baseAmplitude, Math.min(amp, 1.5 * baseAmplitude)))
}

/**
 * Get preset parameters for different massage types
 * Based on backend YURAGI preset configurations
 */
export function getPresetParameters(): PresetParameters {
  const defaultParams = {
    duration: 1.0,
    sampleRate: 44100,
  }

  return {
    gentle: {
      ...defaultParams,
      rotationFreq: 0.2, // 5 seconds per rotation
      radius: 0.4,
      phase: 45.0,
      baseAmplitude: 0.4,
      envelopeFreq: 0.3,
      envelopeDepth: 0.2,
      noiseLevel: 0.05,
      noiseBandwidth: 0.5,
      fluctuationAmplitude: 5.0,
      fluctuationBandwidth: 0.3,
      fmDepth: 0.03,
    },

    moderate: {
      ...defaultParams,
      rotationFreq: 0.33, // ~3 seconds per rotation
      radius: 0.7,
      phase: 0.0,
      baseAmplitude: 0.7,
      envelopeFreq: 0.4,
      envelopeDepth: 0.25,
      noiseLevel: 0.1,
      noiseBandwidth: 0.7,
      fluctuationAmplitude: 10.0,
      fluctuationBandwidth: 0.5,
      fmDepth: 0.05,
    },

    intense: {
      ...defaultParams,
      rotationFreq: 0.5, // 2 seconds per rotation
      radius: 1.0,
      phase: 90.0,
      baseAmplitude: 1.0,
      envelopeFreq: 0.6,
      envelopeDepth: 0.3,
      noiseLevel: 0.15,
      noiseBandwidth: 1.0,
      fluctuationAmplitude: 15.0,
      fluctuationBandwidth: 0.8,
      fmDepth: 0.08,
    },

    therapeutic: {
      ...defaultParams,
      rotationFreq: 0.15, // ~6.7 seconds per rotation
      radius: 0.8,
      phase: 180.0,
      baseAmplitude: 0.8,
      envelopeFreq: 0.2,
      envelopeDepth: 0.3,
      noiseLevel: 0.08,
      noiseBandwidth: 0.4,
      fluctuationAmplitude: 8.0,
      fluctuationBandwidth: 0.3,
      fmDepth: 0.04,
    },

    therapeutic_fluctuation: {
      ...defaultParams,
      rotationFreq: 0.15, // ~6.7 seconds per rotation - slower rotation
      radius: 0.8,
      phase: 180.0,
      baseAmplitude: 0.8,
      envelopeFreq: 0.2,
      envelopeDepth: 0.3,
      noiseLevel: 0.08,
      noiseBandwidth: 0.4,
      fluctuationAmplitude: 20.0, // 2.5x stronger fluctuation
      fluctuationBandwidth: 0.1,  // Lower frequency bandwidth
      fmDepth: 0.1,               // Stronger FM modulation
    },
  }
}

/**
 * Main YURAGI waveform generation function
 * Combines circular motion, amplitude modulation, and noise
 */
export function generateYuragiWaveform(params: YuragiParameters): {
  x: number[]
  y: number[]
  amplitude: number[]
  theta: number[]
  omega: number[]
} {
  // Generate circular motion coordinates
  const motion = generateCircularMotion(
    params.radius,
    params.rotationFreq,
    params.phase,
    params.fluctuationAmplitude,
    params.fmDepth,
    params.duration,
    params.sampleRate,
    params.seed
  )

  // Generate amplitude modulation
  const amplitude = generateAmplitudeModulation(
    params.baseAmplitude,
    params.envelopeFreq,
    params.envelopeDepth,
    params.noiseLevel,
    params.duration,
    params.sampleRate,
    params.seed
  )

  // Apply amplitude modulation to coordinates
  const modulatedX = motion.x.map((x, i) => x * amplitude[i])
  const modulatedY = motion.y.map((y, i) => y * amplitude[i])

  return {
    x: modulatedX,
    y: modulatedY,
    amplitude,
    theta: motion.theta,
    omega: motion.omega,
  }
}
