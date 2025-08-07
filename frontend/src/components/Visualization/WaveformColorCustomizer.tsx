import React from 'react'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import { ColorPicker } from '@/components/Common/ColorPicker'
import './WaveformColorCustomizer.css'

export interface WaveformColors {
  [CHANNEL_IDS.DEVICE1_X]: string
  [CHANNEL_IDS.DEVICE1_Y]: string
  [CHANNEL_IDS.DEVICE2_X]: string
  [CHANNEL_IDS.DEVICE2_Y]: string
  [channelId: number]: string // Allow number indexing
}

interface WaveformColorizerProps {
  colors: WaveformColors
  onColorsChange: (colors: WaveformColors) => void
  className?: string
  isOpen?: boolean
  onToggle?: () => void
}

export const WaveformColorCustomizer: React.FC<WaveformColorizerProps> = ({
  colors,
  onColorsChange,
  className = '',
  isOpen = true,
  onToggle,
}) => {
  const handleColorChange = (channelId: number, color: string) => {
    onColorsChange({
      ...colors,
      [channelId]: color,
    })
  }

  const resetToDefaults = () => {
    onColorsChange({
      [CHANNEL_IDS.DEVICE1_X]: '#13ae4b', // Primary green
      [CHANNEL_IDS.DEVICE1_Y]: '#0bdc84', // Bright accent green
      [CHANNEL_IDS.DEVICE2_X]: '#039555', // Success green
      [CHANNEL_IDS.DEVICE2_Y]: '#c4dc34', // Yellow-green
    })
  }

  const channelLabels = {
    [CHANNEL_IDS.DEVICE1_X]: 'Device 1 - X Axis',
    [CHANNEL_IDS.DEVICE1_Y]: 'Device 1 - Y Axis',
    [CHANNEL_IDS.DEVICE2_X]: 'Device 2 - X Axis',
    [CHANNEL_IDS.DEVICE2_Y]: 'Device 2 - Y Axis',
  }

  return (
    <div className={`waveform-color-customizer ${className}`}>
      <div className="waveform-color-customizer-header">
        <h3 className="waveform-color-customizer-title">
          Waveform Colors
        </h3>
        {onToggle && (
          <button
            type="button"
            className="waveform-color-customizer-toggle"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Hide color customizer' : 'Show color customizer'}
          >
            {isOpen ? '−' : '+'}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="waveform-color-customizer-content">
          <div className="waveform-color-grid">
            {Object.entries(channelLabels).map(([channelIdStr, label]) => {
              const channelId = parseInt(channelIdStr, 10)
              return (
                <ColorPicker
                  key={channelId}
                  label={label}
                  value={colors[channelId]}
                  onChange={color => handleColorChange(channelId, color)}
                  className="waveform-color-picker"
                />
              )
            })}
          </div>

          <div className="waveform-color-customizer-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={resetToDefaults}
            >
              Reset to Defaults
            </button>
          </div>

          <div className="waveform-color-preview">
            <p className="waveform-color-preview-title">Preview</p>
            <div className="waveform-color-preview-bars">
              {Object.entries(channelLabels).map(([channelIdStr, label]) => {
                const channelId = parseInt(channelIdStr, 10)
                return (
                  <div key={channelId} className="waveform-color-preview-bar">
                    <div
                      className="waveform-color-preview-swatch"
                      style={{ backgroundColor: colors[channelId] }}
                    />
                    <span className="waveform-color-preview-label">
                      {label.split(' - ')[1] || label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WaveformColorCustomizer
