import React, { useState, useRef, useEffect } from 'react'
import './ColorPicker.css'

interface ColorPickerProps {
  label: string
  value: string
  onChange: (color: string) => void
  disabled?: boolean
  className?: string
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Predefined colors - relaxing low-saturation palette
  const presetColors = [
    // Primary palette - muted earth tones
    '#CAA3A8', // Dusty rose
    '#94B894', // Sage grey
    '#D6CCC2', // Warm beige
    '#BFB3CC', // Soft lavender grey
    // Additional calming colors
    '#B8C5D6', // Misty blue
    '#D4C5B9', // Sand
    '#C7B299', // Taupe
    '#E6D7CF', // Pale blush
    // Subtle variations
    '#A8B8A8', // Eucalyptus
    '#D9C6BA', // Nude
    '#C9B5C4', // Mauve
    '#B0C4C4', // Seafoam grey
  ]

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleColorChange = (color: string) => {
    onChange(color)
    setIsOpen(false)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  return (
    <div className={`color-picker-container ${className}`}>
      <label className='color-picker-label' htmlFor={`color-${label}`}>
        {label}
      </label>
      <div className='color-picker-input-group' ref={containerRef}>
        <button
          type='button'
          className='color-picker-swatch'
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          style={{ backgroundColor: value }}
          aria-label={`Select color for ${label}`}
        >
          <span className='color-picker-swatch-inner' style={{ backgroundColor: value }} />
        </button>
        <input
          ref={inputRef}
          type='text'
          id={`color-${label}`}
          className='color-picker-input'
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder='#000000'
          pattern='^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
        />
        {isOpen && (
          <div className='color-picker-dropdown'>
            <div className='color-picker-presets'>
              <p className='color-picker-presets-title'>Preset Colors</p>
              <div className='color-picker-presets-grid'>
                {presetColors.map(color => (
                  <button
                    key={color}
                    type='button'
                    className={`color-picker-preset ${value === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                    aria-label={`Select color ${color}`}
                    title={color}
                  />
                ))}
              </div>
            </div>
            <div className='color-picker-custom'>
              <p className='color-picker-custom-title'>Custom Color</p>
              <input
                type='color'
                value={value}
                onChange={e => handleColorChange(e.target.value)}
                className='color-picker-native'
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ColorPicker
