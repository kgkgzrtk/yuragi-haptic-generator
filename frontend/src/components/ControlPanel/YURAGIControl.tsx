import React, { useCallback, useState, useEffect, useRef } from 'react'
import { Button } from '@/components/Common/Button'
import { Input } from '@/components/Common/Input'
import { useHapticStore } from '@/contexts/hapticStore'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import HapticService from '@/services/hapticService'
import { CONSTRAINTS } from '@/types/hapticTypes'
import type { IYURAGIRequest, IYURAGIStatus } from '@/types/hapticTypes'

interface YURAGIControlProps {
  deviceId?: 1 | 2
}

export const YURAGIControl: React.FC<YURAGIControlProps> = ({ deviceId = 1 }) => {
  const { yuragi, setYuragiStatus, updateYuragiProgress } = useHapticStore()
  const { handleError } = useErrorHandler()
  
  const [preset, setPreset] = useState<'gentle' | 'moderate' | 'intense' | 'therapeutic'>('gentle')
  const [duration, setDuration] = useState<number>(60)
  const [enabled, setEnabled] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const currentStatus = yuragi[`device${deviceId}`] as IYURAGIStatus | null
  const isActive = currentStatus?.enabled && !!currentStatus?.startTime
  const progress = currentStatus?.progress || 0

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

  // Progress tracking
  useEffect(() => {
    if (isActive && currentStatus?.startTime && currentStatus?.duration) {
      const startTime = new Date(currentStatus.startTime).getTime()
      const duration = currentStatus.duration * 1000 // convert to ms
      
      progressIntervalRef.current = setInterval(() => {
        const now = Date.now()
        const elapsed = now - startTime
        const newProgress = Math.min((elapsed / duration) * 100, 100)
        
        updateYuragiProgress(deviceId, newProgress)
        
        // Auto-stop when duration is reached
        if (newProgress >= 100) {
          handleStop()
        }
      }, 100) // Update every 100ms

      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
      }
    }
  }, [isActive, currentStatus?.startTime, currentStatus?.duration, deviceId, updateYuragiProgress])

  const validateDuration = useCallback((value: number): string => {
    if (value < CONSTRAINTS.YURAGI_DURATION.MIN) {
      return `Duration must be at least ${CONSTRAINTS.YURAGI_DURATION.MIN} seconds`
    }
    if (value > CONSTRAINTS.YURAGI_DURATION.MAX) {
      return `Duration must not exceed ${CONSTRAINTS.YURAGI_DURATION.MAX} seconds`
    }
    return ''
  }, [])

  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0
    setDuration(value)
    const validationError = validateDuration(value)
    setError(validationError)
  }, [validateDuration])

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
      setEnabled(true)

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
      setEnabled(false)

      // Clear timers
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }

    } catch (err) {
      handleError(err, 'YURAGI Stop')
      setError('Failed to stop YURAGI massage')
    } finally {
      setIsLoading(false)
    }
  }, [deviceId, preset, duration, setYuragiStatus, handleError])

  const handleToggle = useCallback(() => {
    if (isActive) {
      handleStop()
    } else {
      handleStart()
    }
  }, [isActive, handleStart, handleStop])

  return (
    <div className="yuragi-control" data-testid={`yuragi-control-${deviceId}`}>
      <h3 className="yuragi-control-title">YURAGI Massage Control</h3>

      <div className="yuragi-control-fields">
        <div className="input-group">
          <label htmlFor={`yuragi-preset-${deviceId}`} className="input-label">
            Preset
          </label>
          <select
            id={`yuragi-preset-${deviceId}`}
            value={preset}
            onChange={(e) => setPreset(e.target.value as typeof preset)}
            className="input"
            disabled={isActive || isLoading}
          >
            <option value="gentle">Gentle</option>
            <option value="moderate">Moderate</option>
            <option value="intense">Intense</option>
            <option value="therapeutic">Therapeutic</option>
          </select>
        </div>

        <div className="input-group">
          <label htmlFor={`yuragi-device-${deviceId}`} className="input-label">
            Device
          </label>
          <select
            id={`yuragi-device-${deviceId}`}
            value={deviceId.toString()}
            onChange={() => {}} // Device selector is controlled via props
            className="input"
            disabled={true} // Device selection handled by parent component
          >
            <option value="1">Device 1</option>
            <option value="2">Device 2</option>
          </select>
        </div>

        <Input
          label="Duration (seconds)"
          type="number"
          value={duration.toString()}
          onChange={handleDurationChange}
          min={CONSTRAINTS.YURAGI_DURATION.MIN}
          max={CONSTRAINTS.YURAGI_DURATION.MAX}
          error={error}
          disabled={isActive || isLoading}
          id={`yuragi-duration-${deviceId}`}
        />

        <div className="input-group">
          <label className="input-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={isLoading}
              style={{ marginRight: '8px' }}
            />
            Enable YURAGI Control
          </label>
        </div>
      </div>

      {isActive && (
        <div className="yuragi-progress" data-testid={`yuragi-progress-${deviceId}`}>
          <div className="progress-label">Progress: {Math.round(progress)}%</div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      <div className="yuragi-control-actions">
        <Button
          onClick={handleToggle}
          loading={isLoading}
          disabled={!enabled && !isActive}
          variant={isActive ? 'danger' : 'primary'}
          data-testid={`yuragi-${isActive ? 'stop' : 'start'}-button-${deviceId}`}
        >
          {isActive ? 'Stop' : 'Start'} YURAGI
        </Button>
      </div>

      {error && (
        <div className="error-message" role="alert" data-testid={`yuragi-error-${deviceId}`}>
          {error}
        </div>
      )}
    </div>
  )
}

export default YURAGIControl