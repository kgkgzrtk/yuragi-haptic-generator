# Frontend Test Specifications - TDD Implementation

This directory contains comprehensive Test-Driven Development (TDD) specifications for the massage haptic generator frontend components. All tests are written following TDD principles, defining expected behavior before implementation.

## Test Files Overview

### Component Tests (`src/components/__tests__/`)

#### 1. CircularTrajectory.test.tsx
**Purpose**: Tests for canvas-based circular trajectory visualization component

**Key Test Areas**:
- **Canvas Rendering**: Proper canvas initialization, drawing operations, grid rendering
- **Real-time Data Updates**: High-frequency position updates, data validation, memory management
- **User Interactions**: Zoom/pan controls, keyboard navigation, touch gestures
- **Performance**: 60fps rendering, efficient canvas operations, memory usage

**Expected Component Interface**:
```tsx
interface CircularTrajectoryProps {
  deviceId: 1 | 2
  trajectoryPoints: Array<{ x: number; y: number; timestamp: number }>
  radius?: number
  centerX?: number
  centerY?: number
  isActive?: boolean
  direction?: 'clockwise' | 'counterclockwise'
  speed?: number
  enableZoom?: boolean
  enablePan?: boolean
  enableKeyboardNavigation?: boolean
  colors?: {
    grid: string
    trajectory: string
    marker: string
    background: string
  }
  mode?: 'lines' | 'points'
  maxPoints?: number
  animated?: boolean
}
```

#### 2. MassagePatternSelector.test.tsx
**Purpose**: Tests for massage pattern selection and customization UI

**Key Test Areas**:
- **Preset Selection**: Pattern display, filtering, categorization, search functionality
- **Parameter Validation**: Input validation, range checking, error handling
- **State Management**: Integration with haptic store, real-time updates
- **UI Interactions**: Keyboard navigation, customization modal, favorites, drag-and-drop

**Expected Component Interface**:
```tsx
interface MassagePatternSelectorProps {
  patterns: { [key: string]: IMassagePattern }
  selectedPattern?: string
  onPatternSelect: (pattern: IMassagePattern) => void
  onPatternPreview?: (pattern: IMassagePattern, options?: { duration: number }) => void
  onToggleFavorite?: (patternId: string, isFavorite: boolean) => void
  groupByCategory?: boolean
  showDetails?: boolean
  enableSearch?: boolean
  enableFilters?: boolean
  allowCustomization?: boolean
  allowReordering?: boolean
  showFavorites?: boolean
  showProgress?: boolean
  validateParameters?: boolean
  virtualized?: boolean
  announceSelection?: (message: string) => void
}
```

### Service Tests (`src/services/__tests__/`)

#### 3. websocketService.test.ts
**Purpose**: Tests for WebSocket connection management and messaging

**Key Test Areas**:
- **Connection Management**: Connect, disconnect, state tracking, multiple connections
- **Auto-reconnection**: Exponential backoff, max attempts, manual vs automatic disconnect
- **Message Queuing**: Queue when disconnected, priority handling, size limits
- **Error Handling**: Network errors, timeout handling, malformed messages

**Expected Service Interface**:
```typescript
class WebSocketService {
  constructor(config: WebSocketConfig)
  connect(): void
  disconnect(): void
  send(message: any): void
  isConnected(): boolean
  isConnecting(): boolean
  isReconnecting(): boolean
  getReconnectAttempts(): number
  getQueuedMessageCount(): number
  getConfig(): WebSocketConfig
  updateConfig(config: Partial<WebSocketConfig>): void
  onConnect(callback: () => void): void
  onDisconnect(callback: (event: CloseEvent) => void): void
  onMessage(callback: (message: any) => void, type?: string): void
  onError(callback: (error: any) => void): void
  onReconnect(callback: (attempt: number) => void): void
  onMaxReconnectAttemptsReached(callback: (attempts: number) => void): void
}
```

### Store Tests (`src/contexts/__tests__/`)

#### 4. hapticStoreMassageExtensions.test.ts
**Purpose**: Tests for massage-specific store functionality extending the existing haptic store

**Key Test Areas**:
- **State Performance**: High-frequency updates, batching, memory efficiency
- **Circular Motion**: Parameter calculation, direction handling, phase coherence
- **Pattern Transitions**: Smooth transitions, interruption handling, completion tracking

**Expected Store Extensions**:
```typescript
interface IHapticStoreWithMassage extends IHapticStore {
  massagePattern: IMassagePatternState
  setMassagePattern: (pattern: IMassagePattern | null) => void
  playMassagePattern: (patternId?: string) => void
  pauseMassagePattern: () => void
  resumeMassagePattern: () => void
  stopMassagePattern: () => void
  updateMassageProgress: (elapsedTime: number) => void
  setCircularMotionState: (state: Partial<ICircularMotionState>) => void
  updateCustomSettings: (settings: Partial<CustomSettings>) => void
  transitionToPattern: (pattern: IMassagePattern, duration?: number) => void
  addPatternToHistory: (patternId: string, completionRate: number) => void
  clearPatternHistory: () => void
}
```

## Test Utilities

### Performance Testing (`performanceUtils.ts`)
- **PerformanceMeasurement**: Class for measuring execution time, memory, frame rate
- **measureRenderPerformance**: Function for component render performance
- **measureAnimationPerformance**: 60fps animation testing with dropped frame detection
- **performanceAssertions**: Helper assertions for performance requirements

### WebSocket Mocking (`websocketMocks.ts`)
- **MockWebSocket**: Full WebSocket implementation with controllable behavior
- **WebSocketServiceMock**: Factory for creating and managing mock instances
- **hapticMessageTypes**: Predefined message types for haptic system
- **webSocketTestScenarios**: Common test scenarios (unstable connection, high throughput)

## Running the Tests

### Prerequisites
```bash
# Install dependencies
pnpm install

# Install Playwright browsers (for E2E tests)
pnpm test:e2e:install
```

### Unit Tests
```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test --coverage

# Run specific test file
pnpm test CircularTrajectory

# Run with UI
pnpm test:ui
```

### Performance Tests
```bash
# Run performance-specific tests
pnpm test --grep "Performance"

# Run with detailed timing
pnpm test --reporter=verbose --grep "performance"
```

### Integration Tests
```bash
# Run E2E tests
pnpm test:e2e

# Run E2E with UI
pnpm test:e2e:ui
```

## Test Configuration

### Vitest Configuration
Located in `vite.config.ts`:
- **Environment**: jsdom for DOM testing
- **Setup Files**: `src/test/setup.ts` for global mocks
- **Coverage**: v8 provider with 80% thresholds
- **Test Files**: Include all `.test.{ts,tsx}` files in src/

### Mock Setup
All mocks are automatically configured in `src/test/setup.ts`:
- Chart.js mocking for visualization components
- WebSocket mocking for service tests
- Performance API mocking for consistent timing
- ResizeObserver and IntersectionObserver mocking

## TDD Implementation Guidelines

### 1. Red Phase (Write Failing Tests)
```bash
# Create test file first
touch src/components/__tests__/NewComponent.test.tsx

# Write tests defining expected behavior
# Run tests - they should fail
pnpm test NewComponent
```

### 2. Green Phase (Make Tests Pass)
```bash
# Create minimal implementation
touch src/components/NewComponent.tsx

# Implement just enough to pass tests
# Run tests - they should pass
pnpm test NewComponent
```

### 3. Refactor Phase (Improve Code)
```bash
# Refactor implementation while keeping tests green
# Run tests frequently to ensure no regressions
pnpm test NewComponent --watch
```

## Performance Requirements

All components must meet these performance criteria:

### Rendering Performance
- **Frame Rate**: Maintain 60fps during animations
- **Render Time**: Individual renders < 16.67ms
- **Memory Usage**: < 50MB for complex components
- **Canvas Operations**: Efficient drawing with minimal redraws

### State Management Performance
- **Update Time**: State updates < 1ms
- **Batch Updates**: Multiple updates within single frame
- **Memory Leaks**: No memory growth over time
- **History Management**: Limited to prevent memory bloat

### Network Performance
- **Connection Time**: WebSocket connection < 100ms
- **Message Throughput**: Handle 1000+ messages/second
- **Reconnection**: Exponential backoff with reasonable limits
- **Queue Management**: Efficient message queuing and prioritization

## Accessibility Requirements

All components must support:
- **ARIA Labels**: Proper roles and labels for screen readers
- **Keyboard Navigation**: Full functionality without mouse
- **Focus Management**: Logical tab order and focus indicators
- **Reduced Motion**: Respect `prefers-reduced-motion` setting
- **Screen Reader**: Announce important state changes

## Browser Compatibility

Tests verify compatibility with:
- **Modern Browsers**: Chrome 87+, Firefox 78+, Safari 13+, Edge 88+
- **Mobile Browsers**: iOS Safari, Android Chrome
- **WebSocket Support**: All target browsers support WebSocket API
- **Canvas Support**: 2D canvas context required

## Debugging Tests

### Common Issues
1. **Canvas Context Null**: Ensure proper canvas mocking
2. **WebSocket Timing**: Use fake timers for consistent behavior
3. **State Updates**: Wrap in `act()` for React state changes
4. **Async Operations**: Use `waitFor()` for async assertions

### Debug Tools
```bash
# Run single test with debugging
pnpm test NewComponent --reporter=verbose

# Use Vitest UI for visual debugging
pnpm test:ui

# Use browser debugging with Playwright
pnpm test:e2e:debug
```

## Contributing

When adding new tests:
1. Follow existing patterns and naming conventions
2. Include comprehensive error cases and edge cases
3. Add performance assertions for critical paths
4. Document expected interfaces and behavior
5. Ensure tests are deterministic and fast
6. Add accessibility tests for UI components

## Implementation Status

- ✅ Test specifications created (TDD Red phase)
- ⏳ Component implementations (TDD Green phase)
- ⏳ Refactoring and optimization (TDD Refactor phase)

The test files define the complete expected behavior of components that will be implemented. This follows pure TDD methodology where tests are written first to define requirements and expected interfaces.
EOF < /dev/null