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
  
  // Get YURAGI vector force and status
  const vectorForce = useHapticStore(state => state.vectorForce[`device${deviceId}`])
  const yuragiStatus = useHapticStore(state => state.yuragi[`device${deviceId}`])

  // State for acceleration data
  const [xAcceleration, setXAcceleration] = useState<number[]>([])
  const [yAcceleration, setYAcceleration] = useState<number[]>([])

  // Time tracking for phase continuity
  const startTimeRef = useRef(0)
  const lastFrameTimeRef = useRef(performance.now())
  const animationFrameRef = useRef<number | null>(null)

  // Generate acceleration data
  const generateAccelerationData = useCallback(() => {
    // Check if YURAGI mode is active
    if (yuragiStatus?.enabled) {
      // In YURAGI mode, use vector force to generate circular motion
      // If vectorForce is not available yet, return null to skip update
      if (!vectorForce || vectorForce.magnitude === undefined || vectorForce.angle === undefined) {
        return null
      }
      
      const angle = (vectorForce.angle * Math.PI) / 180 // Convert to radians
      const magnitude = vectorForce.magnitude
      
      // Generate circular coordinates
      const x = magnitude * Math.cos(angle)
      const y = magnitude * Math.sin(angle)
      
      // Return single point for smooth trajectory
      return { xAccel: [x], yAccel: [y] }
    }
    
    // Normal mode - use channel parameters
    if (!xChannel || !yChannel) {
      return null
    }

    // Update time tracking
    const currentTime = performance.now()
    const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000 // Convert to seconds
    lastFrameTimeRef.current = currentTime
    startTimeRef.current += deltaTime

    // Generate waveform for a short window
    const duration = 0.02 // 20ms of data for smoother updates
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

    // Take every 20th sample for trajectory (reduce data points but keep smooth)
    const downsampleFactor = 20
    const xAccel = xWaveforms.acceleration.filter((_, i) => i % downsampleFactor === 0)
    const yAccel = yWaveforms.acceleration.filter((_, i) => i % downsampleFactor === 0)

    return { xAccel, yAccel }
  }, [xChannel, yChannel, yuragiStatus, vectorForce, deviceId])

  // Animation loop
  const animate = useCallback(() => {
    const data = generateAccelerationData()
    if (data) {
      // For YURAGI mode, we want to show a trail effect
      if (yuragiStatus?.enabled) {
        // Append new point for trail effect, keep last 100 points for smoother visualization
        setXAcceleration(prev => [...prev, ...data.xAccel].slice(-100))
        setYAcceleration(prev => [...prev, ...data.yAccel].slice(-100))
      } else {
        // Normal mode - append new data, keep last 200 points
        setXAcceleration(prev => [...prev, ...data.xAccel].slice(-200))
        setYAcceleration(prev => [...prev, ...data.yAccel].slice(-200))
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [generateAccelerationData, yuragiStatus, vectorForce, deviceId])

  // Clear trajectory when YURAGI mode changes
  useEffect(() => {
    if (yuragiStatus?.enabled) {
      // Clear existing data when entering YURAGI mode
      setXAcceleration([])
      setYAcceleration([])
    }
  }, [yuragiStatus?.enabled, deviceId])

  // Start/stop animation based on component lifecycle or YURAGI/vectorForce changes
  useEffect(() => {
    // Reset time tracking
    startTimeRef.current = 0
    lastFrameTimeRef.current = performance.now()

    // Clear existing data only if not in YURAGI mode
    if (!yuragiStatus?.enabled) {
      setXAcceleration([])
      setYAcceleration([])
    }

    // Start animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [animate, yuragiStatus?.enabled, vectorForce, deviceId])

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
