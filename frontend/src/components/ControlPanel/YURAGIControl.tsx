import React, { useCallback, useState, useEffect, useRef } from 'react'
import { Button } from '@/components/Common/Button'
import { Input } from '@/components/Common/Input'
import { useHapticStore } from '@/contexts/hapticStore'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import HapticService from '@/services/hapticService'
import { CONSTRAINTS } from '@/types/hapticTypes'
import type { IYURAGIRequest, IYURAGIStatus } from '@/types/hapticTypes'
import { getPresetParameters } from '@/utils/yuragiWaveform'

interface YURAGIControlProps {
  deviceId?: 1 | 2
}

export const YURAGIControl: React.FC<YURAGIControlProps> = ({ deviceId = 1 }) => {
  const { yuragi, setYuragiStatus, updateYuragiProgress, setVectorForce } = useHapticStore()
  const { handleError } = useErrorHandler()

  const [preset, setPreset] = useState<'gentle' | 'moderate' | 'intense' | 'therapeutic'>('gentle')
  const [duration, setDuration] = useState<number>(60)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const timerRef = useRef<number | null>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const isActiveRef = useRef<boolean>(false)

  const currentStatus = yuragi[`device${deviceId}`] as IYURAGIStatus | null
  const isActive = !!(currentStatus?.enabled && currentStatus?.startTime)
  const progress = currentStatus?.progress || 0

  // Keep isActiveRef updated
  useEffect(() => {
    isActiveRef.current = isActive ?? false
  }, [isActive])

  // Define handleStop early since it's used in useEffect
  const handleStopRef = useRef<() => Promise<void>>()

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  // YURAGI circular motion animation
  const animateYuragi = useCallback(async () => {
    // Debug: animateYuragi called
    if (!isActiveRef.current || !currentStatus?.preset) {
      // Debug: animateYuragi early return
      return
    }

    const presets = getPresetParameters()
    const presetParams = presets[currentStatus.preset as keyof typeof presets]
    if (!presetParams) {
      // Debug: No preset params found
      return
    }

    const now = Date.now()
    const elapsed = (now - startTimeRef.current) / 1000 // seconds

    // Calculate circular motion position
    const angle =
      2 * Math.PI * presetParams.rotationFreq * elapsed + (presetParams.phase * Math.PI) / 180
    const magnitude = presetParams.baseAmplitude

    // Apply amplitude modulation
    const envelopeModulation =
      Math.sin(2 * Math.PI * presetParams.envelopeFreq * elapsed) * presetParams.envelopeDepth
    const modulatedMagnitude = magnitude * (1.0 + envelopeModulation)

    // Convert to degrees and clamp
    const angleDegrees = ((angle * 180) / Math.PI) % 360
    const clampedMagnitude = Math.max(0, Math.min(1, modulatedMagnitude))

    // Debug: Updating vector force

    try {
      // Update vector force
      const vectorForce = {
        deviceId,
        angle: angleDegrees,
        magnitude: clampedMagnitude,
        frequency: 60, // Use fixed frequency for now
      }

      await HapticService.setVectorForce(vectorForce)

      // Update store to trigger UI updates
      setVectorForce(deviceId, vectorForce)
    } catch (err) {
      console.error('Failed to update vector force:', err)
    }

    // Continue animation
    if (isActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(animateYuragi)
    }
  }, [currentStatus?.preset, deviceId, setVectorForce])

  // Progress tracking
  useEffect(() => {
    // Debug: Progress tracking effect
    if (isActive && currentStatus?.startTime && currentStatus?.duration) {
      const startTime = new Date(currentStatus.startTime).getTime()
      const duration = currentStatus.duration * 1000 // convert to ms
      startTimeRef.current = startTime
      // Debug: Starting progress tracking

      progressIntervalRef.current = setInterval(() => {
        const now = Date.now()
        const elapsed = now - startTime
        const newProgress = Math.min((elapsed / duration) * 100, 100)
        // Debug: Progress update

        updateYuragiProgress(deviceId, newProgress)

        // Auto-stop when duration is reached
        if (newProgress >= 100) {
          handleStopRef.current?.()
        }
      }, 100) // Update every 100ms

      // Start YURAGI animation
      // Debug: Starting YURAGI animation
      // Use setTimeout to avoid immediate invocation issues
      setTimeout(() => animateYuragi(), 100)

      return () => {
        // Debug: Cleaning up progress tracking
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
      }
    }
  }, [
    isActive,
    currentStatus?.startTime,
    currentStatus?.duration,
    deviceId,
    updateYuragiProgress,
    animateYuragi,
  ])

  const validateDuration = useCallback((value: number): string => {
    if (value < CONSTRAINTS.YURAGI_DURATION.MIN) {
      return `Duration must be at least ${CONSTRAINTS.YURAGI_DURATION.MIN} seconds`
    }
    if (value > CONSTRAINTS.YURAGI_DURATION.MAX) {
      return `Duration must not exceed ${CONSTRAINTS.YURAGI_DURATION.MAX} seconds`
    }
    return ''
  }, [])

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10) || 0
      setDuration(value)
      const validationError = validateDuration(value)
      setError(validationError)
    },
    [validateDuration]
  )

  const handleStart = useCallback(async () => {
    try {
      setIsLoading(true)
      setError('')

      const validationError = validateDuration(duration)
      if (validationError) {
        setError(validationError)
        return
      }

      const request: IYURAGIRequest = {
        deviceId,
        preset,
        duration,
        enabled: true,
      }

      const response = await HapticService.yuragiPreset(request)

      // Update store with response and add startTime for progress tracking
      const statusWithStartTime: IYURAGIStatus = {
        ...response,
        startTime: new Date().toISOString(),
        progress: 0,
      }

      setYuragiStatus(deviceId, statusWithStartTime)
    } catch (err) {
      handleError(err, 'YURAGI Start')
      setError('Failed to start YURAGI massage')
    } finally {
      setIsLoading(false)
    }
  }, [deviceId, preset, duration, validateDuration, setYuragiStatus, handleError])

  const handleStop = useCallback(async () => {
    try {
      setIsLoading(true)
      setError('')

      const request: IYURAGIRequest = {
        deviceId,
        preset,
        duration,
        enabled: false,
      }

      await HapticService.yuragiPreset(request)

      // Clear status from store
      setYuragiStatus(deviceId, null)

      // Clear timers
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      // Clear vector force
      const clearVectorForce = {
        deviceId,
        angle: 0,
        magnitude: 0,
        frequency: 60,
      }
      await HapticService.setVectorForce(clearVectorForce)

      // Update store to clear UI
      setVectorForce(deviceId, null)
    } catch (err) {
      handleError(err, 'YURAGI Stop')
      setError('Failed to stop YURAGI massage')
    } finally {
      setIsLoading(false)
    }
  }, [deviceId, preset, duration, setYuragiStatus, handleError, setVectorForce])

  // Update the ref when handleStop changes
  useEffect(() => {
    handleStopRef.current = handleStop
  }, [handleStop])

  const handleToggle = useCallback(() => {
    if (isActive) {
      handleStop()
    } else {
      handleStart()
    }
  }, [isActive, handleStart, handleStop])

  return (
    <div className='yuragi-control' data-testid={`yuragi-control-${deviceId}`}>
      <h3 className='yuragi-control-title'>YURAGI Massage Control</h3>

      <div className='yuragi-control-fields'>
        <div className='input-group'>
          <label htmlFor={`yuragi-preset-${deviceId}`} className='input-label'>
            Preset
          </label>
          <select
            id={`yuragi-preset-${deviceId}`}
            value={preset}
            onChange={e => setPreset(e.target.value as typeof preset)}
            className='input'
            disabled={isActive || isLoading}
          >
            <option value='gentle'>Gentle</option>
            <option value='moderate'>Moderate</option>
            <option value='intense'>Intense</option>
            <option value='therapeutic'>Therapeutic</option>
          </select>
        </div>

        <div className='input-group'>
          <label htmlFor={`yuragi-device-${deviceId}`} className='input-label'>
            Device
          </label>
          <select
            id={`yuragi-device-${deviceId}`}
            value={deviceId.toString()}
            onChange={() => {}} // Device selector is controlled via props
            className='input'
            disabled={true} // Device selection handled by parent component
          >
            <option value='1'>Device 1</option>
            <option value='2'>Device 2</option>
          </select>
        </div>

        <Input
          label='Duration (seconds)'
          type='number'
          value={duration.toString()}
          onChange={handleDurationChange}
          min={CONSTRAINTS.YURAGI_DURATION.MIN}
          max={CONSTRAINTS.YURAGI_DURATION.MAX}
          error={error}
          disabled={isActive || isLoading}
          id={`yuragi-duration-${deviceId}`}
        />
      </div>

      {isActive && (
        <div className='yuragi-progress' data-testid={`yuragi-progress-${deviceId}`}>
          <div className='progress-label'>Progress: {Math.round(progress)}%</div>
          <div className='progress-bar'>
            <div
              className='progress-fill'
              style={{ width: `${progress}%` }}
              role='progressbar'
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      <div className='yuragi-control-actions'>
        <Button
          onClick={handleToggle}
          loading={isLoading}
          disabled={isLoading}
          variant={isActive ? 'danger' : 'primary'}
          data-testid={`yuragi-${isActive ? 'stop' : 'start'}-button-${deviceId}`}
        >
          {isActive ? 'Stop' : 'Start'} YURAGI
        </Button>
      </div>

      {error && (
        <div className='error-message' role='alert' data-testid={`yuragi-error-${deviceId}`}>
          {error}
        </div>
      )}
    </div>
  )
}

export default YURAGIControl
