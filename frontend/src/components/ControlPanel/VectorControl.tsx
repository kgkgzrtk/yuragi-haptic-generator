import React, { useCallback, useState, useEffect } from 'react'
import { Button } from '@/components/Common/Button'
import { Slider } from '@/components/Common/Slider'
import { useVectorForceManagement } from '@/hooks/queries/useVectorForceQuery'
import { useHapticErrorHandler } from '@/hooks/useErrorHandler'
import { CONSTRAINTS } from '@/types/hapticTypes'
import type { IVectorForce } from '@/types/hapticTypes'

interface VectorControlProps {
  deviceId: 1 | 2
}

export const VectorControl: React.FC<VectorControlProps> = ({ deviceId }) => {
  const {
    vectorForce,
    isUpdating,
    updateError,
    setVectorForce,
    clearVectorForce,
    validateVectorForce,
    isApplyingPreset,
  } = useVectorForceManagement(deviceId)

  const { handleVectorForceError } = useHapticErrorHandler()

  const [angle, setAngle] = useState<number>(vectorForce?.angle || 0)
  const [magnitude, setMagnitude] = useState<number>(vectorForce?.magnitude || 0)
  const [frequency, setFrequency] = useState<number>(vectorForce?.frequency || 60)
  const [errors, setErrors] = useState<Partial<Record<keyof IVectorForce, string>>>({})

  // Sync local state with store when vector force changes
  useEffect(() => {
    if (vectorForce) {
      setAngle(vectorForce.angle)
      setMagnitude(vectorForce.magnitude)
      setFrequency(vectorForce.frequency)
    }
  }, [vectorForce])

  // Handle errors from mutations
  useEffect(() => {
    if (updateError) {
      handleVectorForceError(updateError, deviceId)
    }
  }, [updateError, handleVectorForceError, deviceId])

  // Validate on mount and when values change
  useEffect(() => {
    const { errors: validationErrors } = validateVectorForce({
      angle,
      magnitude,
      frequency,
    })
    setErrors(validationErrors)
  }, [angle, magnitude, frequency, validateVectorForce])

  // Validate input
  const validate = useCallback((): boolean => {
    const { isValid, errors: validationErrors } = validateVectorForce({
      angle,
      magnitude,
      frequency,
    })

    setErrors(validationErrors)
    return isValid
  }, [angle, magnitude, frequency, validateVectorForce])

  // Apply vector force with optimistic updates
  const handleApply = useCallback(async () => {
    if (!validate()) {
      return
    }

    try {
      await setVectorForce({ angle, magnitude, frequency })
    } catch (error) {
      // Error handling is done in the hook
      console.info('Failed to apply vector force:', error)
    }
  }, [angle, magnitude, frequency, validate, setVectorForce])

  // Clear vector force with optimistic updates
  const handleClear = useCallback(async () => {
    try {
      await clearVectorForce()
      setAngle(0)
      setMagnitude(0)
      setFrequency(60)
    } catch (error) {
      // Error handling is done in the hook
      console.info('Failed to clear vector force:', error)
    }
  }, [clearVectorForce])

  // Visualize vector
  const vectorX = Math.cos((angle * Math.PI) / 180) * magnitude * 50
  const vectorY = -Math.sin((angle * Math.PI) / 180) * magnitude * 50 // Negative for correct display

  return (
    <div className='vector-control' data-testid={`vector-control-${deviceId}`}>
      <h3 className='vector-control-title'>Device {deviceId} Vector Force</h3>

      <div className='vector-control-visualization'>
        <svg
          width='120'
          height='120'
          viewBox='-60 -60 120 120'
          role='img'
          aria-label='Vector force visualization'
        >
          {/* Grid */}
          <line x1='-50' y1='0' x2='50' y2='0' stroke='#ddd' strokeWidth='1' />
          <line x1='0' y1='-50' x2='0' y2='50' stroke='#ddd' strokeWidth='1' />

          {/* Vector */}
          <line
            x1='0'
            y1='0'
            x2={vectorX}
            y2={vectorY}
            stroke='#007bff'
            strokeWidth='3'
            markerEnd='url(#arrowhead)'
          />

          {/* Arrowhead marker */}
          <defs>
            <marker
              id='arrowhead'
              markerWidth='10'
              markerHeight='7'
              refX='9'
              refY='3.5'
              orient='auto'
            >
              <polygon points='0 0, 10 3.5, 0 7' fill='#007bff' />
            </marker>
          </defs>

          {/* Center dot */}
          <circle cx='0' cy='0' r='3' fill='#333' />
        </svg>
      </div>

      <div className='vector-control-fields'>
        <Slider
          label='Angle'
          value={angle}
          onChange={setAngle}
          min={0}
          max={360}
          step={1}
          unit='°'
          error={errors.angle}
          disabled={isUpdating || isApplyingPreset}
        />

        <Slider
          label='Magnitude'
          value={magnitude}
          onChange={setMagnitude}
          min={0}
          max={1}
          step={0.01}
          error={errors.magnitude}
          disabled={isUpdating || isApplyingPreset}
        />

        <Slider
          label='Frequency'
          value={frequency}
          onChange={setFrequency}
          min={CONSTRAINTS.VECTOR_FREQUENCY.MIN}
          max={CONSTRAINTS.VECTOR_FREQUENCY.MAX}
          step={1}
          unit='Hz'
          error={errors.frequency}
          disabled={isUpdating || isApplyingPreset}
        />
      </div>

      <div className='vector-control-actions'>
        <Button onClick={handleApply} loading={isUpdating || isApplyingPreset} variant='primary'>
          Apply
        </Button>
        <Button onClick={handleClear} loading={isUpdating || isApplyingPreset} variant='secondary'>
          Clear
        </Button>
      </div>
    </div>
  )
}

export default VectorControl
