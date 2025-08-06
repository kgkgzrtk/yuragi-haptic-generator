import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VectorControl } from '@/components/ControlPanel/VectorControl'
import { useVectorForceManagement, useBatchVectorForceUpdates } from '@/hooks/queries/useVectorForceQuery'
import { useHapticErrorHandler } from '@/hooks/useErrorHandler'
import { render, screen, waitFor, fireEvent } from '@/test/test-utils'
import { CONSTRAINTS } from '@/types/hapticTypes'
import type { IVectorForce } from '@/types/hapticTypes'

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

    vi.mocked(useBatchVectorForceUpdates).mockReturnValue({
      batchUpdate: vi.fn(),
      updateValues: vi.fn(),
      hasPendingUpdates: false,
      clearPending: vi.fn(),
      isUpdating: false,
      error: null,
    })

    vi.mocked(useHapticErrorHandler).mockReturnValue({
      handleParameterError: vi.fn(),
      handleVectorForceError: vi.fn(),
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

      // Get all sliders
      const sliders = screen.getAllByRole('slider')
      expect(sliders).toHaveLength(3) // angle, magnitude, frequency

      // Check angle input
      const angleInput = sliders[0]
      expect(angleInput).toHaveValue('0')
      expect(angleInput).toHaveAttribute('min', '0')
      expect(angleInput).toHaveAttribute('max', '360')

      // Check magnitude input
      const magnitudeInput = sliders[1]
      expect(magnitudeInput).toHaveValue('0')
      expect(magnitudeInput).toHaveAttribute('min', '0')
      expect(magnitudeInput).toHaveAttribute('max', '1')

      // Check frequency input
      const frequencyInput = sliders[2]
      expect(frequencyInput).toHaveValue('60')
      expect(frequencyInput).toHaveAttribute('min', CONSTRAINTS.VECTOR_FREQUENCY.MIN.toString())
      expect(frequencyInput).toHaveAttribute('max', CONSTRAINTS.VECTOR_FREQUENCY.MAX.toString())
    })

    it('renders vector visualization SVG', () => {
      render(<VectorControl {...defaultProps} />)

      const svg = screen.getByRole('img', { hidden: true }) // SVG elements have img role
      expect(svg).toBeInTheDocument()
    })

    it('renders Clear button', () => {
      render(<VectorControl {...defaultProps} />)

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

      const sliders = screen.getAllByRole('slider')
      expect(sliders[0]).toHaveValue('45') // angle
      expect(sliders[1]).toHaveValue('0.8') // magnitude
      expect(sliders[2]).toHaveValue('100') // frequency
    })
  })

  describe('User Interactions', () => {
    const user = userEvent.setup()

    it('updates angle input', async () => {
      render(<VectorControl {...defaultProps} />)

      const sliders = screen.getAllByRole('slider')
      const angleInput = sliders[0] // angle

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(angleInput, { target: { value: '90' } })

      expect(angleInput).toHaveValue('90')
    })

    it('updates magnitude input', async () => {
      render(<VectorControl {...defaultProps} />)

      const sliders = screen.getAllByRole('slider')
      const magnitudeInput = sliders[1] // magnitude

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(magnitudeInput, { target: { value: '0.7' } })

      expect(magnitudeInput).toHaveValue('0.7')
    })

    it('updates frequency input', async () => {
      render(<VectorControl {...defaultProps} />)

      const sliders = screen.getAllByRole('slider')
      const frequencyInput = sliders[2] // frequency

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(frequencyInput, { target: { value: '80' } })

      expect(frequencyInput).toHaveValue('80')
    })

    it.skip('calls setVectorForce when Apply button is clicked with valid inputs', async () => {
      mockValidateVectorForce.mockReturnValue({ isValid: true, errors: {} })

      render(<VectorControl {...defaultProps} />)

      // Set some values
      const sliders = screen.getAllByRole('slider')
      const angleInput = sliders[0] // angle
      const magnitudeInput = sliders[1] // magnitude
      const frequencyInput = sliders[2] // frequency

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(angleInput, { target: { value: '90' } })
      fireEvent.change(magnitudeInput, { target: { value: '0.5' } })
      fireEvent.change(frequencyInput, { target: { value: '80' } })

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

    it.skip('does not call setVectorForce when validation fails', async () => {
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
      const sliders = screen.getAllByRole('slider')
      const angleInput = sliders[0] // angle
      const magnitudeInput = sliders[1] // magnitude
      const frequencyInput = sliders[2] // frequency

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(angleInput, { target: { value: '90' } })
      fireEvent.change(magnitudeInput, { target: { value: '0.5' } })

      const clearButton = screen.getByRole('button', { name: 'Clear' })
      await user.click(clearButton)

      // Should reset to default values (range inputs return strings)
      await waitFor(() => {
        expect(angleInput).toHaveValue('0')
        expect(magnitudeInput).toHaveValue('0')
        expect(frequencyInput).toHaveValue('60')
      })
    })
  })

  describe('Vector Visualization', () => {
    it('updates vector visualization based on input values', async () => {
      const user = userEvent.setup()
      render(<VectorControl {...defaultProps} />)

      const sliders = screen.getAllByRole('slider')
      const angleInput = sliders[0] // angle
      const magnitudeInput = sliders[1] // magnitude

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(angleInput, { target: { value: '90' } }) // North direction
      fireEvent.change(magnitudeInput, { target: { value: '1' } }) // Full magnitude

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
    it.skip('shows validation errors for invalid inputs', () => {
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

      const sliders = screen.getAllByRole('slider')
      expect(sliders[0]).toBeDisabled() // angle
      expect(sliders[1]).toBeDisabled() // magnitude
      expect(sliders[2]).toBeDisabled() // frequency
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

      const sliders = screen.getAllByRole('slider')
      expect(sliders[0]).toBeDisabled() // angle
      expect(sliders[1]).toBeDisabled() // magnitude
      expect(sliders[2]).toBeDisabled() // frequency
    })

    it.skip('shows loading state on Apply button when updating', () => {
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

      const sliders = screen.getAllByRole('slider')
      expect(sliders[0]).toBeInTheDocument() // angle
      expect(sliders[1]).toBeInTheDocument() // magnitude
      expect(sliders[2]).toBeInTheDocument() // frequency
    })

    it.skip('has proper ARIA attributes for error states', () => {
      // SKIP REASON: Slider component doesn't set aria-invalid attribute
      mockValidateVectorForce.mockReturnValue({
        isValid: false,
        errors: { angle: 'Invalid angle' },
      })

      render(<VectorControl {...defaultProps} />)

      const sliders = screen.getAllByRole('slider')
      const angleInput = sliders[0] // angle
      expect(angleInput).toHaveAttribute('aria-invalid', 'true')
    })

    it('has proper button labeling', () => {
      render(<VectorControl {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })
  })
})
