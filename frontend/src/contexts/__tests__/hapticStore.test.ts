import { describe, it, expect, beforeEach } from 'vitest'
import { useHapticStore } from '@/contexts/hapticStore'
import { act, renderHook } from '@/test/test-utils'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import type { IChannelParameters, IVectorForce, IStatusResponse } from '@/types/hapticTypes'

describe('hapticStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useHapticStore.getState().reset()
    })
  })

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useHapticStore())

      const state = result.current

      expect(state.channels).toHaveLength(4)
      expect(state.status).toBeNull()
      expect(state.vectorForce.device1).toBeNull()
      expect(state.vectorForce.device2).toBeNull()
      expect(state.connection.isConnected).toBe(false)
      expect(state.connection.error).toBeNull()
    })

    it('initializes channels with correct default values', () => {
      const { result } = renderHook(() => useHapticStore())

      const channels = result.current.channels

      expect(channels).toEqual([
        { channelId: CHANNEL_IDS.DEVICE1_X, frequency: 0, amplitude: 0, phase: 0, polarity: true },
        { channelId: CHANNEL_IDS.DEVICE1_Y, frequency: 0, amplitude: 0, phase: 0, polarity: true },
        { channelId: CHANNEL_IDS.DEVICE2_X, frequency: 0, amplitude: 0, phase: 0, polarity: true },
        { channelId: CHANNEL_IDS.DEVICE2_Y, frequency: 0, amplitude: 0, phase: 0, polarity: true },
      ])
    })
  })

  describe('Channel Management', () => {
    const mockChannels: IChannelParameters[] = [
      { channelId: CHANNEL_IDS.DEVICE1_X, frequency: 60, amplitude: 0.5, phase: 0, polarity: true },
      {
        channelId: CHANNEL_IDS.DEVICE1_Y,
        frequency: 70,
        amplitude: 0.6,
        phase: 90,
        polarity: false,
      },
      {
        channelId: CHANNEL_IDS.DEVICE2_X,
        frequency: 80,
        amplitude: 0.7,
        phase: 180,
        polarity: true,
      },
      {
        channelId: CHANNEL_IDS.DEVICE2_Y,
        frequency: 90,
        amplitude: 0.8,
        phase: 270,
        polarity: false,
      },
    ]

    it('updates all channels with setChannels', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setChannels(mockChannels)
      })

      expect(result.current.channels).toEqual(mockChannels)
    })

    it('merges existing channel data when setting channels', () => {
      const { result } = renderHook(() => useHapticStore())

      // Set initial channels
      act(() => {
        result.current.setChannels(mockChannels)
      })

      // Update with partial data - only one channel provided
      const partialChannels: IChannelParameters[] = [
        {
          channelId: CHANNEL_IDS.DEVICE1_X,
          frequency: 100,
          amplitude: 0.9,
          phase: 45,
          polarity: false,
        },
      ]

      act(() => {
        result.current.setChannels(partialChannels)
      })

      // Should only have the one channel that was provided
      const updatedChannels = result.current.channels
      expect(updatedChannels).toHaveLength(1)

      const device1XChannel = updatedChannels.find(ch => ch.channelId === CHANNEL_IDS.DEVICE1_X)
      expect(device1XChannel).toEqual({
        channelId: CHANNEL_IDS.DEVICE1_X,
        frequency: 100,
        amplitude: 0.9,
        phase: 45,
        polarity: false,
      })
    })

    it('updates individual channel with updateChannel', () => {
      const { result } = renderHook(() => useHapticStore())

      // Set initial channels
      act(() => {
        result.current.setChannels(mockChannels)
      })

      // Update single channel
      act(() => {
        result.current.updateChannel(CHANNEL_IDS.DEVICE1_X, {
          frequency: 120,
          amplitude: 1.0,
        })
      })

      const updatedChannel = result.current.channels.find(
        ch => ch.channelId === CHANNEL_IDS.DEVICE1_X
      )

      expect(updatedChannel).toEqual({
        channelId: CHANNEL_IDS.DEVICE1_X,
        frequency: 120,
        amplitude: 1.0,
        phase: 0, // Original value preserved
        polarity: true, // Original value preserved
      })
    })

    it('ignores updates to non-existent channels', () => {
      const { result } = renderHook(() => useHapticStore())

      const initialChannels = [...result.current.channels]

      act(() => {
        result.current.updateChannel(999, { frequency: 100 }) // Non-existent channel ID
      })

      expect(result.current.channels).toEqual(initialChannels)
    })
  })

  describe('Status Management', () => {
    const mockStatus: IStatusResponse = {
      sampleRate: 44100,
      blockSize: 512,
    }

    it('updates status with setStatus', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setStatus(mockStatus)
      })

      expect(result.current.status).toEqual(mockStatus)
    })

    it('clears status when set to null', () => {
      const { result } = renderHook(() => useHapticStore())

      // Set status first
      act(() => {
        result.current.setStatus(mockStatus)
      })

      // Clear status
      act(() => {
        result.current.setStatus(null)
      })

      expect(result.current.status).toBeNull()
    })
  })

  describe('Vector Force Management', () => {
    const mockVectorForce1: IVectorForce = {
      deviceId: 1,
      angle: 45,
      magnitude: 0.8,
      frequency: 100,
    }

    const mockVectorForce2: IVectorForce = {
      deviceId: 2,
      angle: 135,
      magnitude: 0.6,
      frequency: 80,
    }

    it('sets vector force for device 1', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setVectorForce(1, mockVectorForce1)
      })

      expect(result.current.vectorForce.device1).toEqual(mockVectorForce1)
      expect(result.current.vectorForce.device2).toBeNull() // Should not affect device 2
    })

    it('sets vector force for device 2', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setVectorForce(2, mockVectorForce2)
      })

      expect(result.current.vectorForce.device2).toEqual(mockVectorForce2)
      expect(result.current.vectorForce.device1).toBeNull() // Should not affect device 1
    })

    it('manages both devices independently', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setVectorForce(1, mockVectorForce1)
        result.current.setVectorForce(2, mockVectorForce2)
      })

      expect(result.current.vectorForce.device1).toEqual(mockVectorForce1)
      expect(result.current.vectorForce.device2).toEqual(mockVectorForce2)
    })

    it('clears vector force when set to null', () => {
      const { result } = renderHook(() => useHapticStore())

      // Set vector force first
      act(() => {
        result.current.setVectorForce(1, mockVectorForce1)
      })

      // Clear vector force
      act(() => {
        result.current.setVectorForce(1, null)
      })

      expect(result.current.vectorForce.device1).toBeNull()
    })

    it('updates existing vector force', () => {
      const { result } = renderHook(() => useHapticStore())

      // Set initial vector force
      act(() => {
        result.current.setVectorForce(1, mockVectorForce1)
      })

      // Update with new values
      const updatedVectorForce: IVectorForce = {
        deviceId: 1,
        angle: 90,
        magnitude: 1.0,
        frequency: 120,
      }

      act(() => {
        result.current.setVectorForce(1, updatedVectorForce)
      })

      expect(result.current.vectorForce.device1).toEqual(updatedVectorForce)
    })
  })

  describe('Connection Management', () => {
    it('sets connection status to connected', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setConnection(true)
      })

      expect(result.current.connection.isConnected).toBe(true)
      expect(result.current.connection.error).toBeNull()
    })

    it('sets connection status to disconnected with error', () => {
      const { result } = renderHook(() => useHapticStore())

      const errorMessage = 'Connection timeout'

      act(() => {
        result.current.setConnection(false, errorMessage)
      })

      expect(result.current.connection.isConnected).toBe(false)
      expect(result.current.connection.error).toBe(errorMessage)
    })

    it('clears error when connecting successfully', () => {
      const { result } = renderHook(() => useHapticStore())

      // Set error state first
      act(() => {
        result.current.setConnection(false, 'Connection failed')
      })

      // Connect successfully
      act(() => {
        result.current.setConnection(true)
      })

      expect(result.current.connection.isConnected).toBe(true)
      expect(result.current.connection.error).toBeNull()
    })

    it('handles disconnection without error message', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setConnection(false)
      })

      expect(result.current.connection.isConnected).toBe(false)
      expect(result.current.connection.error).toBeNull()
    })
  })

  describe('Store Reset', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useHapticStore())

      // Modify all state
      act(() => {
        result.current.setChannels([
          {
            channelId: CHANNEL_IDS.DEVICE1_X,
            frequency: 100,
            amplitude: 1.0,
            phase: 90,
            polarity: false,
          },
        ])
        result.current.setStatus({
          sampleRate: 48000,
          blockSize: 1024,
        })
        result.current.setVectorForce(1, {
          deviceId: 1,
          angle: 45,
          magnitude: 0.8,
          frequency: 100,
        })
        result.current.setConnection(true)
      })

      // Reset store
      act(() => {
        result.current.reset()
      })

      // Should return to initial state
      expect(result.current.channels).toHaveLength(4)
      expect(result.current.channels[0]).toEqual({
        channelId: CHANNEL_IDS.DEVICE1_X,
        frequency: 60,
        amplitude: 0.5,
        phase: 90,
        polarity: true,
      })
      expect(result.current.status).toBeNull()
      expect(result.current.vectorForce.device1).toBeNull()
      expect(result.current.vectorForce.device2).toBeNull()
      expect(result.current.connection.isConnected).toBe(false)
      expect(result.current.connection.error).toBeNull()
    })
  })

  describe('State Selectors', () => {
    it('selects specific channels', () => {
      const { result } = renderHook(() =>
        useHapticStore(state => state.channels.find(ch => ch.channelId === CHANNEL_IDS.DEVICE1_X))
      )

      expect(result.current).toEqual({
        channelId: CHANNEL_IDS.DEVICE1_X,
        frequency: 0,
        amplitude: 0,
        phase: 0,
        polarity: true,
      })
    })

    it('selects connection status', () => {
      const { result } = renderHook(() => useHapticStore(state => state.connection.isConnected))

      expect(result.current).toBe(false)

      act(() => {
        useHapticStore.getState().setConnection(true)
      })

      expect(result.current).toBe(true)
    })

    it('selects vector force for specific device', () => {
      const { result } = renderHook(() => useHapticStore(state => state.vectorForce.device1))

      expect(result.current).toBeNull()

      const mockVectorForce: IVectorForce = {
        deviceId: 1,
        angle: 45,
        magnitude: 0.8,
        frequency: 100,
      }

      act(() => {
        useHapticStore.getState().setVectorForce(1, mockVectorForce)
      })

      expect(result.current).toEqual(mockVectorForce)
    })
  })

  describe('State Immutability', () => {
    it('does not mutate original channel array when updating', () => {
      const { result } = renderHook(() => useHapticStore())

      const originalChannels = result.current.channels

      act(() => {
        result.current.updateChannel(CHANNEL_IDS.DEVICE1_X, { frequency: 100 })
      })

      const newChannels = result.current.channels

      // Should be different array reference
      expect(newChannels).not.toBe(originalChannels)

      // Original channels should be unchanged
      expect(originalChannels[0].frequency).toBe(0)
      expect(newChannels[0].frequency).toBe(100)
    })

    it('does not mutate vector force object when updating', () => {
      const { result } = renderHook(() => useHapticStore())

      const mockVectorForce1: IVectorForce = {
        deviceId: 1,
        angle: 45,
        magnitude: 0.8,
        frequency: 100,
      }

      act(() => {
        result.current.setVectorForce(1, mockVectorForce1)
      })

      const originalVectorForce = result.current.vectorForce

      const mockVectorForce2: IVectorForce = {
        deviceId: 2,
        angle: 90,
        magnitude: 0.6,
        frequency: 80,
      }

      act(() => {
        result.current.setVectorForce(2, mockVectorForce2)
      })

      const newVectorForce = result.current.vectorForce

      // Should be different object reference
      expect(newVectorForce).not.toBe(originalVectorForce)

      // Device 1 should remain unchanged
      expect(newVectorForce.device1).toEqual(mockVectorForce1)
      expect(newVectorForce.device2).toEqual(mockVectorForce2)
    })
  })
})
