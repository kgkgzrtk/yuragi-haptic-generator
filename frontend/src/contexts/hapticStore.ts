import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  IHapticSystemState,
  IChannelParameters,
  IVectorForce,
  IStatusResponse,
  IYURAGIStatus,
  IWaveformColors,
} from '@/types/hapticTypes'
import { CHANNEL_IDS, DEFAULT_WAVEFORM_COLORS } from '@/types/hapticTypes'

interface HapticStore extends IHapticSystemState {
  // Actions
  setChannels: (channels: IChannelParameters[]) => void
  updateChannel: (channelId: number, params: Partial<IChannelParameters>) => void
  setStatus: (status: IStatusResponse | null) => void
  setVectorForce: (deviceId: 1 | 2, force: IVectorForce | null) => void
  setConnection: (isConnected: boolean, error?: string | null) => void
  setYuragiStatus: (deviceId: 1 | 2, status: IYURAGIStatus | null) => void
  updateYuragiProgress: (deviceId: 1 | 2, progress: number) => void
  setWaveformColors: (colors: IWaveformColors) => void
  updateWaveformColor: (channelId: number, color: string) => void
  resetWaveformColors: () => void
  reset: () => void
}

// Initial state
const initialState: IHapticSystemState = {
  channels: [
    { channelId: CHANNEL_IDS.DEVICE1_X, frequency: 60, amplitude: 0.5, phase: 90, polarity: true },
    { channelId: CHANNEL_IDS.DEVICE1_Y, frequency: 60, amplitude: 0.5, phase: 90, polarity: true },
    { channelId: CHANNEL_IDS.DEVICE2_X, frequency: 60, amplitude: 0.5, phase: 90, polarity: true },
    { channelId: CHANNEL_IDS.DEVICE2_Y, frequency: 60, amplitude: 0.5, phase: 90, polarity: true },
  ],
  status: null,
  vectorForce: {
    device1: null,
    device2: null,
  },
  yuragi: {
    device1: null,
    device2: null,
    isActive: false,
  },
  connection: {
    isConnected: false,
    error: null,
  },
  waveformColors: DEFAULT_WAVEFORM_COLORS,
}

// Create store with devtools support
export const useHapticStore = create<HapticStore>()(
  devtools(
    set => ({
      ...initialState,

      setChannels: channels =>
        set(state => ({
          channels: channels.map(ch => ({
            ...state.channels.find(c => c.channelId === ch.channelId),
            ...ch,
          })),
        })),

      updateChannel: (channelId, params) =>
        set(state => ({
          channels: state.channels.map(ch =>
            ch.channelId === channelId ? { ...ch, ...params } : ch
          ),
        })),

      setStatus: status => set({ status }),

      setVectorForce: (deviceId, force) =>
        set(state => {
          // Update vector force
          const newVectorForce = {
            ...state.vectorForce,
            [`device${deviceId}`]: force,
          }

          // If force is null or magnitude is 0, just clear the vector force
          if (!force || force.magnitude === 0) {
            return { vectorForce: newVectorForce }
          }

          // Calculate X and Y amplitudes from vector force
          const angleRad = (force.angle * Math.PI) / 180
          const xComponent = force.magnitude * Math.cos(angleRad)
          const yComponent = force.magnitude * Math.sin(angleRad)

          // Amplitude is always positive, polarity indicates direction
          const xAmplitude = Math.abs(xComponent)
          const yAmplitude = Math.abs(yComponent)
          const xPolarity = xComponent >= 0
          const yPolarity = yComponent >= 0

          // Determine channel IDs based on device
          const xChannelId = deviceId === 1 ? CHANNEL_IDS.DEVICE1_X : CHANNEL_IDS.DEVICE2_X
          const yChannelId = deviceId === 1 ? CHANNEL_IDS.DEVICE1_Y : CHANNEL_IDS.DEVICE2_Y

          // Update channels with new amplitudes and frequency
          const newChannels = state.channels.map(ch => {
            if (ch.channelId === xChannelId) {
              return {
                ...ch,
                amplitude: xAmplitude,
                frequency: force.frequency,
                polarity: xPolarity,
              }
            }
            if (ch.channelId === yChannelId) {
              return {
                ...ch,
                amplitude: yAmplitude,
                frequency: force.frequency,
                polarity: yPolarity,
              }
            }
            return ch
          })

          return {
            vectorForce: newVectorForce,
            channels: newChannels,
          }
        }),

      setConnection: (isConnected, error = null) =>
        set({
          connection: { isConnected, error },
        }),

      setYuragiStatus: (deviceId, status) =>
        set(state => ({
          yuragi: {
            ...state.yuragi,
            [`device${deviceId}`]: status,
            isActive: status
              ? true
              : deviceId === 1
                ? !!state.yuragi.device2?.enabled
                : !!state.yuragi.device1?.enabled,
          },
        })),

      updateYuragiProgress: (deviceId, progress) =>
        set(state => {
          const currentStatus = state.yuragi[`device${deviceId}`]
          if (!currentStatus) {
            return state
          }

          return {
            yuragi: {
              ...state.yuragi,
              [`device${deviceId}`]: {
                ...currentStatus,
                progress,
              },
            },
          }
        }),

      setWaveformColors: colors => set({ waveformColors: colors }),

      updateWaveformColor: (channelId, color) =>
        set(state => ({
          waveformColors: {
            ...state.waveformColors,
            [channelId]: color,
          },
        })),

      resetWaveformColors: () => set({ waveformColors: DEFAULT_WAVEFORM_COLORS }),

      reset: () => set(initialState),
    }),
    {
      name: 'haptic-store',
    }
  )
)
