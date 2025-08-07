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

  // Predefined colors - diverse palette for better distinction
  const presetColors = [
    // Primary distinguishable colors
    '#13ae4b', // Primary green
    '#ff6b6b', // Coral red
    '#4ecdc4', // Teal cyan
    '#ffa726', // Orange
    // Additional contrasting colors
    '#845ec2', // Purple
    '#4e78a0', // Blue
    '#f9ca24', // Yellow
    '#e91e63', // Pink
    // Green variations
    '#0bdc84', // Bright green
    '#2d6a4f', // Forest green
    '#52b788', // Medium green
    '#95d5b2', // Seafoam
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
      <label className="color-picker-label" htmlFor={`color-${label}`}>
        {label}
      </label>
      <div className="color-picker-input-group" ref={containerRef}>
        <button
          type="button"
          className="color-picker-swatch"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          style={{ backgroundColor: value }}
          aria-label={`Select color for ${label}`}
        >
          <span className="color-picker-swatch-inner" style={{ backgroundColor: value }} />
        </button>
        <input
          ref={inputRef}
          type="text"
          id={`color-${label}`}
          className="color-picker-input"
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder="#000000"
          pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
        />
        {isOpen && (
          <div className="color-picker-dropdown">
            <div className="color-picker-presets">
              <p className="color-picker-presets-title">Preset Colors</p>
              <div className="color-picker-presets-grid">
                {presetColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`color-picker-preset ${value === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                    aria-label={`Select color ${color}`}
                    title={color}
                  />
                ))}
              </div>
            </div>
            <div className="color-picker-custom">
              <p className="color-picker-custom-title">Custom Color</p>
              <input
                type="color"
                value={value}
                onChange={e => handleColorChange(e.target.value)}
                className="color-picker-native"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ColorPicker
