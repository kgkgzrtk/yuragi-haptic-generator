import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useHapticStore } from '@/contexts/hapticStore'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import { generatePhysicalWaveforms } from '@/utils/waveformGenerator'
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

  // Get channel parameters from store
  const xChannel = useHapticStore(state => state.channels.find(ch => ch.channelId === xChannelId))
  const yChannel = useHapticStore(state => state.channels.find(ch => ch.channelId === yChannelId))

  // State for acceleration data
  const [xAcceleration, setXAcceleration] = useState<number[]>([])
  const [yAcceleration, setYAcceleration] = useState<number[]>([])

  // Time tracking for phase continuity
  const startTimeRef = useRef(0)
  const lastFrameTimeRef = useRef(performance.now())
  const animationFrameRef = useRef<number | null>(null)

  // Generate acceleration data
  const generateAccelerationData = useCallback(() => {
    if (!xChannel || !yChannel) {
      return null
    }

    // Update time tracking
    const currentTime = performance.now()
    const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000 // Convert to seconds
    lastFrameTimeRef.current = currentTime
    startTimeRef.current += deltaTime

    // Generate waveform for a short window
    const duration = 0.05 // 50ms of data
    const sampleRate = 44100

    // Generate X acceleration
    const xWaveforms = generatePhysicalWaveforms({
      frequency: xChannel.frequency,
      amplitude: xChannel.amplitude,
      phase: xChannel.phase,
      polarity: xChannel.polarity,
      duration,
      sampleRate,
      startTime: startTimeRef.current,
    })

    // Generate Y acceleration (with inverted polarity for correct trajectory)
    const yWaveforms = generatePhysicalWaveforms({
      frequency: yChannel.frequency,
      amplitude: yChannel.amplitude,
      phase: yChannel.phase,
      polarity: !yChannel.polarity, // Invert polarity for Y axis
      duration,
      sampleRate,
      startTime: startTimeRef.current,
    })

    // Take every 100th sample for trajectory (reduce data points)
    const downsampleFactor = 100
    const xAccel = xWaveforms.acceleration.filter((_, i) => i % downsampleFactor === 0)
    const yAccel = yWaveforms.acceleration.filter((_, i) => i % downsampleFactor === 0)

    return { xAccel, yAccel }
  }, [xChannel, yChannel])

  // Animation loop
  const animate = useCallback(() => {
    const data = generateAccelerationData()
    if (data) {
      // Append new data to existing, keep last 200 points
      setXAcceleration(prev => [...prev, ...data.xAccel].slice(-200))
      setYAcceleration(prev => [...prev, ...data.yAccel].slice(-200))
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [generateAccelerationData])

  // Start/stop animation based on component lifecycle
  useEffect(() => {
    // Reset time tracking
    startTimeRef.current = 0
    lastFrameTimeRef.current = performance.now()

    // Clear existing data
    setXAcceleration([])
    setYAcceleration([])

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [animate])

  if (!xChannel || !yChannel) {
    return (
      <div className='acceleration-trajectory-error'>
        <p>Channels not found</p>
      </div>
    )
  }

  return (
    <AccelerationTrajectory
      deviceId={deviceId}
      xData={xAcceleration}
      yData={yAcceleration}
      maxPoints={200}
    />
  )
}

export default AccelerationTrajectoryContainer
