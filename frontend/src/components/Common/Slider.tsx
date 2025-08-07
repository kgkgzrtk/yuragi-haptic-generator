import React from 'react'
import './Slider.css'

interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  error?: string
  showValue?: boolean
  showMinMax?: boolean
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  disabled = false,
  error,
  showValue = true,
  showMinMax = true,
}) => {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div
      className={`slider-container ${error ? 'slider-error' : ''} ${disabled ? 'slider-disabled' : ''}`}
    >
      <div className='slider-header'>
        <label className='slider-label'>{label}</label>
        {showValue && (
          <span className='slider-value'>
            {value.toFixed(step < 1 ? 2 : 0)} {unit}
          </span>
        )}
      </div>

      <div className='slider-wrapper'>
        {showMinMax && <span className='slider-min'>{min}</span>}

        <div className='slider-track-container'>
          <input
            type='range'
            className='slider-input'
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            style={{
              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${percentage}%, #e0e0e0 ${percentage}%, #e0e0e0 100%)`,
            }}
          />
        </div>

        {showMinMax && <span className='slider-max'>{max}</span>}
      </div>

      {error && <span className='slider-error-message'>{error}</span>}
    </div>
  )
}

export default Slider
