import React, { useRef, useEffect, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useHapticStore } from '@/contexts/hapticStore'
import type { IWaveformData } from '@/types/hapticTypes'
import { getWaveformChartOptions, createWaveformData } from '@/utils/chartConfig'

// Register Chart.js components
if (typeof ChartJS?.register === 'function') {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)
}

interface WaveformChartProps {
  channelId: number
  waveformData?: IWaveformData | null
  height?: number
}

export const WaveformChart: React.FC<WaveformChartProps> = ({
  channelId,
  waveformData,
  height = 400,
}) => {
  const chartRef = useRef<ChartJS<'line'> | null>(null)

  // Get waveform colors from store
  const waveformColors = useHapticStore(state => state.waveformColors)

  // Get channel data
  const channelData = useMemo(() => {
    if (!waveformData || !waveformData.channels) {
      return null
    }
    return waveformData.channels.find(ch => ch.channelId === channelId)
  }, [waveformData, channelId])

  // Get channel-specific color
  const channelColor = useMemo(() => {
    return waveformColors[channelId] || '#13ae4b' // Fallback to primary green
  }, [waveformColors, channelId])

  // Create custom colors for this channel
  const customColors = useMemo(() => ({
    voltage: channelColor,
    current: `${channelColor}80`, // Add 50% opacity for current
    acceleration: channelColor,
  }), [channelColor])

  // Create chart data
  const chartData = useMemo(() => {
    if (!channelData || !waveformData) {
      // Return empty data structure
      return createWaveformData(channelId, [], 44100, undefined, undefined, customColors)
    }

    return createWaveformData(
      channelId,
      channelData.data,
      waveformData.sampleRate,
      channelData.current,
      channelData.acceleration,
      customColors
    )
  }, [channelData, channelId, waveformData, customColors])

  // Chart options
  const options = useMemo(() => getWaveformChartOptions(channelId), [channelId])

  // Update chart efficiently
  useEffect(() => {
    if (chartRef.current && channelData) {
      const chart = chartRef.current
      // Force update all datasets
      chart.data.datasets = chartData.datasets
      chart.update('none') // Skip animation for performance
    }
  }, [chartData, channelData])

  return (
    <div className='waveform-chart' data-testid={`waveform-chart-${channelId}`} style={{ height }}>
      <Line ref={chartRef} data={chartData} options={options} height={height} />
    </div>
  )
}

export default WaveformChart
