import React from 'react'
import { WaveformChart } from './WaveformChart'
import { useChannelWaveformQuery } from '@/hooks/queries/useWaveformQuery'

interface WaveformChartContainerProps {
  channelId: number
  height?: number
}

export const WaveformChartContainer: React.FC<WaveformChartContainerProps> = ({
  channelId,
  height = 150,
}) => {
  // Fetch waveform data for this channel with real-time updates
  const { data, isLoading, isError } = useChannelWaveformQuery(channelId, {
    realTime: true,
    duration: 0.1,
    sampleRate: 44100,
  })
  


  if (isLoading) {
    return (
      <div className='waveform-chart-loading' style={{ height }}>
        <p>Loading waveform...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className='waveform-chart-error' style={{ height }}>
        <p>Error loading waveform data</p>
      </div>
    )
  }

  // Pass the full waveform data, not just channel data
  return <WaveformChart channelId={channelId} waveformData={data} height={height} />
}

export default WaveformChartContainer