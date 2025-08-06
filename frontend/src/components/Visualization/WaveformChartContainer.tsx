import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useHapticStore } from '@/contexts/hapticStore'
import type { IWaveformData } from '@/types/hapticTypes'
import { generateSawtoothWave } from '@/utils/waveformGenerator'
import { WaveformChart } from './WaveformChart'

interface WaveformChartContainerProps {
  channelId: number
  height?: number
}

export const WaveformChartContainer: React.FC<WaveformChartContainerProps> = ({
  channelId,
  height = 150,
}) => {
  // Get channel parameters from store
  const channel = useHapticStore(state => state.channels.find(ch => ch.channelId === channelId))
  const isStreaming = useHapticStore(state => state.isStreaming)

  // State for waveform data
  const [waveformData, setWaveformData] = useState<IWaveformData | null>(null)

  // Time tracking for phase continuity
  const startTimeRef = useRef(0)
  const animationFrameRef = useRef<number>()
  const lastFrameTimeRef = useRef(0)

  // Generate waveform function
  const generateWaveform = useCallback(() => {
    if (!channel || !isStreaming) {
      return null
    }

    const now = performance.now()
    const elapsed = lastFrameTimeRef.current ? (now - lastFrameTimeRef.current) / 1000 : 0
    startTimeRef.current += elapsed
    lastFrameTimeRef.current = now

    // Generate waveform
    const duration = 0.1 // 100ms of data
    const sampleRate = 44100

    const waveform = generateSawtoothWave({
      frequency: channel.frequency,
      amplitude: channel.amplitude,
      phase: channel.phase,
      polarity: channel.polarity,
      duration,
      sampleRate,
      startTime: startTimeRef.current
    })

    return {
      timestamp: new Date().toISOString(),
      sampleRate,
      channels: [
        {
          channelId: channel.channelId,
          data: waveform
        }
      ]
    }
  }, [channel, isStreaming])

  // Animation loop
  const animate = useCallback(() => {
    const data = generateWaveform()
    if (data) {
      setWaveformData(data)
    }

    if (isStreaming) {
      animationFrameRef.current = requestAnimationFrame(animate)
    }
  }, [generateWaveform, isStreaming])

  // Start/stop animation based on streaming state
  useEffect(() => {
    if (isStreaming) {
      // Reset time tracking
      startTimeRef.current = 0
      lastFrameTimeRef.current = performance.now()

      // Start animation
      animationFrameRef.current = requestAnimationFrame(animate)
    } else {
      // Stop animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setWaveformData(null)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isStreaming, animate])

  if (!isStreaming) {
    return (
      <div className='waveform-chart-loading' style={{ height }}>
        <p>Start streaming to see waveform</p>
      </div>
    )
  }

  if (!channel) {
    return (
      <div className='waveform-chart-error' style={{ height }}>
        <p>Channel not found</p>
      </div>
    )
  }

  // Pass the locally generated waveform data
  return <WaveformChart channelId={channelId} waveformData={waveformData} height={height} />
}

export default WaveformChartContainer
