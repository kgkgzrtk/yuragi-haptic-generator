/**
 * Test fixtures and mock data for E2E tests
 */

export const testHapticData = {
  defaultFrequency: 60,
  defaultAmplitude: 0.5,
  defaultPhase: 0,
  defaultPolarity: true,
  testChannels: [0, 1, 2, 3], // Actual channel IDs used in the app
  waveforms: ['sine', 'square', 'sawtooth', 'triangle'] as const,
  vectorForce: {
    angle: 45,
    magnitude: 0.7,
    frequency: 80,
  },
  constraints: {
    frequency: { min: 0, max: 120 },
    amplitude: { min: 0, max: 1 },
    phase: { min: 0, max: 360 },
    vectorFrequency: { min: 40, max: 120 },
  },
} as const

export const testApiResponses = {
  status: {
    success: { status: 'success', message: 'Operation completed' },
    error: { status: 'error', message: 'Operation failed' },
  },
  systemStatus: {
    isStreaming: false,
    sampleRate: 44100,
    blockSize: 512,
    latencyMs: 12,
  },
  parameters: {
    channels: [
      { channelId: 0, frequency: 60, amplitude: 0.5, phase: 0, polarity: true },
      { channelId: 1, frequency: 60, amplitude: 0.5, phase: 90, polarity: true },
      { channelId: 2, frequency: 80, amplitude: 0.7, phase: 0, polarity: false },
      { channelId: 3, frequency: 80, amplitude: 0.7, phase: 90, polarity: false },
    ],
  },
  hapticConfig: {
    channels: [
      { channelId: 0, frequency: 60, amplitude: 0.5, phase: 0, polarity: true },
      { channelId: 1, frequency: 60, amplitude: 0.5, phase: 90, polarity: true },
      { channelId: 2, frequency: 80, amplitude: 0.7, phase: 0, polarity: false },
      { channelId: 3, frequency: 80, amplitude: 0.7, phase: 90, polarity: false },
    ],
  },
  vectorForce: {
    device1: { deviceId: 1, angle: 45, magnitude: 0.5, frequency: 60 },
    device2: null,
  },
  waveformData: {
    timestamp: '2025-01-01T00:00:00.000Z',
    sampleRate: 44100,
    channels: [
      { channelId: 0, data: [0.1, 0.2, 0.3, 0.2, 0.1] },
      { channelId: 1, data: [0.2, 0.3, 0.4, 0.3, 0.2] },
      { channelId: 2, data: [0.3, 0.4, 0.5, 0.4, 0.3] },
      { channelId: 3, data: [0.4, 0.5, 0.6, 0.5, 0.4] },
    ],
  },
} as const

export const testSelectors = {
  // App structure
  app: {
    header: '.app-header',
    main: '.app-main',
    title: 'h1:has-text("Yuragi Haptic Generator")',
  },
  // Streaming controls
  streaming: {
    button: 'button:has-text(/Start Streaming|Stop Streaming/)',
    status: '.connection-status',
  },
  // Control panels
  panels: {
    controlPanel: '.haptic-control-panel',
    deviceSection: '.device-section',
    channelControls: '.channel-controls',
    visualizationSection: '.visualization-section',
  },
  // Channel controls
  channels: {
    control: (channelId: number) => `[data-testid="channel-control-${channelId}"]`,
    frequencyInput: 'input[type="number"][min="0"][max="120"]',
    amplitudeInput: 'input[type="number"][min="0"][max="1"]',
    phaseInput: 'input[type="number"][min="0"][max="360"]',
    polarityCheckbox: 'input[type="checkbox"]',
  },
  // Vector controls
  vector: {
    control: (deviceId: number) => `[data-testid="vector-control-${deviceId}"]`,
    angleInput: 'input[min="0"][max="360"]',
    magnitudeInput: 'input[min="0"][max="1"]',
    frequencyInput: 'input[min="40"][max="120"]',
    applyButton: 'button:has-text("Apply")',
    clearButton: 'button:has-text("Clear")',
    visualization: 'svg',
  },
  // Waveform visualization
  waveform: {
    section: '.visualization-section',
    grid: '.waveform-grid',
    container: '.waveform-container',
    canvas: 'canvas',
  },
  // Common UI elements
  buttons: {
    primary: 'button[class*="primary"]:not([disabled])',
    secondary: 'button[class*="secondary"]:not([disabled])',
    danger: 'button[class*="danger"]:not([disabled])',
    loading: 'button[class*="loading"], button[disabled]',
  },
  // Notifications
  notifications: {
    container: '.notification-container, [role="alert"]',
    success: '.notification-success, [role="alert"][class*="success"]',
    error: '.notification-error, [role="alert"][class*="error"]',
  },
} as const

export const testUrls = {
  home: '/',
  api: {
    health: '/api/health',
    status: '/api/status',
    parameters: '/api/parameters',
    streaming: '/api/streaming',
    vectorForce: '/api/vector-force',
    waveform: '/api/waveform',
    // Legacy support
    haptic: '/api/haptic',
    config: '/api/config',
  },
  websocket: 'ws://localhost:8000/ws',
} as const

// WebSocket mock messages
export const testWebSocketMessages = {
  parametersUpdate: {
    type: 'parameters_update',
    data: testApiResponses.parameters,
    timestamp: '2025-01-01T00:00:00.000Z',
  },
  waveformData: {
    type: 'waveform_data',
    data: testApiResponses.waveformData,
    timestamp: '2025-01-01T00:00:00.000Z',
  },
  statusUpdate: {
    type: 'status_update',
    data: { isStreaming: true },
    timestamp: '2025-01-01T00:00:00.000Z',
  },
  error: {
    type: 'error',
    data: { message: 'Test error message' },
    timestamp: '2025-01-01T00:00:00.000Z',
  },
} as const

// Test scenarios for error conditions
export const testErrorScenarios = {
  networkError: {
    status: 500,
    response: { error: 'Internal server error' },
  },
  validationError: {
    status: 400,
    response: { error: 'Invalid parameter values' },
  },
  timeout: {
    delay: 30000, // Longer than test timeout
  },
  websocketDisconnect: {
    closeCode: 1006,
    reason: 'Connection lost',
  },
  // HTTP status code scenarios for comprehensive error testing
  httpErrorScenarios: [
    {
      description: 'Unauthorized access',
      url: '/api/parameters',
      status: 401,
      message: 'Unauthorized access',
      expectedText: 'Unauthorized',
    },
    {
      description: 'Forbidden operation',
      url: '/api/streaming',
      status: 403,
      message: 'Forbidden operation',
      expectedText: 'Forbidden',
    },
    {
      description: 'Endpoint not found',
      url: '/api/vector-force',
      status: 404,
      message: 'Endpoint not found',
      expectedText: 'not found',
    },
    {
      description: 'Too many requests',
      url: '/api/parameters',
      status: 429,
      message: 'Too many requests',
      expectedText: 'Too many',
    },
  ],
  // Common error recovery test patterns
  serverRecoveryScenarios: {
    serviceUnavailable: {
      initialStatus: 503,
      initialMessage: 'Service temporarily unavailable',
      expectedErrorText: 'Service temporarily unavailable',
    },
    internalError: {
      initialStatus: 500,
      initialMessage: 'Internal server error',
      expectedErrorText: 'Internal server error',
    },
    temporaryError: {
      initialStatus: 500,
      initialMessage: 'Temporary error',
      expectedErrorText: 'Temporary error',
    },
  },
  // WebSocket error scenarios
  websocketErrorScenarios: {
    connectionFailed: {
      closeCode: 1006,
      reason: 'Connection failed',
    },
    normalClosure: {
      closeCode: 1000,
      reason: 'Normal closure',
    },
    serverError: {
      closeCode: 1011,
      reason: 'Server error',
    },
  },
  // API retry scenarios
  retryScenarios: {
    failTwiceThenSucceed: {
      failureCount: 2,
      errorStatus: 500,
      errorMessage: 'Internal server error',
    },
    failOnceThenSucceed: {
      failureCount: 1,
      errorStatus: 503,
      errorMessage: 'Service unavailable',
    },
  },
} as const

// Reusable test parameter sets for common testing patterns
export const testParameterSets = {
  channelUpdates: {
    basic: { frequency: 75, amplitude: 0.6, phase: 45 },
    rapid: [
      { frequency: 50 },
      { amplitude: 0.7 },
      { phase: 90 },
    ],
    concurrent: {
      channel0: { frequency: 60, amplitude: 0.5, phase: 0 },
      channel1: { frequency: 80, amplitude: 0.7, phase: 90 },
    },
  },
  vectorForce: {
    basic: { angle: 45, magnitude: 0.7, frequency: 80 },
    extreme: { angle: 359, magnitude: 1.0, frequency: 120 },
  },
  streamingStates: {
    stopped: { isStreaming: false },
    started: { isStreaming: true },
  },
} as const
