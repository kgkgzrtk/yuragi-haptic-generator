import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useParameterManagement,
  useBatchParameterUpdates,
} from '@/hooks/queries/useParametersQuery'
import { useHapticErrorHandler } from '@/hooks/useErrorHandler'
import { setupMockScenarios } from '@/test/mocks'
import { render, screen, waitFor } from '@/test/test-utils'
import { CHANNEL_IDS, CONSTRAINTS } from '@/types/hapticTypes'
import type { IChannelParameters } from '@/types/hapticTypes'
import { ChannelControl } from '../ControlPanel/ChannelControl'

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
      handleStreamingError: vi.fn(),
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

      // Check frequency input
      const frequencyInput = screen.getByLabelText('Frequency (Hz)')
      expect(frequencyInput).toHaveValue(60)
      expect(frequencyInput).toHaveAttribute('min', CONSTRAINTS.FREQUENCY.MIN.toString())
      expect(frequencyInput).toHaveAttribute('max', CONSTRAINTS.FREQUENCY.MAX.toString())

      // Check amplitude input
      const amplitudeInput = screen.getByLabelText('Amplitude')
      expect(amplitudeInput).toHaveValue(0.5)
      expect(amplitudeInput).toHaveAttribute('min', CONSTRAINTS.AMPLITUDE.MIN.toString())
      expect(amplitudeInput).toHaveAttribute('max', CONSTRAINTS.AMPLITUDE.MAX.toString())

      // Check phase input
      const phaseInput = screen.getByLabelText('Phase (degrees)')
      expect(phaseInput).toHaveValue(90)
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
    const user = userEvent.setup()

    it('handles frequency input changes', async () => {
      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const frequencyInput = screen.getByLabelText('Frequency (Hz)')

      await user.clear(frequencyInput)
      await user.type(frequencyInput, '80')

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

      const amplitudeInput = screen.getByLabelText('Amplitude')

      await user.clear(amplitudeInput)
      await user.type(amplitudeInput, '0.8')

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

      const phaseInput = screen.getByLabelText('Phase (degrees)')

      await user.clear(phaseInput)
      await user.type(phaseInput, '180')

      await waitFor(() => {
        expect(mockBatchUpdate).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_X, {
          phase: 180,
        })
      })
    })

    it('handles polarity checkbox changes', async () => {
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
    it('shows validation error for frequency out of range', async () => {
      const user = userEvent.setup()

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const frequencyInput = screen.getByLabelText('Frequency (Hz)')

      await user.clear(frequencyInput)
      await user.type(frequencyInput, '150') // Above max

      await waitFor(() => {
        expect(screen.getByText(/Frequency must be between/)).toBeInTheDocument()
      })
    })

    it('shows validation error for amplitude out of range', async () => {
      const user = userEvent.setup()

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const amplitudeInput = screen.getByLabelText('Amplitude')

      await user.clear(amplitudeInput)
      await user.type(amplitudeInput, '2.0') // Above max

      await waitFor(() => {
        expect(screen.getByText(/Amplitude must be between/)).toBeInTheDocument()
      })
    })

    it('shows validation error for phase out of range', async () => {
      const user = userEvent.setup()

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const phaseInput = screen.getByLabelText('Phase (degrees)')

      await user.clear(phaseInput)
      await user.type(phaseInput, '400') // Above max

      await waitFor(() => {
        expect(screen.getByText(/Phase must be between/)).toBeInTheDocument()
      })
    })

    it('does not call batchUpdate for invalid values', async () => {
      const user = userEvent.setup()

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const frequencyInput = screen.getByLabelText('Frequency (Hz)')

      await user.clear(frequencyInput)
      await user.type(frequencyInput, '150') // Invalid value

      // Input should show validation error
      expect(screen.getByDisplayValue('150')).toBeInTheDocument()
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

      expect(screen.getByLabelText('Frequency (Hz)')).toBeDisabled()
      expect(screen.getByLabelText('Amplitude')).toBeDisabled()
      expect(screen.getByLabelText('Phase (degrees)')).toBeDisabled()
      expect(screen.getByRole('checkbox')).toBeDisabled()
    })

    it('disables inputs when there are pending updates', () => {
      vi.mocked(useBatchParameterUpdates).mockReturnValue({
        batchUpdate: vi.fn(),
        hasPendingUpdates: true,
      })

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      expect(screen.getByLabelText('Frequency (Hz)')).toBeDisabled()
      expect(screen.getByLabelText('Amplitude')).toBeDisabled()
      expect(screen.getByLabelText('Phase (degrees)')).toBeDisabled()
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

      expect(screen.getByLabelText('Frequency (Hz)')).toBeInTheDocument()
      expect(screen.getByLabelText('Amplitude')).toBeInTheDocument()
      expect(screen.getByLabelText('Phase (degrees)')).toBeInTheDocument()
      expect(screen.getByLabelText('Ascending waveform')).toBeInTheDocument()
    })

    it('has proper ARIA attributes for error states', async () => {
      const user = userEvent.setup()

      render(<ChannelControl {...defaultProps} />, {
        initialHapticState: {
          channels: [mockChannel],
        },
      })

      const frequencyInput = screen.getByLabelText('Frequency (Hz)')

      await user.clear(frequencyInput)
      await user.type(frequencyInput, '150') // Invalid value

      await waitFor(() => {
        expect(frequencyInput).toHaveAttribute('aria-invalid', 'true')
      })
    })
  })
})
