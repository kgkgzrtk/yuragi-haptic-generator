import { describe, it, expect } from 'vitest'
import {
  generateSawtoothWave,
  generateMultiChannelWaveform,
  type WaveformParameters
} from './waveformGenerator'

describe('waveformGenerator', () => {
  describe('generateSawtoothWave', () => {
    it('generates a basic sawtooth wave with correct period', () => {
      const params = {
        frequency: 10, // 10Hz = 0.1s period
        amplitude: 1.0,
        phase: 0,
        polarity: true,
        duration: 0.1, // One complete period
        sampleRate: 100, // 100 samples per second
      }

      const wave = generateSawtoothWave(params)

      // Should have correct number of samples
      expect(wave.length).toBe(10) // 0.1s * 100Hz = 10 samples

      // Check waveform shape (should go from -1 to 1 linearly)
      // At t=0, phase=0: wave should be at -1
      expect(wave[0]).toBeCloseTo(-1, 2)

      // At t=0.05s (halfway): wave should be at 0
      expect(wave[5]).toBeCloseTo(0, 2)

      // At t=0.09s (near end): wave should be close to 1
      expect(wave[9]).toBeCloseTo(0.8, 1)
    })

    it('applies amplitude scaling correctly', () => {
      const params = {
        frequency: 10,
        amplitude: 0.5,
        phase: 0,
        polarity: true,
        duration: 0.1,
        sampleRate: 100,
      }

      const wave = generateSawtoothWave(params)

      // All values should be scaled by amplitude
      expect(Math.max(...wave)).toBeLessThanOrEqual(0.5)
      expect(Math.min(...wave)).toBeGreaterThanOrEqual(-0.5)
    })

    it('applies phase offset correctly', () => {
      const params = {
        frequency: 10,
        amplitude: 1.0,
        phase: 90, // 90 degrees = 1/4 period
        polarity: true,
        duration: 0.1,
        sampleRate: 100,
      }

      const wave = generateSawtoothWave(params)

      // With 90 degree phase shift, wave at t=0 should be at -0.5
      expect(wave[0]).toBeCloseTo(-0.5, 2)
    })

    it('inverts waveform when polarity is false', () => {
      const paramsPositive = {
        frequency: 10,
        amplitude: 1.0,
        phase: 0,
        polarity: true,
        duration: 0.1,
        sampleRate: 100,
      }

      const paramsNegative = {
        ...paramsPositive,
        polarity: false,
      }

      const wavePositive = generateSawtoothWave(paramsPositive)
      const waveNegative = generateSawtoothWave(paramsNegative)

      // Negative polarity should invert the wave
      wavePositive.forEach((value, index) => {
        expect(waveNegative[index]).toBeCloseTo(-value, 5)
      })
    })

    it('generates zero wave when amplitude is 0', () => {
      const params = {
        frequency: 10,
        amplitude: 0,
        phase: 0,
        polarity: true,
        duration: 0.1,
        sampleRate: 100,
      }

      const wave = generateSawtoothWave(params)

      // All values should be zero
      wave.forEach(value => {
        expect(value).toBe(0)
      })
    })

    it('handles high frequency correctly', () => {
      const params = {
        frequency: 100, // 100Hz
        amplitude: 1.0,
        phase: 0,
        polarity: true,
        duration: 0.01, // One period at 100Hz
        sampleRate: 1000, // 1kHz sampling
      }

      const wave = generateSawtoothWave(params)

      expect(wave.length).toBe(10) // 0.01s * 1000Hz = 10 samples

      // Should still form a sawtooth from -1 to 1
      expect(wave[0]).toBeCloseTo(-1, 2)
      expect(wave[5]).toBeCloseTo(0, 1)
    })

    it('maintains phase continuity across multiple calls', () => {
      const params = {
        frequency: 10,
        amplitude: 1.0,
        phase: 0,
        polarity: true,
        duration: 0.05, // Half period
        sampleRate: 100,
        startTime: 0
      }

      const wave1 = generateSawtoothWave(params)

      // Continue from where we left off
      const wave2 = generateSawtoothWave({
        ...params,
        startTime: 0.05
      })

      // Last sample of wave1 should be close to first sample of wave2
      const continuityGap = Math.abs(wave2[0] - wave1[wave1.length - 1])
      expect(continuityGap).toBeLessThan(0.3) // Allow for one sample step
    })
  })

  describe('generateMultiChannelWaveform', () => {
    it('generates waveforms for all active channels', () => {
      const channels: WaveformParameters[] = [
        {
          channelId: 0,
          frequency: 10,
          amplitude: 1.0,
          phase: 0,
          polarity: true,
          isActive: true,
        },
        {
          channelId: 1,
          frequency: 20,
          amplitude: 0.5,
          phase: 90,
          polarity: false,
          isActive: true,
        },
        {
          channelId: 2,
          frequency: 30,
          amplitude: 0.7,
          phase: 180,
          polarity: true,
          isActive: false, // Inactive channel
        },
      ]

      const result = generateMultiChannelWaveform(channels, 0.1, 100)

      // Should generate data for all channels
      expect(result.channels).toHaveLength(3)

      // Check active channels have data
      const ch0 = result.channels.find(ch => ch.channelId === 0)
      const ch1 = result.channels.find(ch => ch.channelId === 1)
      const ch2 = result.channels.find(ch => ch.channelId === 2)

      expect(ch0?.data.length).toBe(10)
      expect(ch1?.data.length).toBe(10)
      expect(ch2?.data.length).toBe(10)

      // Inactive channel should have zeros
      ch2?.data.forEach(value => {
        expect(value).toBe(0)
      })

      // Active channels should have non-zero data
      expect(Math.max(...ch0!.data.map(Math.abs))).toBeGreaterThan(0.5)
      expect(Math.max(...ch1!.data.map(Math.abs))).toBeGreaterThan(0.3)
    })

    it('includes metadata in the result', () => {
      const channels: WaveformParameters[] = [
        {
          channelId: 0,
          frequency: 10,
          amplitude: 1.0,
          phase: 0,
          polarity: true,
          isActive: true,
        },
      ]

      const result = generateMultiChannelWaveform(channels, 0.1, 44100)

      expect(result.sampleRate).toBe(44100)
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(result.channels).toHaveLength(1)
    })

    it('handles empty channel array', () => {
      const result = generateMultiChannelWaveform([], 0.1, 44100)

      expect(result.channels).toHaveLength(0)
      expect(result.sampleRate).toBe(44100)
    })

    it('generates consistent waveforms with time offset', () => {
      const channels: WaveformParameters[] = [
        {
          channelId: 0,
          frequency: 10,
          amplitude: 1.0,
          phase: 0,
          polarity: true,
          isActive: true,
        },
      ]

      const result1 = generateMultiChannelWaveform(channels, 0.1, 100, 0)
      const result2 = generateMultiChannelWaveform(channels, 0.1, 100, 0.1)

      const data1 = result1.channels[0].data
      const data2 = result2.channels[0].data

      // With time offset of 0.1s and frequency of 10Hz,
      // the second waveform should start where the first one ended
      // At t=0.1s with 10Hz, we complete one full cycle, so wave returns to -1
      expect(data2[0]).toBeCloseTo(-1, 2)

      // But the last value of data1 should be near 1 (end of cycle)
      expect(data1[data1.length - 1]).toBeCloseTo(0.8, 1)
    })
  })

  describe('edge cases', () => {
    it('handles zero frequency', () => {
      const params = {
        frequency: 0,
        amplitude: 1.0,
        phase: 0,
        polarity: true,
        duration: 0.1,
        sampleRate: 100,
      }

      const wave = generateSawtoothWave(params)

      // With zero frequency, output should be constant DC
      const uniqueValues = new Set(wave.map(v => v.toFixed(5)))
      expect(uniqueValues.size).toBe(1)
    })

    it('handles very high sample rates', () => {
      const params = {
        frequency: 100,
        amplitude: 1.0,
        phase: 0,
        polarity: true,
        duration: 0.001, // 1ms
        sampleRate: 192000, // 192kHz
      }

      const wave = generateSawtoothWave(params)

      expect(wave.length).toBe(192) // 0.001s * 192000Hz = 192 samples
      expect(wave).toBeDefined()
    })

    it('handles negative amplitude gracefully', () => {
      const params = {
        frequency: 10,
        amplitude: -1.0, // Negative amplitude
        phase: 0,
        polarity: true,
        duration: 0.1,
        sampleRate: 100,
      }

      const wave = generateSawtoothWave(params)

      // Should treat as absolute value
      expect(Math.max(...wave.map(Math.abs))).toBeGreaterThan(0.5)
    })
  })
})
