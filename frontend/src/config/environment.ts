/**
 * Environment Configuration Service
 * Centralizes all environment variable access and provides type safety
 */

interface EnvironmentConfig {
  // API Configuration
  apiBaseUrl: string
  wsBaseUrl: string

  // App Configuration
  appTitle: string
  appDescription: string
  appVersion: string

  // Development Configuration
  devTools: boolean
  enableLogging: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'

  // WebSocket Configuration
  wsReconnectAttempts: number
  wsReconnectInterval: number

  // Chart Configuration
  chartUpdateInterval: number
  chartMaxDataPoints: number

  // Performance Configuration
  enablePerformanceMonitoring: boolean
  bundleAnalysis: boolean

  // Feature Flags
  enableE2ETesting: boolean
  enableAnalytics: boolean
}

/**
 * Parse environment variable as boolean
 */
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) {
    return defaultValue
  }
  return value.toLowerCase() === 'true'
}

/**
 * Parse environment variable as number
 */
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) {
    return defaultValue
  }
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Validate log level
 */
const parseLogLevel = (value: string | undefined): 'debug' | 'info' | 'warn' | 'error' => {
  const validLevels = ['debug', 'info', 'warn', 'error'] as const
  if (!value || !validLevels.includes(value as (typeof validLevels)[number])) {
    return 'info'
  }
  return value as 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Environment configuration object
 */
export const env: EnvironmentConfig = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000',

  // App Configuration
  appTitle: import.meta.env.VITE_APP_TITLE || 'Yuragi Haptic Generator',
  appDescription:
    import.meta.env.VITE_APP_DESCRIPTION || 'Sawtooth wave-based haptic feedback system',
  appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0',

  // Development Configuration
  devTools: parseBoolean(import.meta.env.VITE_DEV_TOOLS, true),
  enableLogging: parseBoolean(import.meta.env.VITE_ENABLE_LOGGING, true),
  logLevel: parseLogLevel(import.meta.env.VITE_LOG_LEVEL),

  // WebSocket Configuration
  wsReconnectAttempts: parseNumber(import.meta.env.VITE_WS_RECONNECT_ATTEMPTS, 5),
  wsReconnectInterval: parseNumber(import.meta.env.VITE_WS_RECONNECT_INTERVAL, 3000),

  // Chart Configuration
  chartUpdateInterval: parseNumber(import.meta.env.VITE_CHART_UPDATE_INTERVAL, 100),
  chartMaxDataPoints: parseNumber(import.meta.env.VITE_CHART_MAX_DATA_POINTS, 1000),

  // Performance Configuration
  enablePerformanceMonitoring: parseBoolean(
    import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING,
    false
  ),
  bundleAnalysis: parseBoolean(import.meta.env.VITE_BUNDLE_ANALYSIS, false),

  // Feature Flags
  enableE2ETesting: parseBoolean(import.meta.env.VITE_ENABLE_E2E_TESTING, false),
  enableAnalytics: parseBoolean(import.meta.env.VITE_ENABLE_ANALYTICS, false),
}

/**
 * Check if we're in development mode
 */
export const isDevelopment = import.meta.env.DEV

/**
 * Check if we're in production mode
 */
export const isProduction = import.meta.env.PROD

/**
 * Get build-time information
 */
export const buildInfo = {
  version: (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ || env.appVersion,
  buildTime: (globalThis as { __BUILD_TIME__?: string }).__BUILD_TIME__ || new Date().toISOString(),
}

/**
 * Log environment configuration (only in development)
 */
if (isDevelopment && env.enableLogging) {
  console.info('🌍 Environment Configuration')
  console.info('Mode:', import.meta.env.MODE)
  console.info('API Base URL:', env.apiBaseUrl)
  console.info('WebSocket URL:', env.wsBaseUrl)
  console.info('Dev Tools:', env.devTools)
  console.info('Logging:', env.enableLogging)
  console.info('Log Level:', env.logLevel)
}
