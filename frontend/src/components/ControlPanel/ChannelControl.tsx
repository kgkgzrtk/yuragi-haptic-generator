import React, { useCallback, useState, useEffect } from 'react'
import { Slider } from '@/components/Common/Slider'
import { useHapticStore } from '@/contexts/hapticStore'
import {
  useParameterManagement,
  useBatchParameterUpdates,
} from '@/hooks/queries/useParametersQuery'
import { useHapticErrorHandler } from '@/hooks/useErrorHandler'
import { CONSTRAINTS } from '@/types/hapticTypes'
import type { IChannelParameters } from '@/types/hapticTypes'

interface ChannelControlProps {
  channelId: number
  label: string
}

export const ChannelControl: React.FC<ChannelControlProps> = ({ channelId, label }) => {
  const channel = useHapticStore(state => state.channels.find(ch => ch.channelId === channelId))
  const { isUpdating, updateError } = useParameterManagement()
  const { batchUpdate, hasPendingUpdates, clearPending } = useBatchParameterUpdates(300) // 300ms debounce
  const { handleParameterError } = useHapticErrorHandler()

  const [errors, setErrors] = useState<Partial<Record<keyof IChannelParameters, string>>>({})

  // Local state for input values
  const [frequency, setFrequency] = useState(channel?.frequency || 60)
  const [amplitude, setAmplitude] = useState(channel?.amplitude || 0.5)
  const [phase, setPhase] = useState(channel?.phase || 90)
  const [polarity, setPolarity] = useState(channel?.polarity || true)

  // Sync local state with store when channel changes
  useEffect(() => {
    if (channel) {
      setFrequency(channel.frequency)
      setAmplitude(channel.amplitude)
      setPhase(channel.phase)
      setPolarity(channel.polarity)
    }
  }, [channel])

  // Handle errors from mutations
  useEffect(() => {
    if (updateError) {
      handleParameterError(updateError, channelId)
    }
  }, [updateError, handleParameterError, channelId])

  // Cleanup pending updates on unmount
  useEffect(() => {
    return () => {
      clearPending()
    }
  }, [clearPending])

  // Validate input
  const validateField = useCallback(
    (field: keyof IChannelParameters, value: unknown): string | null => {
      // Handle NaN values (from empty inputs)
      if (typeof value === 'number' && isNaN(value)) {
        return null // Don't show error for empty inputs
      }

      switch (field) {
        case 'frequency':
          if (value < CONSTRAINTS.FREQUENCY.MIN || value > CONSTRAINTS.FREQUENCY.MAX) {
            return `Frequency must be between ${CONSTRAINTS.FREQUENCY.MIN}-${CONSTRAINTS.FREQUENCY.MAX} Hz`
          }
          break
        case 'amplitude':
          if (value < CONSTRAINTS.AMPLITUDE.MIN || value > CONSTRAINTS.AMPLITUDE.MAX) {
            return `Amplitude must be between ${CONSTRAINTS.AMPLITUDE.MIN}-${CONSTRAINTS.AMPLITUDE.MAX}`
          }
          break
        case 'phase':
          if (value < CONSTRAINTS.PHASE.MIN || value > CONSTRAINTS.PHASE.MAX) {
            return `Phase must be between ${CONSTRAINTS.PHASE.MIN}-${CONSTRAINTS.PHASE.MAX} degrees`
          }
          break
      }
      return null
    },
    []
  )

  // Handle field change with optimistic updates and batching
  const handleFieldChange = useCallback(
    (field: keyof IChannelParameters, value: unknown) => {
      // Update local state immediately
      switch (field) {
        case 'frequency':
          setFrequency(value)
          break
        case 'amplitude':
          setAmplitude(value)
          break
        case 'phase':
          setPhase(value)
          break
        case 'polarity':
          setPolarity(value)
          break
      }

      // Only validate and send updates for non-NaN numeric values
      if (field !== 'polarity' && (typeof value !== 'number' || isNaN(value))) {
        setErrors(prev => ({ ...prev, [field]: undefined }))
        return
      }

      const error = validateField(field, value)
      setErrors(prev => ({ ...prev, [field]: error || undefined }))

      if (!error) {
        // Use batch updates for better performance
        batchUpdate(channelId, { [field]: value })
      }
    },
    [channelId, validateField, batchUpdate]
  )

  if (!channel) {
    return <div>Channel not found</div>
  }

  return (
    <div className='channel-control' data-testid={`channel-control-${channelId}`}>
      <h3 className='channel-control-title'>{label}</h3>

      <div className='channel-control-fields'>
        <Slider
          label='Frequency'
          value={frequency}
          onChange={value => handleFieldChange('frequency', value)}
          min={CONSTRAINTS.FREQUENCY.MIN}
          max={CONSTRAINTS.FREQUENCY.MAX}
          step={1}
          unit='Hz'
          error={errors.frequency}
          disabled={isUpdating || hasPendingUpdates}
        />

        <Slider
          label='Amplitude'
          value={amplitude}
          onChange={value => handleFieldChange('amplitude', value)}
          min={CONSTRAINTS.AMPLITUDE.MIN}
          max={CONSTRAINTS.AMPLITUDE.MAX}
          step={0.01}
          error={errors.amplitude}
          disabled={isUpdating || hasPendingUpdates}
        />

        <Slider
          label='Phase'
          value={phase}
          onChange={value => handleFieldChange('phase', value)}
          min={CONSTRAINTS.PHASE.MIN}
          max={CONSTRAINTS.PHASE.MAX}
          step={1}
          unit='°'
          error={errors.phase}
          disabled={isUpdating || hasPendingUpdates}
        />

        <div className='channel-control-polarity'>
          <label className='checkbox-label'>
            <input
              type='checkbox'
              checked={polarity}
              onChange={e => handleFieldChange('polarity', e.target.checked)}
              disabled={isUpdating || hasPendingUpdates}
            />
            <span>Ascending waveform</span>
          </label>
        </div>
      </div>

      {(isUpdating || hasPendingUpdates) && (
        <div className='channel-control-status'>
          {hasPendingUpdates ? 'Pending updates...' : 'Updating...'}
        </div>
      )}

      {updateError && (
        <div className='channel-control-error'>Failed to update channel parameters</div>
      )}
    </div>
  )
}

export default ChannelControl
