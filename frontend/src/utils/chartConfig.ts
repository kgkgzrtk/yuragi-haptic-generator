import { CHANNEL_IDS } from '@/types/hapticTypes'
import type { ChartOptions, ChartData } from 'chart.js'

// Chart colors for each channel - Relaxing Low-saturation Theme
export const CHANNEL_COLORS = {
  [CHANNEL_IDS.DEVICE1_X]: '#CAA3A8', // Dusty rose - muted rosy tone
  [CHANNEL_IDS.DEVICE1_Y]: '#94B894', // Sage grey - gentle earthy green-grey
  [CHANNEL_IDS.DEVICE2_X]: '#D6CCC2', // Warm beige - soft earth tone
  [CHANNEL_IDS.DEVICE2_Y]: '#BFB3CC', // Soft lavender grey - muted violet-grey
} as const

// Colors for different signal types - Relaxing Low-saturation Theme
export const SIGNAL_COLORS = {
  voltage: '#94B894', // Sage grey - primary signal
  current: '#D6CCC280', // Warm beige with transparency (50% opacity)
  acceleration: '#CAA3A8', // Dusty rose - accent signal
} as const

// Base chart options for waveform visualization
export const getWaveformChartOptions = (channelId: number): ChartOptions<'line'> => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 0, // Disable animation for real-time updates
  },
  scales: {
    x: {
      type: 'linear',
      title: {
        display: true,
        text: 'Time (ms)',
      },
      ticks: {
        maxTicksLimit: 10,
      },
    },
    y: {
      type: 'linear',
      title: {
        display: true,
        text: 'Amplitude',
      },
      min: -1.2,
      max: 1.2,
    },
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 10,
      },
    },
    title: {
      display: true,
      text: `Channel ${channelId} Waveforms`,
      padding: {
        bottom: 5,
      },
      font: {
        size: 14,
      },
    },
  },
  elements: {
    point: {
      radius: 0, // Hide points for performance
    },
    line: {
      borderWidth: 2,
      tension: 0, // Linear interpolation
    },
  },
})

// Create chart data structure
export const createWaveformData = (
  _channelId: number, // Keep for API compatibility
  data: number[],
  sampleRate: number,
  current?: number[],
  acceleration?: number[],
  customColors?: {
    voltage?: string
    current?: string
    acceleration?: string
  }
): ChartData<'line'> => {
  // Create time points
  const createDataPoints = (values: number[]) =>
    values.map((value, index) => ({
      x: (index / sampleRate) * 1000, // Time in ms
      y: value,
    }))

  const datasets = []

  // Use custom colors or fallback to default signal colors
  const colors = {
    voltage: customColors?.voltage || SIGNAL_COLORS.voltage,
    current: customColors?.current || SIGNAL_COLORS.current,
    acceleration: customColors?.acceleration || SIGNAL_COLORS.acceleration,
  }

  // Voltage dataset
  datasets.push({
    label: 'Voltage',
    data: createDataPoints(data),
    borderColor: colors.voltage,
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    pointRadius: 0,
    tension: 0,
    order: 3,
  })

  // Current dataset
  if (current && current.length > 0) {
    datasets.push({
      label: 'Current',
      data: createDataPoints(current),
      borderColor: colors.current,
      backgroundColor: 'transparent',
      borderWidth: 1,
      pointRadius: 0,
      tension: 0,
      order: 2,
    })
  }

  // Acceleration dataset
  if (acceleration && acceleration.length > 0) {
    datasets.push({
      label: 'Acceleration',
      data: createDataPoints(acceleration),
      borderColor: colors.acceleration,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      order: 1,
    })
  }

  return {
    datasets,
  }
}

// Real-time streaming chart options
export const getStreamingChartOptions = (channelId: number): ChartOptions<'line'> => ({
  ...getWaveformChartOptions(channelId),
  scales: {
    x: {
      type: 'linear',
      min: 0,
      max: 100,
      ticks: {
        display: false, // Hide x-axis labels for cleaner look
      },
    },
    y: {
      type: 'linear',
      min: -1.1,
      max: 1.1,
    },
  },
})

// Utility to calculate optimal buffer size for smooth visualization
export const calculateBufferSize = (sampleRate: number, displayDuration: number): number => {
  return Math.floor(sampleRate * displayDuration)
}

// Throttle function for performance optimization
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      func(...args)
    }
  }
}
