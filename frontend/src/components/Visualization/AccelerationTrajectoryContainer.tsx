import React, { useMemo } from 'react'
import { useChannelWaveformQuery } from '@/hooks/queries/useWaveformQuery'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import { AccelerationTrajectory } from './AccelerationTrajectory'

interface AccelerationTrajectoryContainerProps {
  deviceId: 1 | 2
}

export const AccelerationTrajectoryContainer: React.FC<AccelerationTrajectoryContainerProps> = ({
  deviceId,
}) => {
  // Get the X and Y channel IDs for the device
  const xChannelId = deviceId === 1 ? CHANNEL_IDS.DEVICE1_X : CHANNEL_IDS.DEVICE2_X
  const yChannelId = deviceId === 1 ? CHANNEL_IDS.DEVICE1_Y : CHANNEL_IDS.DEVICE2_Y

  // Fetch waveform data for X and Y channels
  const xChannelQuery = useChannelWaveformQuery(xChannelId, {
    realTime: true,
    duration: 0.1,
    sampleRate: 44100,
  })

  const yChannelQuery = useChannelWaveformQuery(yChannelId, {
    realTime: true,
    duration: 0.1,
    sampleRate: 44100,
  })

  // Extract acceleration data from waveform data
  const xData = useMemo(() => {
    if (!xChannelQuery.channelData?.data) {return []}
    // Normalize the data to -1 to 1 range for visualization
    const rawData = xChannelQuery.channelData.data
    const maxValue = Math.max(...rawData.map(Math.abs))
    return maxValue > 0 ? rawData.map(v => v / maxValue) : rawData
  }, [xChannelQuery.channelData])

  const yData = useMemo(() => {
    if (!yChannelQuery.channelData?.data) {return []}
    // Normalize the data to -1 to 1 range for visualization
    const rawData = yChannelQuery.channelData.data
    const maxValue = Math.max(...rawData.map(Math.abs))
    return maxValue > 0 ? rawData.map(v => v / maxValue) : rawData
  }, [yChannelQuery.channelData])

  // Show loading state
  if (xChannelQuery.isLoading || yChannelQuery.isLoading) {
    return (
      <div className='acceleration-trajectory-loading'>
        <p>Loading acceleration data...</p>
      </div>
    )
  }

  // Show error state with more details
  if (xChannelQuery.isError || yChannelQuery.isError) {
    const errorMessage = xChannelQuery.error?.message || yChannelQuery.error?.message || 'Unknown error'
    return (
      <div className='acceleration-trajectory-error'>
        <p>Error loading acceleration data</p>
        <small>{errorMessage}</small>
      </div>
    )
  }

  // Show empty state when no data is available
  if (!xData.length && !yData.length) {
    return (
      <div className='acceleration-trajectory-empty'>
        <p>No acceleration data available</p>
        <small>Configure channel parameters to see trajectory visualization</small>
      </div>
    )
  }

  return (
    <AccelerationTrajectory
      deviceId={deviceId}
      xData={xData}
      yData={yData}
      maxPoints={200}
    />
  )
}

export default AccelerationTrajectoryContainer
