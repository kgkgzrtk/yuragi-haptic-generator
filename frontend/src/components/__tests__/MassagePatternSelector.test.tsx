import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { MassagePatternSelector } from '../ControlPanel/MassagePatternSelector'
import { useHapticStore } from '@/contexts/hapticStore'

// Mock massage patterns for testing
const mockMassagePatterns = {
  gentle_circular: {
    id: 'gentle_circular',
    name: 'Gentle Circular',
    description: 'Slow, gentle circular massage pattern',
    category: 'relaxation',
    duration: 60000, // 1 minute
    parameters: {
      radius: 0.5,
      frequency: 0.5, // Hz
      direction: 'clockwise' as const,
      intensity: 0.3,
      fadeIn: 2000,
      fadeOut: 2000,
    },
    preview: true,
  },
  deep_kneading: {
    id: 'deep_kneading',
    name: 'Deep Kneading',
    description: 'Intense circular kneading motion',
    category: 'therapeutic',
    duration: 300000, // 5 minutes
    parameters: {
      radius: 0.8,
      frequency: 1.2, // Hz
      direction: 'alternating' as const,
      intensity: 0.8,
      fadeIn: 5000,
      fadeOut: 3000,
    },
    preview: true,
  },
  figure_eight: {
    id: 'figure_eight',
    name: 'Figure Eight',
    description: 'Figure-8 pattern for targeted relief',
    category: 'targeted',
    duration: 120000, // 2 minutes
    parameters: {
      radius: 0.6,
      frequency: 0.8, // Hz
      direction: 'figure_eight' as const,
      intensity: 0.6,
      fadeIn: 3000,
      fadeOut: 2000,
    },
    preview: false,
  },
  pulse_therapy: {
    id: 'pulse_therapy',
    name: 'Pulse Therapy',
    description: 'Rhythmic pulsing for muscle tension',
    category: 'therapy',
    duration: 180000, // 3 minutes
    parameters: {
      radius: 0.4,
      frequency: 2.0, // Hz
      direction: 'static' as const,
      intensity: 0.7,
      fadeIn: 1000,
      fadeOut: 1000,
    },
    preview: true,
  },
}

// Mock store state
const mockStoreState = {
  massagePattern: {
    activePattern: null,
    isPlaying: false,
    currentPosition: { x: 0, y: 0 },
    elapsedTime: 0,
    customSettings: {
      intensity: 0.5,
      speed: 1.0,
      duration: 120000,
    },
  },
}

describe('MassagePatternSelector Component', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    const store = useHapticStore.getState()
    store.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Preset Selection Behavior', () => {
    it('should render all available massage patterns', () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
        />
      )

      expect(screen.getByText('Gentle Circular')).toBeInTheDocument()
      expect(screen.getByText('Deep Kneading')).toBeInTheDocument()
      expect(screen.getByText('Figure Eight')).toBeInTheDocument()
      expect(screen.getByText('Pulse Therapy')).toBeInTheDocument()
    })

    it('should group patterns by category', () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          groupByCategory
        />
      )

      expect(screen.getByText('Relaxation')).toBeInTheDocument()
      expect(screen.getByText('Therapeutic')).toBeInTheDocument()
      expect(screen.getByText('Targeted')).toBeInTheDocument()
      expect(screen.getByText('Therapy')).toBeInTheDocument()
    })

    it('should handle pattern selection correctly', async () => {
      const mockOnPatternSelect = vi.fn()
      
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={mockOnPatternSelect}
        />
      )

      await user.click(screen.getByText('Gentle Circular'))

      expect(mockOnPatternSelect).toHaveBeenCalledWith(mockMassagePatterns.gentle_circular)
    })

    it('should highlight selected pattern', async () => {
      const mockOnPatternSelect = vi.fn()
      
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          selectedPattern="deep_kneading"
          onPatternSelect={mockOnPatternSelect}
        />
      )

      const selectedPattern = screen.getByTestId('pattern-deep_kneading')
      expect(selectedPattern).toHaveClass('selected')
    })

    it('should display pattern details on hover', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          showDetails
        />
      )

      const patternCard = screen.getByTestId('pattern-gentle_circular')
      await user.hover(patternCard)

      await waitFor(() => {
        expect(screen.getByText('Slow, gentle circular massage pattern')).toBeInTheDocument()
        expect(screen.getByText('Duration: 1 min')).toBeInTheDocument()
        expect(screen.getByText('Intensity: Low')).toBeInTheDocument()
      })
    })

    it('should filter patterns by search term', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          enableSearch
        />
      )

      const searchInput = screen.getByPlaceholderText('Search massage patterns...')
      await user.type(searchInput, 'circular')

      await waitFor(() => {
        expect(screen.getByText('Gentle Circular')).toBeInTheDocument()
        expect(screen.queryByText('Deep Kneading')).not.toBeInTheDocument()
      })
    })

    it('should filter patterns by category', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          enableFilters
        />
      )

      const categoryFilter = screen.getByLabelText('Category')
      await user.selectOptions(categoryFilter, 'therapeutic')

      await waitFor(() => {
        expect(screen.getByText('Deep Kneading')).toBeInTheDocument()
        expect(screen.queryByText('Gentle Circular')).not.toBeInTheDocument()
      })
    })
  })

  describe('Parameter Validation', () => {
    it('should validate pattern parameters before selection', async () => {
      const invalidPattern = {
        ...mockMassagePatterns.gentle_circular,
        parameters: {
          ...mockMassagePatterns.gentle_circular.parameters,
          radius: -1, // Invalid: negative radius
          intensity: 1.5, // Invalid: intensity > 1
        },
      }

      const patterns = { ...mockMassagePatterns, invalid: invalidPattern }
      const mockOnPatternSelect = vi.fn()
      
      render(
        <MassagePatternSelector
          patterns={patterns}
          onPatternSelect={mockOnPatternSelect}
          validateParameters
        />
      )

      await user.click(screen.getByTestId('pattern-invalid'))

      expect(mockOnPatternSelect).not.toHaveBeenCalled()
      expect(screen.getByText(/Invalid pattern parameters/i)).toBeInTheDocument()
    })

    it('should validate custom parameter modifications', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          allowCustomization
        />
      )

      await user.click(screen.getByText('Gentle Circular'))
      await user.click(screen.getByText('Customize'))

      const intensitySlider = screen.getByLabelText('Intensity')
      await user.clear(intensitySlider)
      await user.type(intensitySlider, '2.0') // Invalid: > 1

      await waitFor(() => {
        expect(screen.getByText(/Intensity must be between 0 and 1/i)).toBeInTheDocument()
      })
    })

    it('should validate duration parameters', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          allowCustomization
        />
      )

      await user.click(screen.getByText('Gentle Circular'))
      await user.click(screen.getByText('Customize'))

      const durationInput = screen.getByLabelText('Duration (minutes)')
      await user.clear(durationInput)
      await user.type(durationInput, '0') // Invalid: zero duration

      await waitFor(() => {
        expect(screen.getByText(/Duration must be at least 10 seconds/i)).toBeInTheDocument()
      })
    })

    it('should validate frequency parameters', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          allowCustomization
        />
      )

      await user.click(screen.getByText('Deep Kneading'))
      await user.click(screen.getByText('Customize'))

      const frequencySlider = screen.getByLabelText('Frequency (Hz)')
      await user.clear(frequencySlider)
      await user.type(frequencySlider, '10') // Invalid: too high

      await waitFor(() => {
        expect(screen.getByText(/Frequency must be between 0.1 and 5 Hz/i)).toBeInTheDocument()
      })
    })
  })

  describe('State Management Integration', () => {
    it('should integrate with haptic store state', () => {
      const initialState = {
        massagePattern: {
          activePattern: mockMassagePatterns.gentle_circular,
          isPlaying: true,
          elapsedTime: 30000,
        },
      }

      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
        />,
        { initialHapticState: initialState }
      )

      const activePattern = screen.getByTestId('pattern-gentle_circular')
      expect(activePattern).toHaveClass('active playing')
    })

    it('should update store when pattern is selected', async () => {
      const mockOnPatternSelect = vi.fn()
      
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={mockOnPatternSelect}
        />
      )

      await user.click(screen.getByText('Deep Kneading'))

      expect(mockOnPatternSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'deep_kneading',
          parameters: expect.objectContaining({
            radius: 0.8,
            frequency: 1.2,
            intensity: 0.8,
          }),
        })
      )
    })

    it('should reflect real-time pattern progress', async () => {
      const initialState = {
        massagePattern: {
          activePattern: mockMassagePatterns.gentle_circular,
          isPlaying: true,
          elapsedTime: 30000, // 30 seconds
        },
      }

      const { rerender } = render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          showProgress
        />,
        { initialHapticState: initialState }
      )

      expect(screen.getByText('30s / 1min')).toBeInTheDocument()

      // Update progress
      const updatedState = {
        ...initialState,
        massagePattern: {
          ...initialState.massagePattern,
          elapsedTime: 45000,
        },
      }

      rerender(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          showProgress
        />
      )

      await waitFor(() => {
        expect(screen.getByText('45s / 1min')).toBeInTheDocument()
      })
    })

    it('should handle store state changes reactively', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
        />
      )

      // Simulate external store update
      const store = useHapticStore.getState()
      store.setMassagePattern({
        activePattern: mockMassagePatterns.pulse_therapy,
        isPlaying: true,
      })

      await waitFor(() => {
        const activePattern = screen.getByTestId('pattern-pulse_therapy')
        expect(activePattern).toHaveClass('active')
      })
    })
  })

  describe('UI Interaction Flows', () => {
    it('should support preview functionality', async () => {
      const mockOnPreview = vi.fn()
      
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          onPatternPreview={mockOnPreview}
        />
      )

      const previewButton = screen.getByTestId('preview-gentle_circular')
      await user.click(previewButton)

      expect(mockOnPreview).toHaveBeenCalledWith(
        mockMassagePatterns.gentle_circular,
        { duration: 5000 } // 5-second preview
      )
    })

    it('should disable preview for patterns without preview support', () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          onPatternPreview={vi.fn()}
        />
      )

      const figureEightPattern = screen.getByTestId('pattern-figure_eight')
      const previewButton = figureEightPattern.querySelector('[data-testid="preview-figure_eight"]')
      
      expect(previewButton).toBeDisabled()
    })

    it('should support keyboard navigation', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
        />
      )

      const firstPattern = screen.getByTestId('pattern-gentle_circular')
      await user.click(firstPattern)

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      
      await waitFor(() => {
        const secondPattern = screen.getByTestId('pattern-deep_kneading')
        expect(secondPattern).toHaveFocus()
      })

      // Select with Enter
      await user.keyboard('{Enter}')
      
      expect(screen.getByTestId('pattern-deep_kneading')).toHaveClass('selected')
    })

    it('should support customization modal', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          allowCustomization
        />
      )

      await user.click(screen.getByText('Gentle Circular'))
      await user.click(screen.getByText('Customize'))

      expect(screen.getByRole('dialog', { name: /customize pattern/i })).toBeInTheDocument()
      expect(screen.getByLabelText('Intensity')).toBeInTheDocument()
      expect(screen.getByLabelText('Speed')).toBeInTheDocument()
      expect(screen.getByLabelText('Duration (minutes)')).toBeInTheDocument()
    })

    it('should save custom settings', async () => {
      const mockOnPatternSelect = vi.fn()
      
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={mockOnPatternSelect}
          allowCustomization
        />
      )

      await user.click(screen.getByText('Gentle Circular'))
      await user.click(screen.getByText('Customize'))

      const intensitySlider = screen.getByLabelText('Intensity')
      await user.clear(intensitySlider)
      await user.type(intensitySlider, '0.8')

      await user.click(screen.getByText('Apply'))

      expect(mockOnPatternSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            intensity: 0.8,
          }),
        })
      )
    })

    it('should handle pattern favorites', async () => {
      const mockOnToggleFavorite = vi.fn()
      
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          onToggleFavorite={mockOnToggleFavorite}
          showFavorites
        />
      )

      const favoriteButton = screen.getByTestId('favorite-gentle_circular')
      await user.click(favoriteButton)

      expect(mockOnToggleFavorite).toHaveBeenCalledWith('gentle_circular', true)
    })

    it('should support drag and drop for custom ordering', async () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          allowReordering
        />
      )

      const firstPattern = screen.getByTestId('pattern-gentle_circular')
      const secondPattern = screen.getByTestId('pattern-deep_kneading')

      // Simulate drag and drop
      await user.pointer([
        { keys: '[MouseLeft>]', target: firstPattern },
        { coords: secondPattern },
        { keys: '[/MouseLeft]' },
      ])

      // Should trigger reorder callback
      await waitFor(() => {
        expect(screen.getByTestId('pattern-deep_kneading')).toBe(
          screen.getAllByTestId(/pattern-/)[0]
        )
      })
    })
  })

  describe('Performance and Accessibility', () => {
    it('should render large pattern lists efficiently', () => {
      const largePatternList = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [
          `pattern_${i}`,
          {
            ...mockMassagePatterns.gentle_circular,
            id: `pattern_${i}`,
            name: `Pattern ${i}`,
          },
        ])
      )

      const startTime = performance.now()
      render(
        <MassagePatternSelector
          patterns={largePatternList}
          onPatternSelect={vi.fn()}
          virtualized
        />
      )
      const renderTime = performance.now() - startTime

      // Should render in less than 100ms
      expect(renderTime).toBeLessThan(100)
    })

    it('should have proper ARIA labels and roles', () => {
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
        />
      )

      expect(screen.getByRole('group', { name: /massage patterns/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /gentle circular/i })).toBeInTheDocument()
    })

    it('should support screen reader announcements', async () => {
      const mockAnnounce = vi.fn()
      
      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
          announceSelection={mockAnnounce}
        />
      )

      await user.click(screen.getByText('Gentle Circular'))

      expect(mockAnnounce).toHaveBeenCalledWith('Selected Gentle Circular massage pattern')
    })

    it('should handle reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      })

      render(
        <MassagePatternSelector
          patterns={mockMassagePatterns}
          onPatternSelect={vi.fn()}
        />
      )

      const selector = screen.getByTestId('massage-pattern-selector')
      expect(selector).toHaveClass('reduced-motion')
    })
  })
})