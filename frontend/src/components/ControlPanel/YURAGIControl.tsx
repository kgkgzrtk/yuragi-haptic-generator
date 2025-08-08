import React, { useCallback, useState, useEffect, useRef } from 'react'
import { Button } from '@/components/Common/Button'
import { Input } from '@/components/Common/Input'
import { useHapticStore } from '@/contexts/hapticStore'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import HapticService from '@/services/hapticService'
import { CONSTRAINTS } from '@/types/hapticTypes'
import type { IYURAGIRequest, IYURAGIStatus } from '@/types/hapticTypes'
import { getPresetParameters } from '@/utils/yuragiWaveform'

export const YURAGIControl: React.FC = () => {
  const { yuragi, setYuragiStatus, updateYuragiProgress, setVectorForce } = useHapticStore()
  const { handleError } = useErrorHandler()

  const [preset, setPreset] = useState<'gentle' | 'moderate' | 'intense' | 'therapeutic' | 'therapeutic_fluctuation'>('gentle')
  const [duration, setDuration] = useState<number>(60)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const timerRef = useRef<number | null>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const isActiveRef = useRef<boolean>(false)
  const phaseRef = useRef<number>(0) // Track accumulated phase for variable speed

  // YURAGI now controls both devices simultaneously
  const currentStatus = yuragi.device1 || yuragi.device2
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
    if (!isActiveRef.current || !currentStatus?.preset) {
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
    const deltaTime = 1 / 60 // Assume 60fps for smooth animation

    // For therapeutic_fluctuation preset, apply low-frequency speed modulation
    let speedModulation = 1.0
    if (currentStatus.preset === 'therapeutic_fluctuation') {
      // Low-frequency modulation (0.1 Hz = 10 second period)
      const lowFreqModulation = Math.sin(2 * Math.PI * 0.1 * elapsed)
      // Add some complexity with a second frequency (0.07 Hz = ~14 second period)
      const secondModulation = Math.sin(2 * Math.PI * 0.07 * elapsed + Math.PI / 3)
      // Combine modulations with much stronger amplitude for more pronounced effect
      speedModulation = 1.0 + 0.8 * lowFreqModulation + 0.5 * secondModulation
      // Ensure speed doesn't go negative or too fast
      speedModulation = Math.max(0.1, Math.min(3.0, speedModulation))
    }

    // Update phase with variable speed
    const instantaneousFreq = presetParams.rotationFreq * speedModulation
    phaseRef.current += 2 * Math.PI * instantaneousFreq * deltaTime

    // Calculate circular motion position using accumulated phase
    const angle = phaseRef.current + (presetParams.phase * Math.PI) / 180
    const magnitude = presetParams.baseAmplitude

    // Apply amplitude modulation
    let modulatedMagnitude = magnitude
    if (currentStatus.preset === 'therapeutic_fluctuation') {
      // For therapeutic_fluctuation, use 0.8 as the center offset for amplitude
      const envelopeModulation =
        Math.sin(2 * Math.PI * presetParams.envelopeFreq * elapsed) * presetParams.envelopeDepth
      modulatedMagnitude = magnitude * (0.8 + envelopeModulation * 0.8)
    } else {
      // Normal amplitude modulation for other presets
      const envelopeModulation =
        Math.sin(2 * Math.PI * presetParams.envelopeFreq * elapsed) * presetParams.envelopeDepth
      modulatedMagnitude = magnitude * (1.0 + envelopeModulation)
    }

    // Convert to degrees and clamp
    const angleDegrees = ((angle * 180) / Math.PI) % 360
    const clampedMagnitude = Math.max(0, Math.min(1, modulatedMagnitude))

    // Debug: Updating vector force

    try {
      // Update vector force for both devices
      // Device 1
      const vectorForce1 = {
        deviceId: 1 as const,
        angle: angleDegrees,
        magnitude: clampedMagnitude,
        frequency: 60, // Use fixed frequency for now
      }
      await HapticService.setVectorForce(vectorForce1)
      setVectorForce(1, vectorForce1)

      // Device 2 (symmetric operation)
      const vectorForce2 = {
        deviceId: 2 as const,
        angle: angleDegrees,
        magnitude: clampedMagnitude,
        frequency: 60, // Use fixed frequency for now
      }
      await HapticService.setVectorForce(vectorForce2)
      setVectorForce(2, vectorForce2)
    } catch (err) {
      console.error('Failed to update vector force:', err)
    }

    // Continue animation
    if (isActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(animateYuragi)
    }
  }, [currentStatus?.preset, setVectorForce])

  // Progress tracking
  useEffect(() => {
    // Debug: Progress tracking effect
    if (isActive && currentStatus?.startTime && currentStatus?.duration) {
      const startTime = new Date(currentStatus.startTime).getTime()
      const duration = currentStatus.duration * 1000 // convert to ms
      startTimeRef.current = startTime
      phaseRef.current = 0 // Reset phase when starting
      // Debug: Starting progress tracking

      progressIntervalRef.current = setInterval(() => {
        const now = Date.now()
        const elapsed = now - startTime
        const newProgress = Math.min((elapsed / duration) * 100, 100)
        // Debug: Progress update

        // Update progress for both devices
        updateYuragiProgress(1, newProgress)
        updateYuragiProgress(2, newProgress)

        // Auto-stop when duration is reached
        if (newProgress >= 100) {
          handleStopRef.current?.()
        }
      }, 100) // Update every 100ms

      // Start YURAGI animation
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

      // Set status for both devices
      setYuragiStatus(1, statusWithStartTime)
      setYuragiStatus(2, statusWithStartTime)
    } catch (err) {
      handleError(err, 'YURAGI Start')
      setError('Failed to start YURAGI massage')
    } finally {
      setIsLoading(false)
    }
  }, [preset, duration, validateDuration, setYuragiStatus, handleError])

  const handleStop = useCallback(async () => {
    try {
      setIsLoading(true)
      setError('')

      const request: IYURAGIRequest = {
        preset,
        duration,
        enabled: false,
      }

      await HapticService.yuragiPreset(request)

      // Clear status from store for both devices
      setYuragiStatus(1, null)
      setYuragiStatus(2, null)

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

      // Clear vector force for both devices
      const clearVectorForce1 = {
        deviceId: 1 as const,
        angle: 0,
        magnitude: 0,
        frequency: 60,
      }
      await HapticService.setVectorForce(clearVectorForce1)
      setVectorForce(1, null)

      const clearVectorForce2 = {
        deviceId: 2 as const,
        angle: 0,
        magnitude: 0,
        frequency: 60,
      }
      await HapticService.setVectorForce(clearVectorForce2)
      setVectorForce(2, null)
    } catch (err) {
      handleError(err, 'YURAGI Stop')
      setError('Failed to stop YURAGI massage')
    } finally {
      setIsLoading(false)
    }
  }, [preset, duration, setYuragiStatus, handleError, setVectorForce])

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
    <div className='yuragi-control' data-testid='yuragi-control'>
      <h3 className='yuragi-control-title'>YURAGI Massage Control</h3>

      <div className='yuragi-control-fields'>
        <div className='input-group'>
          <label htmlFor='yuragi-preset' className='input-label'>
            Preset
          </label>
          <select
            id='yuragi-preset'
            value={preset}
            onChange={e => setPreset(e.target.value as typeof preset)}
            className='input'
            disabled={isActive || isLoading}
          >
            <option value='gentle'>Gentle</option>
            <option value='moderate'>Moderate</option>
            <option value='intense'>Intense</option>
            <option value='therapeutic'>Therapeutic</option>
            <option value='therapeutic_fluctuation'>Therapeutic with Fluctuation</option>
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
          id='yuragi-duration'
        />
      </div>

      {isActive && (
        <div className='yuragi-progress' data-testid='yuragi-progress'>
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
          data-testid={`yuragi-${isActive ? 'stop' : 'start'}-button`}
        >
          {isActive ? 'Stop' : 'Start'} YURAGI
        </Button>
      </div>

      {error && (
        <div className='error-message' role='alert' data-testid='yuragi-error'>
          {error}
        </div>
      )}
    </div>
  )
}

export default YURAGIControl
