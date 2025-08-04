import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { QuerySyncActions } from '@/lib/zustandQuerySync'
import type {
  IHapticSystemState,
  IChannelParameters,
  IVectorForce,
  IStatusResponse,
} from '@/types/hapticTypes'
import { CHANNEL_IDS } from '@/types/hapticTypes'

interface HapticStore extends IHapticSystemState, QuerySyncActions {
  // Actions
  setChannels: (channels: IChannelParameters[]) => void
  updateChannel: (channelId: number, params: Partial<IChannelParameters>) => void
  setStreaming: (isStreaming: boolean) => void
  setStatus: (status: IStatusResponse | null) => void
  setVectorForce: (deviceId: 1 | 2, force: IVectorForce | null) => void
  setConnection: (isConnected: boolean, error?: string | null) => void
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
  isStreaming: false,
  status: null,
  vectorForce: {
    device1: null,
    device2: null,
  },
  connection: {
    isConnected: false,
    error: null,
  },
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

      setStreaming: isStreaming => set({ isStreaming }),

      setStatus: status => set({ status }),

      setVectorForce: (deviceId, force) =>
        set(state => ({
          vectorForce: {
            ...state.vectorForce,
            [`device${deviceId}`]: force,
          },
        })),

      setConnection: (isConnected, error = null) =>
        set({
          connection: { isConnected, error },
        }),

      reset: () => set(initialState),
    }),
    {
      name: 'haptic-store',
    }
  )
)
