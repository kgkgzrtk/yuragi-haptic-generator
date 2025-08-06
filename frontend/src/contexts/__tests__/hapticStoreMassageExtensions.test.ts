import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@/test/test-utils'
import { useHapticStore } from '../hapticStore'

// Mock massage pattern types
interface IMassagePattern {
  id: string
  name: string
  category: 'relaxation' | 'therapeutic' | 'targeted' | 'therapy'
  duration: number
  parameters: {
    radius: number
    frequency: number
    direction: 'clockwise' | 'counterclockwise' | 'alternating' | 'figure_eight' | 'static'
    intensity: number
    fadeIn: number
    fadeOut: number
    waveform?: 'sine' | 'sawtooth' | 'square'
  }
}

interface ICircularMotionState {
  currentAngle: number
  targetAngle: number
  angularVelocity: number
  centerX: number
  centerY: number
  radius: number
  direction: number // 1 for clockwise, -1 for counterclockwise
}

interface IMassagePatternState {
  activePattern: IMassagePattern | null
  isPlaying: boolean
  isPaused: boolean
  currentPosition: { x: number; y: number }
  elapsedTime: number
  remainingTime: number
  progress: number // 0-1
  circularMotion: ICircularMotionState
  customSettings: {
    intensity: number
    speed: number
    duration: number
  }
  patternHistory: Array<{
    patternId: string
    startTime: number
    endTime: number
    completionRate: number
  }>
}

// Extended store interface for massage functionality
interface IHapticStoreWithMassage {
  // Existing store properties...
  massagePattern: IMassagePatternState
  
  // Massage pattern actions
  setMassagePattern: (pattern: IMassagePattern | null) => void
  playMassagePattern: (patternId?: string) => void
  pauseMassagePattern: () => void
  resumeMassagePattern: () => void
  stopMassagePattern: () => void
  updateMassageProgress: (elapsedTime: number) => void
  setCircularMotionState: (state: Partial<ICircularMotionState>) => void
  updateCustomSettings: (settings: Partial<IMassagePatternState['customSettings']>) => void
  transitionToPattern: (pattern: IMassagePattern, transitionDuration?: number) => void
  addPatternToHistory: (patternId: string, completionRate: number) => void
  clearPatternHistory: () => void
}

// Mock patterns for testing
const mockPatterns: { [key: string]: IMassagePattern } = {
  gentle_circular: {
    id: 'gentle_circular',
    name: 'Gentle Circular',
    category: 'relaxation',
    duration: 60000,
    parameters: {
      radius: 0.5,
      frequency: 0.5,
      direction: 'clockwise',
      intensity: 0.3,
      fadeIn: 2000,
      fadeOut: 2000,
      waveform: 'sine',
    },
  },
  deep_kneading: {
    id: 'deep_kneading',
    name: 'Deep Kneading',
    category: 'therapeutic',
    duration: 300000,
    parameters: {
      radius: 0.8,
      frequency: 1.2,
      direction: 'alternating',
      intensity: 0.8,
      fadeIn: 5000,
      fadeOut: 3000,
      waveform: 'sawtooth',
    },
  },
  figure_eight: {
    id: 'figure_eight',
    name: 'Figure Eight',
    category: 'targeted',
    duration: 120000,
    parameters: {
      radius: 0.6,
      frequency: 0.8,
      direction: 'figure_eight',
      intensity: 0.6,
      fadeIn: 3000,
      fadeOut: 2000,
      waveform: 'sine',
    },
  },
}

// Mock performance API
const mockPerformance = {
  now: vi.fn().mockReturnValue(0),
  mark: vi.fn(),
  measure: vi.fn(),
}
Object.defineProperty(globalThis, 'performance', {
  value: mockPerformance,
  writable: true,
})

describe('HapticStore Massage Extensions', () => {
  let currentTime = 0
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
    currentTime = 0
    
    mockPerformance.now.mockImplementation(() => currentTime)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('State Update Performance', () => {
    it('should handle high-frequency position updates efficiently', () => {
      const { result } = renderHook(() => useHapticStore())

      const startTime = performance.now()
      
      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.playMassagePattern()
      })

      // Simulate 60fps updates for 1 second
      for (let i = 0; i < 60; i++) {
        currentTime += 16.67 // ~60fps
        
        act(() => {
          const angle = (i * 6) * Math.PI / 180 // 6 degrees per frame
          const x = Math.cos(angle) * 0.5
          const y = Math.sin(angle) * 0.5
          
          result.current.updateMassageProgress(i * 16.67)
          result.current.setCircularMotionState({
            currentAngle: angle,
            centerX: x,
            centerY: y,
          })
        })
      }

      const endTime = performance.now()
      const updateDuration = endTime - startTime

      // Should handle 60 updates per second efficiently
      expect(updateDuration).toBeLessThan(100) // Less than 100ms for all updates
      expect(result.current.massagePattern.elapsedTime).toBeCloseTo(1000, 0)
    })

    it('should batch multiple state updates within single frame', () => {
      const { result } = renderHook(() => useHapticStore())
      
      const renderSpy = vi.spyOn(result.current, 'setCircularMotionState')
      
      act(() => {
        result.current.setMassagePattern(mockPatterns.deep_kneading)
        
        // Multiple rapid updates
        for (let i = 0; i < 10; i++) {
          result.current.setCircularMotionState({
            currentAngle: i * 0.1,
            targetAngle: (i + 1) * 0.1,
          })
        }
      })

      // Should optimize state updates
      expect(renderSpy).toHaveBeenCalledTimes(10)
      expect(result.current.massagePattern.circularMotion.currentAngle).toBeCloseTo(0.9)
    })

    it('should maintain consistent performance with pattern transitions', async () => {
      const { result } = renderHook(() => useHapticStore())

      const transitionTimes: number[] = []

      // Perform multiple pattern transitions
      for (const patternId of Object.keys(mockPatterns)) {
        const startTime = performance.now()
        
        act(() => {
          result.current.transitionToPattern(mockPatterns[patternId], 1000)
        })
        
        // Simulate transition progress
        for (let progress = 0; progress <= 100; progress += 10) {
          currentTime += 10
          act(() => {
            result.current.updateMassageProgress(progress * 10)
          })
        }

        const endTime = performance.now()
        transitionTimes.push(endTime - startTime)
      }

      // All transitions should complete within reasonable time
      transitionTimes.forEach(time => {
        expect(time).toBeLessThan(50) // Less than 50ms per transition
      })

      const avgTransitionTime = transitionTimes.reduce((a, b) => a + b, 0) / transitionTimes.length
      expect(avgTransitionTime).toBeLessThan(30) // Average less than 30ms
    })

    it('should efficiently manage pattern history without memory leaks', () => {
      const { result } = renderHook(() => useHapticStore())

      // Add many patterns to history
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.addPatternToHistory(`pattern_${i}`, Math.random())
        }
      })

      // Should limit history size to prevent memory bloat
      expect(result.current.massagePattern.patternHistory.length).toBeLessThanOrEqual(100)

      // Should keep most recent entries
      const lastEntry = result.current.massagePattern.patternHistory[result.current.massagePattern.patternHistory.length - 1]
      expect(lastEntry.patternId).toBe('pattern_999')
    })
  })

  describe('Circular Motion Parameter Management', () => {
    it('should calculate circular motion coordinates correctly', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.playMassagePattern()
      })

      // Test various angles
      const testAngles = [0, Math.PI/2, Math.PI, 3*Math.PI/2, 2*Math.PI]
      const radius = 0.5
      
      testAngles.forEach(angle => {
        act(() => {
          result.current.setCircularMotionState({
            currentAngle: angle,
            radius: radius,
            centerX: 0,
            centerY: 0,
          })
        })

        const expectedX = Math.cos(angle) * radius
        const expectedY = Math.sin(angle) * radius

        expect(result.current.massagePattern.currentPosition.x).toBeCloseTo(expectedX, 5)
        expect(result.current.massagePattern.currentPosition.y).toBeCloseTo(expectedY, 5)
      })
    })

    it('should handle different circular motion directions', () => {
      const { result } = renderHook(() => useHapticStore())

      // Test clockwise direction
      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.setCircularMotionState({
          direction: 1, // clockwise
          angularVelocity: Math.PI / 4, // 45 degrees per update
        })
      })

      let angle = 0
      for (let i = 0; i < 8; i++) {
        act(() => {
          result.current.setCircularMotionState({
            currentAngle: angle,
          })
        })
        angle += Math.PI / 4
      }

      expect(result.current.massagePattern.circularMotion.currentAngle).toBeCloseTo(7 * Math.PI / 4)

      // Test counterclockwise direction
      act(() => {
        result.current.setCircularMotionState({
          direction: -1, // counterclockwise
          currentAngle: 0,
        })
      })

      angle = 0
      for (let i = 0; i < 4; i++) {
        act(() => {
          result.current.setCircularMotionState({
            currentAngle: angle,
          })
        })
        angle -= Math.PI / 4
      }

      expect(result.current.massagePattern.circularMotion.currentAngle).toBeCloseTo(-3 * Math.PI / 4)
    })

    it('should support figure-eight motion patterns', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setMassagePattern(mockPatterns.figure_eight)
        result.current.playMassagePattern()
      })

      const positions: { x: number; y: number }[] = []
      
      // Generate figure-eight pattern
      for (let t = 0; t < 2 * Math.PI; t += Math.PI / 16) {
        const x = Math.sin(t) * 0.6
        const y = Math.sin(2 * t) * 0.6
        
        act(() => {
          result.current.setCircularMotionState({
            centerX: x,
            centerY: y,
          })
        })
        
        positions.push({ ...result.current.massagePattern.currentPosition })
      }

      // Should trace figure-eight shape
      expect(positions.length).toBe(32)
      
      // Check symmetry
      const midPoint = positions.length / 2
      const firstHalf = positions.slice(0, midPoint)
      const secondHalf = positions.slice(midPoint).reverse()
      
      firstHalf.forEach((pos, i) => {
        expect(pos.x).toBeCloseTo(-secondHalf[i].x, 2)
        expect(pos.y).toBeCloseTo(secondHalf[i].y, 2)
      })
    })

    it('should interpolate smoothly between motion parameters', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.setCircularMotionState({
          radius: 0.2,
          angularVelocity: 1.0,
        })
      })

      // Transition to new parameters
      const targetRadius = 0.8
      const targetVelocity = 2.0
      const transitionDuration = 1000 // 1 second
      
      act(() => {
        result.current.transitionToPattern({
          ...mockPatterns.gentle_circular,
          parameters: {
            ...mockPatterns.gentle_circular.parameters,
            radius: targetRadius,
            frequency: targetVelocity,
          },
        }, transitionDuration)
      })

      // Simulate smooth transition over time
      const steps = 10
      for (let i = 1; i <= steps; i++) {
        currentTime += transitionDuration / steps
        
        act(() => {
          result.current.updateMassageProgress(currentTime)
        })

        const progress = i / steps
        const expectedRadius = 0.2 + (targetRadius - 0.2) * progress
        
        expect(result.current.massagePattern.circularMotion.radius).toBeCloseTo(expectedRadius, 2)
      }
    })

    it('should maintain phase coherence during parameter changes', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.setCircularMotionState({
          currentAngle: Math.PI / 2, // 90 degrees
          angularVelocity: Math.PI / 2, // 90 deg/s
        })
      })

      const initialAngle = result.current.massagePattern.circularMotion.currentAngle

      // Change radius while maintaining phase
      act(() => {
        result.current.setCircularMotionState({
          radius: 0.8, // Changed from default
        })
      })

      // Angle should remain unchanged
      expect(result.current.massagePattern.circularMotion.currentAngle).toBe(initialAngle)

      // Position should reflect new radius
      const expectedX = Math.cos(initialAngle) * 0.8
      const expectedY = Math.sin(initialAngle) * 0.8
      
      expect(result.current.massagePattern.currentPosition.x).toBeCloseTo(expectedX, 5)
      expect(result.current.massagePattern.currentPosition.y).toBeCloseTo(expectedY, 5)
    })
  })

  describe('Massage Pattern State Transitions', () => {
    it('should transition smoothly between different patterns', async () => {
      const { result } = renderHook(() => useHapticStore())

      // Start with gentle circular
      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.playMassagePattern()
      })

      expect(result.current.massagePattern.activePattern?.id).toBe('gentle_circular')

      // Transition to deep kneading
      act(() => {
        result.current.transitionToPattern(mockPatterns.deep_kneading, 2000)
      })

      // During transition, should blend parameters
      for (let t = 0; t <= 2000; t += 200) {
        currentTime = t
        
        act(() => {
          result.current.updateMassageProgress(t)
        })

        const progress = t / 2000
        
        // Intensity should transition from 0.3 to 0.8
        const expectedIntensity = 0.3 + (0.8 - 0.3) * progress
        expect(result.current.massagePattern.customSettings.intensity).toBeCloseTo(expectedIntensity, 2)
      }

      // After transition, should be fully on new pattern
      expect(result.current.massagePattern.activePattern?.id).toBe('deep_kneading')
    })

    it('should handle pattern interruption gracefully', () => {
      const { result } = renderHook(() => useHapticStore())

      // Start pattern
      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.playMassagePattern()
        result.current.updateMassageProgress(30000) // 30 seconds in
      })

      const elapsedBeforeInterruption = result.current.massagePattern.elapsedTime

      // Interrupt with new pattern
      act(() => {
        result.current.setMassagePattern(mockPatterns.figure_eight)
        result.current.playMassagePattern()
      })

      // Should record previous pattern in history
      expect(result.current.massagePattern.patternHistory).toHaveLength(1)
      expect(result.current.massagePattern.patternHistory[0]).toEqual({
        patternId: 'gentle_circular',
        startTime: 0,
        endTime: elapsedBeforeInterruption,
        completionRate: elapsedBeforeInterruption / mockPatterns.gentle_circular.duration,
      })

      // Should start new pattern fresh
      expect(result.current.massagePattern.activePattern?.id).toBe('figure_eight')
      expect(result.current.massagePattern.elapsedTime).toBe(0)
    })

    it('should handle pause and resume state transitions', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setMassagePattern(mockPatterns.deep_kneading)
        result.current.playMassagePattern()
        result.current.updateMassageProgress(60000) // 1 minute
      })

      expect(result.current.massagePattern.isPlaying).toBe(true)
      expect(result.current.massagePattern.isPaused).toBe(false)

      // Pause
      act(() => {
        result.current.pauseMassagePattern()
      })

      expect(result.current.massagePattern.isPlaying).toBe(false)
      expect(result.current.massagePattern.isPaused).toBe(true)
      
      const pausedTime = result.current.massagePattern.elapsedTime

      // Resume
      act(() => {
        result.current.resumeMassagePattern()
      })

      expect(result.current.massagePattern.isPlaying).toBe(true)
      expect(result.current.massagePattern.isPaused).toBe(false)
      expect(result.current.massagePattern.elapsedTime).toBe(pausedTime)
    })

    it('should handle pattern completion correctly', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.playMassagePattern()
      })

      // Progress to completion
      act(() => {
        result.current.updateMassageProgress(mockPatterns.gentle_circular.duration)
      })

      // Should automatically stop and record completion
      expect(result.current.massagePattern.isPlaying).toBe(false)
      expect(result.current.massagePattern.progress).toBe(1.0)
      expect(result.current.massagePattern.remainingTime).toBe(0)

      // Should record in history with 100% completion
      expect(result.current.massagePattern.patternHistory).toContainEqual(
        expect.objectContaining({
          patternId: 'gentle_circular',
          completionRate: 1.0,
        })
      )
    })

    it('should validate state transitions', () => {
      const { result } = renderHook(() => useHapticStore())

      // Cannot resume without active pattern
      expect(() => {
        act(() => {
          result.current.resumeMassagePattern()
        })
      }).not.toThrow() // Should handle gracefully

      expect(result.current.massagePattern.isPlaying).toBe(false)

      // Cannot pause when not playing
      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
      })

      act(() => {
        result.current.pauseMassagePattern()
      })

      expect(result.current.massagePattern.isPaused).toBe(false) // Should not pause if not playing
    })

    it('should handle concurrent pattern operations safely', () => {
      const { result } = renderHook(() => useHapticStore())

      // Simulate rapid state changes
      act(() => {
        result.current.setMassagePattern(mockPatterns.gentle_circular)
        result.current.playMassagePattern()
        result.current.pauseMassagePattern()
        result.current.resumeMassagePattern()
        result.current.stopMassagePattern()
        result.current.setMassagePattern(mockPatterns.deep_kneading)
        result.current.playMassagePattern()
      })

      // Should end up in a consistent state
      expect(result.current.massagePattern.activePattern?.id).toBe('deep_kneading')
      expect(result.current.massagePattern.isPlaying).toBe(true)
      expect(result.current.massagePattern.isPaused).toBe(false)
    })
  })

  describe('Memory Management and Cleanup', () => {
    it('should cleanup resources when patterns are stopped', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setMassagePattern(mockPatterns.deep_kneading)
        result.current.playMassagePattern()
      })

      // Simulate resource allocation
      const initialMemoryUsage = process.memoryUsage?.()?.heapUsed || 0

      act(() => {
        result.current.stopMassagePattern()
      })

      // Should clean up state
      expect(result.current.massagePattern.activePattern).toBeNull()
      expect(result.current.massagePattern.isPlaying).toBe(false)
      expect(result.current.massagePattern.currentPosition).toEqual({ x: 0, y: 0 })
    })

    it('should prevent memory leaks in long-running patterns', () => {
      const { result } = renderHook(() => useHapticStore())

      act(() => {
        result.current.setMassagePattern(mockPatterns.deep_kneading)
        result.current.playMassagePattern()
      })

      // Simulate long-running pattern with many updates
      for (let i = 0; i < 10000; i++) {
        currentTime += 16.67 // 60fps
        
        act(() => {
          result.current.updateMassageProgress(currentTime)
          result.current.setCircularMotionState({
            currentAngle: (i * 6) * Math.PI / 180,
          })
        })
      }

      // Memory usage should remain stable
      const memoryAfterUpdates = process.memoryUsage?.()?.heapUsed || 0
      expect(memoryAfterUpdates).toBeLessThan(50 * 1024 * 1024) // Less than 50MB
    })

    it('should handle store reset properly', () => {
      const { result } = renderHook(() => useHapticStore())

      // Set up complex state
      act(() => {
        result.current.setMassagePattern(mockPatterns.deep_kneading)
        result.current.playMassagePattern()
        result.current.updateMassageProgress(60000)
        result.current.addPatternToHistory('test_pattern', 0.5)
      })

      // Reset store
      act(() => {
        result.current.reset()
      })

      // Should reset massage state to defaults
      expect(result.current.massagePattern.activePattern).toBeNull()
      expect(result.current.massagePattern.isPlaying).toBe(false)
      expect(result.current.massagePattern.elapsedTime).toBe(0)
      expect(result.current.massagePattern.patternHistory).toEqual([])
    })
  })
})
EOF < /dev/null