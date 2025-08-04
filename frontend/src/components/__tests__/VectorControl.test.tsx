import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVectorForceManagement } from '@/hooks/queries/useVectorForceQuery'
import { useHapticErrorHandler } from '@/hooks/useErrorHandler'
import { render, screen, waitFor } from '@/test/test-utils'
import { CONSTRAINTS } from '@/types/hapticTypes'
import type { IVectorForce } from '@/types/hapticTypes'
import { VectorControl } from '../ControlPanel/VectorControl'

// Mock the hooks
vi.mock('@/hooks/queries/useVectorForceQuery')
vi.mock('@/hooks/useErrorHandler')

describe('VectorControl', () => {
  const mockVectorForce: IVectorForce = {
    deviceId: 1,
    angle: 45,
    magnitude: 0.8,
    frequency: 100,
  }

  const defaultProps = {
    deviceId: 1 as const,
  }

  const mockSetVectorForce = vi.fn()
  const mockClearVectorForce = vi.fn()
  const mockValidateVectorForce = vi.fn()
  const mockApplyPreset = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useVectorForceManagement).mockReturnValue({
      vectorForce: null,
      hasVectorForce: false,
      isUpdating: false,
      updateError: null,
      setVectorForce: mockSetVectorForce,
      clearVectorForce: mockClearVectorForce,
      validateVectorForce: mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} }),
      presets: {
        north: { angle: 90, magnitude: 0.5, frequency: 80 },
        gentle: { angle: 45, magnitude: 0.3, frequency: 60 },
      },
      applyPreset: mockApplyPreset,
      isApplyingPreset: false,
      isLoading: false,
      error: null,
      isError: false,
      refetch: vi.fn(),
    })

    vi.mocked(useHapticErrorHandler).mockReturnValue({
      handleParameterError: vi.fn(),
      handleVectorForceError: vi.fn(),
      handleStreamingError: vi.fn(),
      handleConnectionError: vi.fn(),
    })
  })

  describe('Rendering', () => {
    it('renders with correct device information', () => {
      render(<VectorControl {...defaultProps} />)

      expect(screen.getByText('Device 1 Vector Force')).toBeInTheDocument()
      expect(screen.getByTestId('vector-control-1')).toBeInTheDocument()
    })

    it('renders all input fields with default values', () => {
      render(<VectorControl {...defaultProps} />)

      // Check angle input
      const angleInput = screen.getByLabelText('Angle (degrees)')
      expect(angleInput).toHaveValue(0)
      expect(angleInput).toHaveAttribute('min', '0')
      expect(angleInput).toHaveAttribute('max', '360')

      // Check magnitude input
      const magnitudeInput = screen.getByLabelText('Magnitude')
      expect(magnitudeInput).toHaveValue(0)
      expect(magnitudeInput).toHaveAttribute('min', '0')
      expect(magnitudeInput).toHaveAttribute('max', '1')

      // Check frequency input
      const frequencyInput = screen.getByLabelText('Frequency (Hz)')
      expect(frequencyInput).toHaveValue(60)
      expect(frequencyInput).toHaveAttribute('min', CONSTRAINTS.VECTOR_FREQUENCY.MIN.toString())
      expect(frequencyInput).toHaveAttribute('max', CONSTRAINTS.VECTOR_FREQUENCY.MAX.toString())
    })

    it('renders vector visualization SVG', () => {
      render(<VectorControl {...defaultProps} />)

      const svg = screen.getByRole('img', { hidden: true }) // SVG elements have img role
      expect(svg).toBeInTheDocument()
    })

    it('renders Apply and Clear buttons', () => {
      render(<VectorControl {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })
  })

  describe('State Synchronization', () => {
    it('syncs input values with vector force from store', () => {
      vi.mocked(useVectorForceManagement).mockReturnValue({
        vectorForce: mockVectorForce,
        hasVectorForce: true,
        isUpdating: false,
        updateError: null,
        setVectorForce: mockSetVectorForce,
        clearVectorForce: mockClearVectorForce,
        validateVectorForce: mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} }),
        presets: {},
        applyPreset: mockApplyPreset,
        isApplyingPreset: false,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      })

      render(<VectorControl {...defaultProps} />)

      expect(screen.getByLabelText('Angle (degrees)')).toHaveValue(45)
      expect(screen.getByLabelText('Magnitude')).toHaveValue(0.8)
      expect(screen.getByLabelText('Frequency (Hz)')).toHaveValue(100)
    })
  })

  describe('User Interactions', () => {
    const user = userEvent.setup()

    it('updates angle input', async () => {
      render(<VectorControl {...defaultProps} />)

      const angleInput = screen.getByLabelText('Angle (degrees)')

      await user.clear(angleInput)
      await user.type(angleInput, '90')

      expect(angleInput).toHaveValue(90)
    })

    it('updates magnitude input', async () => {
      render(<VectorControl {...defaultProps} />)

      const magnitudeInput = screen.getByLabelText('Magnitude')

      await user.clear(magnitudeInput)
      await user.type(magnitudeInput, '0.7')

      expect(magnitudeInput).toHaveValue(0.7)
    })

    it('updates frequency input', async () => {
      render(<VectorControl {...defaultProps} />)

      const frequencyInput = screen.getByLabelText('Frequency (Hz)')

      await user.clear(frequencyInput)
      await user.type(frequencyInput, '80')

      expect(frequencyInput).toHaveValue(80)
    })

    it('calls setVectorForce when Apply button is clicked with valid inputs', async () => {
      mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} })

      render(<VectorControl {...defaultProps} />)

      // Set some values
      const angleInput = screen.getByLabelText('Angle (degrees)')
      const magnitudeInput = screen.getByLabelText('Magnitude')
      const frequencyInput = screen.getByLabelText('Frequency (Hz)')

      await user.clear(angleInput)
      await user.type(angleInput, '90')
      await user.clear(magnitudeInput)
      await user.type(magnitudeInput, '0.5')
      await user.clear(frequencyInput)
      await user.type(frequencyInput, '80')

      const applyButton = screen.getByRole('button', { name: 'Apply' })
      await user.click(applyButton)

      await waitFor(() => {
        expect(mockSetVectorForce).toHaveBeenCalledWith({
          angle: 90,
          magnitude: 0.5,
          frequency: 80,
        })
      })
    })

    it('does not call setVectorForce when validation fails', async () => {
      mockValidateVectorForce.mockReturnValue({
        isValid: false,
        errors: { angle: 'Invalid angle' },
      })

      render(<VectorControl {...defaultProps} />)

      const applyButton = screen.getByRole('button', { name: 'Apply' })
      await user.click(applyButton)

      expect(mockSetVectorForce).not.toHaveBeenCalled()
    })

    it('calls clearVectorForce when Clear button is clicked', async () => {
      render(<VectorControl {...defaultProps} />)

      const clearButton = screen.getByRole('button', { name: 'Clear' })
      await user.click(clearButton)

      await waitFor(() => {
        expect(mockClearVectorForce).toHaveBeenCalled()
      })
    })

    it('resets local state when Clear button is clicked', async () => {
      render(<VectorControl {...defaultProps} />)

      // Set some values first
      const angleInput = screen.getByLabelText('Angle (degrees)')
      const magnitudeInput = screen.getByLabelText('Magnitude')
      const frequencyInput = screen.getByLabelText('Frequency (Hz)')

      await user.clear(angleInput)
      await user.type(angleInput, '90')
      await user.clear(magnitudeInput)
      await user.type(magnitudeInput, '0.5')

      const clearButton = screen.getByRole('button', { name: 'Clear' })
      await user.click(clearButton)

      // Should reset to default values
      await waitFor(() => {
        expect(angleInput).toHaveValue(0)
        expect(magnitudeInput).toHaveValue(0)
        expect(frequencyInput).toHaveValue(60)
      })
    })
  })

  describe('Vector Visualization', () => {
    it('updates vector visualization based on input values', async () => {
      const user = userEvent.setup()
      render(<VectorControl {...defaultProps} />)

      const angleInput = screen.getByLabelText('Angle (degrees)')
      const magnitudeInput = screen.getByLabelText('Magnitude')

      await user.clear(angleInput)
      await user.type(angleInput, '90') // North direction
      await user.clear(magnitudeInput)
      await user.type(magnitudeInput, '1') // Full magnitude

      // Check SVG line element for vector representation
      const vectorLine = screen
        .getByRole('img', { hidden: true })
        .querySelector('line[stroke="#007bff"]')
      expect(vectorLine).toBeInTheDocument()
    })

    it('shows vector at correct position for different angles', () => {
      vi.mocked(useVectorForceManagement).mockReturnValue({
        vectorForce: { ...mockVectorForce, angle: 0, magnitude: 1 }, // East direction, full magnitude
        hasVectorForce: true,
        isUpdating: false,
        updateError: null,
        setVectorForce: mockSetVectorForce,
        clearVectorForce: mockClearVectorForce,
        validateVectorForce: mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} }),
        presets: {},
        applyPreset: mockApplyPreset,
        isApplyingPreset: false,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      })

      render(<VectorControl {...defaultProps} />)

      const vectorLine = screen
        .getByRole('img', { hidden: true })
        .querySelector('line[stroke="#007bff"]')
      expect(vectorLine).toHaveAttribute('x2', '50') // Should point to the right (east)
      expect(vectorLine).toHaveAttribute('y2', '0')
    })
  })

  describe('Validation and Error Handling', () => {
    it('shows validation errors for invalid inputs', () => {
      mockValidateVectorForce.mockReturnValue({
        isValid: false,
        errors: {
          angle: 'Angle must be between 0-360 degrees',
          magnitude: 'Magnitude must be between 0-1',
          frequency: 'Frequency must be between 40-120 Hz',
        },
      })

      render(<VectorControl {...defaultProps} />)

      expect(screen.getByText('Angle must be between 0-360 degrees')).toBeInTheDocument()
      expect(screen.getByText('Magnitude must be between 0-1')).toBeInTheDocument()
      expect(screen.getByText('Frequency must be between 40-120 Hz')).toBeInTheDocument()
    })

    it('calls error handler when update error occurs', async () => {
      const mockHandleVectorForceError = vi.fn()
      vi.mocked(useHapticErrorHandler).mockReturnValue({
        handleVectorForceError: mockHandleVectorForceError,
      })

      const updateError = new Error('Update failed')
      vi.mocked(useVectorForceManagement).mockReturnValue({
        vectorForce: null,
        hasVectorForce: false,
        isUpdating: false,
        updateError,
        setVectorForce: mockSetVectorForce,
        clearVectorForce: mockClearVectorForce,
        validateVectorForce: mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} }),
        presets: {},
        applyPreset: mockApplyPreset,
        isApplyingPreset: false,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      })

      render(<VectorControl {...defaultProps} />)

      await waitFor(() => {
        expect(mockHandleVectorForceError).toHaveBeenCalledWith(updateError, 1)
      })
    })
  })

  describe('Loading States', () => {
    it('disables inputs when updating', () => {
      vi.mocked(useVectorForceManagement).mockReturnValue({
        vectorForce: null,
        hasVectorForce: false,
        isUpdating: true,
        updateError: null,
        setVectorForce: mockSetVectorForce,
        clearVectorForce: mockClearVectorForce,
        validateVectorForce: mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} }),
        presets: {},
        applyPreset: mockApplyPreset,
        isApplyingPreset: false,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      })

      render(<VectorControl {...defaultProps} />)

      expect(screen.getByLabelText('Angle (degrees)')).toBeDisabled()
      expect(screen.getByLabelText('Magnitude')).toBeDisabled()
      expect(screen.getByLabelText('Frequency (Hz)')).toBeDisabled()
    })

    it('disables inputs when applying preset', () => {
      vi.mocked(useVectorForceManagement).mockReturnValue({
        vectorForce: null,
        hasVectorForce: false,
        isUpdating: false,
        updateError: null,
        setVectorForce: mockSetVectorForce,
        clearVectorForce: mockClearVectorForce,
        validateVectorForce: mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} }),
        presets: {},
        applyPreset: mockApplyPreset,
        isApplyingPreset: true,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      })

      render(<VectorControl {...defaultProps} />)

      expect(screen.getByLabelText('Angle (degrees)')).toBeDisabled()
      expect(screen.getByLabelText('Magnitude')).toBeDisabled()
      expect(screen.getByLabelText('Frequency (Hz)')).toBeDisabled()
    })

    it('shows loading state on Apply button when updating', () => {
      vi.mocked(useVectorForceManagement).mockReturnValue({
        vectorForce: null,
        hasVectorForce: false,
        isUpdating: true,
        updateError: null,
        setVectorForce: mockSetVectorForce,
        clearVectorForce: mockClearVectorForce,
        validateVectorForce: mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} }),
        presets: {},
        applyPreset: mockApplyPreset,
        isApplyingPreset: false,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      })

      render(<VectorControl {...defaultProps} />)

      const applyButton = screen.getByRole('button', { name: 'Apply' })
      expect(applyButton).toBeDisabled() // Button should be disabled when loading
    })

    it('shows loading state on Clear button when updating', () => {
      vi.mocked(useVectorForceManagement).mockReturnValue({
        vectorForce: null,
        hasVectorForce: false,
        isUpdating: true,
        updateError: null,
        setVectorForce: mockSetVectorForce,
        clearVectorForce: mockClearVectorForce,
        validateVectorForce: mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} }),
        presets: {},
        applyPreset: mockApplyPreset,
        isApplyingPreset: false,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      })

      render(<VectorControl {...defaultProps} />)

      const clearButton = screen.getByRole('button', { name: 'Clear' })
      expect(clearButton).toBeDisabled() // Button should be disabled when loading
    })
  })

  describe('Device ID Props', () => {
    it('renders correctly for device 2', () => {
      render(<VectorControl deviceId={2} />)

      expect(screen.getByText('Device 2 Vector Force')).toBeInTheDocument()
      expect(screen.getByTestId('vector-control-2')).toBeInTheDocument()
    })

    it('passes correct device ID to hook', () => {
      render(<VectorControl deviceId={2} />)

      expect(useVectorForceManagement).toHaveBeenCalledWith(2)
    })
  })

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<VectorControl {...defaultProps} />)

      expect(screen.getByLabelText('Angle (degrees)')).toBeInTheDocument()
      expect(screen.getByLabelText('Magnitude')).toBeInTheDocument()
      expect(screen.getByLabelText('Frequency (Hz)')).toBeInTheDocument()
    })

    it('has proper ARIA attributes for error states', () => {
      mockValidateVectorForce.mockReturnValue({
        isValid: false,
        errors: { angle: 'Invalid angle' },
      })

      render(<VectorControl {...defaultProps} />)

      const angleInput = screen.getByLabelText('Angle (degrees)')
      expect(angleInput).toHaveAttribute('aria-invalid', 'true')
    })

    it('has proper button labeling', () => {
      render(<VectorControl {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })
  })
})
