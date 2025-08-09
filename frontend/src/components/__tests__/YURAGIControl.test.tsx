import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { YURAGIControl } from '@/components/ControlPanel/YURAGIControl'
import { CONSTRAINTS } from '@/types/hapticTypes'

// Mock all dependencies with stable implementations
vi.mock('@/contexts/hapticStore', () => ({
  useHapticStore: () => ({
    yuragi: {
      device1: null,
      device2: null,
      isActive: false,
    },
    setYuragiStatus: vi.fn(),
    updateYuragiProgress: vi.fn(),
  }),
}))

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: vi.fn(),
  }),
}))

vi.mock('@/services/hapticService', () => ({
  default: {
    yuragiPreset: vi.fn().mockResolvedValue({
      enabled: true,
      preset: 'gentle',
      deviceId: 1,
    }),
  },
}))

describe('YURAGIControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the component with title "YURAGI Massage Control"', () => {
      render(<YURAGIControl />)
      expect(screen.getByText('YURAGI Massage Control')).toBeInTheDocument()
    })

    it('should render preset selector with all options', () => {
      render(<YURAGIControl />)

      const presetSelect = screen.getByLabelText('Preset')
      expect(presetSelect).toBeInTheDocument()

      expect(screen.getByRole('option', { name: 'Gentle' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Moderate' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Intense' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Therapeutic' })).toBeInTheDocument()
    })

    it('should not render device selector (removed from design)', () => {
      render(<YURAGIControl />)

      const deviceSelect = screen.queryByLabelText('Device')
      expect(deviceSelect).not.toBeInTheDocument()
    })

    it('should render duration input with constraints', () => {
      render(<YURAGIControl />)

      const durationInput = screen.getByLabelText('Duration (seconds)')
      expect(durationInput).toBeInTheDocument()
      expect(durationInput).toHaveAttribute('type', 'number')
      expect(durationInput).toHaveAttribute('min', CONSTRAINTS.YURAGI_DURATION.MIN.toString())
      expect(durationInput).toHaveAttribute('max', CONSTRAINTS.YURAGI_DURATION.MAX.toString())
      expect(durationInput).toHaveValue(60) // Default value
    })

    it('should not render enable/disable toggle (removed from design)', () => {
      render(<YURAGIControl />)

      const enableCheckbox = screen.queryByLabelText('Enable YURAGI Control')
      expect(enableCheckbox).not.toBeInTheDocument()
    })
    it('should render start button initially', () => {
      render(<YURAGIControl />)

      const startButton = screen.getByTestId('yuragi-start-button')
      expect(startButton).toBeInTheDocument()
      expect(startButton).toHaveTextContent('Start YURAGI')
      expect(startButton).toBeEnabled() // Start button is always enabled
    })
  })

  describe('Form Interactions', () => {
    it('should update preset selection', async () => {
      const user = userEvent.setup()
      render(<YURAGIControl />)

      const presetSelect = screen.getByLabelText('Preset')
      await user.selectOptions(presetSelect, 'intense')

      expect(presetSelect).toHaveValue('intense')
    })

    it('should validate duration input - below minimum', async () => {
      render(<YURAGIControl />)

      const durationInput = screen.getByLabelText('Duration (seconds)')

      // Simulate typing a value below minimum
      fireEvent.change(durationInput, { target: { value: '10' } })

      // Error message appears in multiple places - check at least one exists
      const errorMessages = screen.getAllByText(
        `Duration must be at least ${CONSTRAINTS.YURAGI_DURATION.MIN} seconds`
      )
      expect(errorMessages.length).toBeGreaterThan(0)
    })

    it('should validate duration input - above maximum', async () => {
      render(<YURAGIControl />)

      const durationInput = screen.getByLabelText('Duration (seconds)')

      // Simulate typing a value above maximum
      fireEvent.change(durationInput, { target: { value: '500' } })

      // Error message appears in multiple places - check at least one exists
      const errorMessages = screen.getAllByText(
        `Duration must not exceed ${CONSTRAINTS.YURAGI_DURATION.MAX} seconds`
      )
      expect(errorMessages.length).toBeGreaterThan(0)
    })

    it('should handle button click interactions', async () => {
      const user = userEvent.setup()
      render(<YURAGIControl />)

      const startButton = screen.getByTestId('yuragi-start-button')
      expect(startButton).toBeEnabled()
      expect(startButton).toHaveTextContent('Start YURAGI')

      // Button should be clickable without needing a toggle
      await user.click(startButton)
    })
  })

  describe('Device Selection', () => {
    it('should control both devices simultaneously (no device selection needed)', () => {
      render(<YURAGIControl />)

      // Device selector should not exist
      const deviceSelect = screen.queryByLabelText('Device')
      expect(deviceSelect).not.toBeInTheDocument()

      // Only one control panel for both devices
      expect(screen.getByTestId('yuragi-control')).toBeInTheDocument()
    })
  })

  describe('Progress Bar', () => {
    it('should not show progress bar when inactive', () => {
      render(<YURAGIControl />)

      expect(screen.queryByTestId('yuragi-progress')).not.toBeInTheDocument()
    })
  })

  describe('Error Display', () => {
    it('should not show error initially', () => {
      render(<YURAGIControl />)

      expect(screen.queryByTestId('yuragi-error')).not.toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should have proper testid attributes', () => {
      render(<YURAGIControl />)

      expect(screen.getByTestId('yuragi-control')).toBeInTheDocument()
      expect(screen.getByTestId('yuragi-start-button')).toBeInTheDocument()
    })

    it('should have proper button variant classes', () => {
      render(<YURAGIControl />)

      const startButton = screen.getByTestId('yuragi-start-button')
      expect(startButton).toHaveClass('button-primary')
    })

    it('should have proper form structure', () => {
      render(<YURAGIControl />)

      expect(screen.getByText('YURAGI Massage Control')).toHaveClass('yuragi-control-title')
      expect(screen.getByTestId('yuragi-control')).toHaveClass('yuragi-control')
    })
  })
})
