import { CHANNEL_IDS } from '@/types/hapticTypes'
import type { ChartOptions, ChartData } from 'chart.js'

// Chart colors for each channel
export const CHANNEL_COLORS = {
  [CHANNEL_IDS.DEVICE1_X]: '#FF6384', // Red
  [CHANNEL_IDS.DEVICE1_Y]: '#36A2EB', // Blue
  [CHANNEL_IDS.DEVICE2_X]: '#FFCE56', // Yellow
  [CHANNEL_IDS.DEVICE2_Y]: '#4BC0C0', // Teal
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
      min: -1.1,
      max: 1.1,
    },
  },
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: true,
      text: `Channel ${channelId} Waveform`,
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
  channelId: number,
  data: number[],
  sampleRate: number
): ChartData<'line'> => {
  // Create {x, y} data points for Chart.js
  const dataPoints = data.map((value, index) => ({
    x: (index / sampleRate) * 1000, // Time in ms
    y: value
  }))

  return {
    datasets: [
      {
        label: `Channel ${channelId}`,
        data: dataPoints,
        borderColor: CHANNEL_COLORS[channelId as keyof typeof CHANNEL_COLORS],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
      },
    ],
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
