import axios from 'axios'
import type {
  IChannelParameters,
  IParametersResponse,
  IStatusResponse,
  IVectorForce,
  IWaveformData,
} from '@/types/hapticTypes'

const API_BASE_URL = '/api'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// API service class
export class HapticService {
  // Health check
  static async checkHealth(): Promise<{ status: string }> {
    const response = await api.get('/health')
    return response.data
  }

  // Parameters management
  static async getParameters(): Promise<IParametersResponse> {
    const response = await api.get('/parameters')
    return response.data
  }

  static async updateParameters(channels: IChannelParameters[]): Promise<{ status: string }> {
    const response = await api.put('/parameters', { channels })
    return response.data
  }

  static async updateChannel(
    channelId: number,
    params: Partial<Omit<IChannelParameters, 'channelId'>>
  ): Promise<{ channelId: number; status: string }> {
    const response = await api.put(`/channels/${channelId}`, params)
    return response.data
  }

  // Waveform data
  static async getWaveformData(
    duration: number = 0.1,
    sampleRate: number = 44100
  ): Promise<IWaveformData> {
    const response = await api.post('/waveform', { duration, sampleRate })
    return response.data
  }


  // Vector force control
  static async setVectorForce(params: IVectorForce): Promise<{ status: string }> {
    const response = await api.post('/vector-force', {
      device_id: params.deviceId,
      angle: params.angle,
      magnitude: params.magnitude,
      frequency: params.frequency,
    })
    return response.data
  }

  // Device info
  static async getDeviceInfo(): Promise<{
    available: boolean
    channels: number
    name: string
    device_mode: 'dual' | 'single' | 'none'
  }> {
    const response = await api.get('/device-info')
    return response.data
  }
}

// Export default instance
export default HapticService
