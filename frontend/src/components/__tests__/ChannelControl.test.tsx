import { describe, it, expect, beforeEach, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { ChannelControl } from '@/components/ControlPanel/ChannelControl'
import {
  useParameterManagement,
  useBatchParameterUpdates,
} from '@/hooks/queries/useParametersQuery'
import { useHapticErrorHandler } from '@/hooks/useErrorHandler'
import { setupMockScenarios } from '@/test/mocks'
import { render, screen, waitFor, fireEvent } from '@/test/test-utils'
import { CHANNEL_IDS, CONSTRAINTS } from '@/types/hapticTypes'
import type { IChannelParameters } from '@/types/hapticTypes'

// Mock the hooks
vi.mock('@/hooks/queries/useParametersQuery')
vi.mock('@/hooks/useErrorHandler')

// Import after mocking

describe('ChannelControl', () => {
  const mockChannel: IChannelParameters = {
    channelId: CHANNEL_IDS.DEVICE1_X,
    frequency: 60,
    amplitude: 0.5,
    phase: 90,
    polarity: true,
  }

  const defaultProps = {
    channelId: CHANNEL_IDS.DEVICE1_X,
    label: 'Device 1 - X Axis',
  }

  const mockBatchUpdate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setupMockScenarios.success()

    // Setup hook mocks
    vi.mocked(useParameterManagement).mockReturnValue({
      isUpdating: false,
      updateError: null,
      updateChannelField: vi.fn(),
      reset: vi.fn(),
      parameters: [],
      isLoading: false,
      error: null,
      isError: false,
      updateAllParameters: vi.fn(),
      updateChannel: vi.fn(),
      updateAllParametersAsync: vi.fn(),
      updateChannelAsync: vi.fn(),
      refetch: vi.fn(),
    })

    vi.mocked(useBatchParameterUpdates).mockReturnValue({
      batchUpdate: mockBatchUpdate,
      hasPendingUpdates: false,
      pendingCount: 0,
      clearPending: vi.fn(),
    })

    vi.mocked(useHapticErrorHandler).mockReturnValue({
      handleParameterError: vi.fn(),
      handleVectorForceError: vi.fn(),
      handleConnectionError: vi.fn(),
    })
  })

  describe('Rendering', () => {
    it('renders with correct channel information', () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      expect(screen.getByText('Device 1 - X Axis')).toBeInTheDocument()
      expect(screen.getByTestId(`channel-control-${CHANNEL_IDS.DEVICE1_X}`)).toBeInTheDocument()
    })

    it('renders all input fields with correct values', () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      // Get all range inputs
      const sliders = screen.getAllByRole('slider')
      expect(sliders).toHaveLength(3) // frequency, amplitude, phase

      // Check frequency input (first slider)
      const frequencyInput = sliders[0]
      expect(frequencyInput).toHaveValue('60')
      expect(frequencyInput).toHaveAttribute('min', CONSTRAINTS.FREQUENCY.MIN.toString())
      expect(frequencyInput).toHaveAttribute('max', CONSTRAINTS.FREQUENCY.MAX.toString())

      // Check amplitude input (second slider)
      const amplitudeInput = sliders[1]
      expect(amplitudeInput).toHaveValue('0.5')
      expect(amplitudeInput).toHaveAttribute('min', CONSTRAINTS.AMPLITUDE.MIN.toString())
      expect(amplitudeInput).toHaveAttribute('max', CONSTRAINTS.AMPLITUDE.MAX.toString())

      // Check phase input (third slider)
      const phaseInput = sliders[2]
      expect(phaseInput).toHaveValue('90')
      expect(phaseInput).toHaveAttribute('min', CONSTRAINTS.PHASE.MIN.toString())
      expect(phaseInput).toHaveAttribute('max', CONSTRAINTS.PHASE.MAX.toString())

      // Check polarity checkbox
      const polarityCheckbox = screen.getByRole('checkbox')
      expect(polarityCheckbox).toBeChecked()
    })

    it('shows "Channel not found" when channel does not exist', () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [], // Empty channels array
        },
      })

      expect(screen.getByText('Channel not found')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('handles frequency input changes', async () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      const frequencyInput = sliders[0]

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(frequencyInput, { target: { value: '80' } })

      await waitFor(() => {
        expect(mockBatchUpdate).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_X, {
          frequency: 80,
        })
      })
    })

    it('handles amplitude input changes', async () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      const amplitudeInput = sliders[1]

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(amplitudeInput, { target: { value: '0.8' } })

      await waitFor(() => {
        expect(mockBatchUpdate).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_X, {
          amplitude: 0.8,
        })
      })
    })

    it('handles phase input changes', async () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      const phaseInput = sliders[2]

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(phaseInput, { target: { value: '180' } })

      await waitFor(() => {
        expect(mockBatchUpdate).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_X, {
          phase: 180,
        })
      })
    })

    it('handles polarity checkbox changes', async () => {
      const user = userEvent.setup()
      
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const polarityCheckbox = screen.getByRole('checkbox')

      await user.click(polarityCheckbox)

      await waitFor(() => {
        expect(mockBatchUpdate).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_X, {
          polarity: false,
        })
      })
    })
  })

  describe('Input Validation', () => {
    it.skip('shows validation error for frequency out of range', async () => {
      // SKIP REASON: Range inputs automatically clamp values to min/max,
      // so setting value="150" on a max="120" input will result in value="120"
      // The validation error will never be triggered with range inputs.

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      const frequencyInput = sliders[0]

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(frequencyInput, { target: { value: '150' } }) // Above max

      await waitFor(() => {
        expect(screen.getByText(/Frequency must be between/)).toBeInTheDocument()
      })
    })

    it.skip('shows validation error for amplitude out of range', async () => {
      // SKIP REASON: Range inputs automatically clamp values to min/max

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      const amplitudeInput = sliders[1]

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(amplitudeInput, { target: { value: '2.0' } }) // Above max

      await waitFor(() => {
        expect(screen.getByText(/Amplitude must be between/)).toBeInTheDocument()
      })
    })

    it.skip('shows validation error for phase out of range', async () => {
      // SKIP REASON: Range inputs automatically clamp values to min/max

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      const phaseInput = sliders[2]

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(phaseInput, { target: { value: '400' } }) // Above max

      await waitFor(() => {
        expect(screen.getByText(/Phase must be between/)).toBeInTheDocument()
      })
    })

    it('clamps values to valid range for range inputs', async () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      const frequencyInput = sliders[0]

      // For range inputs, values are automatically clamped to min/max
      fireEvent.change(frequencyInput, { target: { value: '150' } }) // Above max

      // Input should be clamped to max value (120)
      expect(frequencyInput).toHaveValue('120')

      // batchUpdate should be called with the clamped value
      await waitFor(() => {
        expect(mockBatchUpdate).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_X, {
          frequency: 120,
        })
      })
    })
  })

  describe('Loading and Error States', () => {
    it('disables inputs when updating', () => {
      vi.mocked(useParameterManagement).mockReturnValue({
        isUpdating: true,
        updateError: null,
        updateChannelField: vi.fn(),
        reset: vi.fn(),
      })

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      expect(sliders[0]).toBeDisabled() // frequency
      expect(sliders[1]).toBeDisabled() // amplitude
      expect(sliders[2]).toBeDisabled() // phase
      expect(screen.getByRole('checkbox')).toBeDisabled()
    })

    it('disables inputs when there are pending updates', () => {
      vi.mocked(useBatchParameterUpdates).mockReturnValue({
        batchUpdate: vi.fn(),
        hasPendingUpdates: true,
        pendingCount: 1,
        clearPending: vi.fn(),
      })

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      expect(sliders[0]).toBeDisabled() // frequency
      expect(sliders[1]).toBeDisabled() // amplitude
      expect(sliders[2]).toBeDisabled() // phase
      expect(screen.getByRole('checkbox')).toBeDisabled()
    })

    it('shows updating status message', () => {
      vi.mocked(useParameterManagement).mockReturnValue({
        isUpdating: true,
        updateError: null,
        updateChannelField: vi.fn(),
        reset: vi.fn(),
      })

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      expect(screen.getByText('Updating...')).toBeInTheDocument()
    })

    it('shows pending updates status message', () => {
      vi.mocked(useBatchParameterUpdates).mockReturnValue({
        batchUpdate: vi.fn(),
        hasPendingUpdates: true,
        pendingCount: 2,
        clearPending: vi.fn(),
      })

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      expect(screen.getByText('Pending updates...')).toBeInTheDocument()
    })

    it('shows error message when update fails', () => {
      vi.mocked(useParameterManagement).mockReturnValue({
        isUpdating: false,
        updateError: new Error('Update failed'),
        updateChannelField: vi.fn(),
        reset: vi.fn(),
      })

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      expect(screen.getByText('Failed to update channel parameters')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('calls error handler when update error occurs', async () => {
      const mockHandleParameterError = vi.fn()
      useHapticErrorHandler.mockReturnValue({
        handleParameterError: mockHandleParameterError,
      })

      const updateError = new Error('Update failed')
      vi.mocked(useParameterManagement).mockReturnValue({
        isUpdating: false,
        updateError,
        updateChannelField: vi.fn(),
        reset: vi.fn(),
      })

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      await waitFor(() => {
        expect(mockHandleParameterError).toHaveBeenCalledWith(updateError, CHANNEL_IDS.DEVICE1_X)
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      expect(sliders).toHaveLength(3) // frequency, amplitude, phase
      expect(sliders[0]).toBeInTheDocument() // frequency
      expect(sliders[1]).toBeInTheDocument() // amplitude
      expect(sliders[2]).toBeInTheDocument() // phase
      expect(screen.getByLabelText('Ascending waveform')).toBeInTheDocument()
    })

    it.skip('has proper ARIA attributes for error states', async () => {
      // SKIP REASON: Range inputs automatically clamp values, so aria-invalid won't be set

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const sliders = screen.getAllByRole('slider')
      const frequencyInput = sliders[0]

      // For range inputs, we can't use clear(), just set the value directly
      fireEvent.change(frequencyInput, { target: { value: '150' } }) // Invalid value

      await waitFor(() => {
        expect(frequencyInput).toHaveAttribute('aria-invalid', 'true')
      })
    })
  })
})
