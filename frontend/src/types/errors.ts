/**
 * Error type definitions for the haptic system
 */

// Base error interface
export interface BaseError {
  code: string
  message: string
  timestamp?: string
}

// API-related errors
export interface APIError extends BaseError {
  status?: number
  endpoint?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  details?: Record<string, unknown>
}

// WebSocket connection errors
export interface WebSocketError extends BaseError {
  reason?: string
  wasClean?: boolean
  reconnectAttempts?: number
  lastSuccessfulConnection?: string
}

// Validation errors for form inputs and data
export interface ValidationError extends BaseError {
  field?: string
  value?: unknown
  constraints?: string[]
}

// Network connectivity errors
export interface NetworkError extends BaseError {
  isOnline?: boolean
  timeout?: number
  retryCount?: number
}

// Union type for all possible errors
export type HapticError = APIError | WebSocketError | ValidationError | NetworkError

// Error type guards
export const isAPIError = (error: unknown): error is APIError => {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error && 'status' in error
}

export const isWebSocketError = (error: unknown): error is WebSocketError => {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error && 'wasClean' in error
}

export const isValidationError = (error: unknown): error is ValidationError => {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error && 'field' in error
}

export const isNetworkError = (error: unknown): error is NetworkError => {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error && 'isOnline' in error
}

// Error creation helpers
export const createAPIError = (
  message: string,
  status?: number,
  endpoint?: string,
  method?: APIError['method'],
  details?: Record<string, unknown>
): APIError => ({
  code: 'API_ERROR',
  message,
  status,
  endpoint,
  method,
  details,
  timestamp: new Date().toISOString(),
})

export const createWebSocketError = (
  message: string,
  reason?: string,
  wasClean = false,
  reconnectAttempts = 0
): WebSocketError => ({
  code: 'WEBSOCKET_ERROR',
  message,
  reason,
  wasClean,
  reconnectAttempts,
  timestamp: new Date().toISOString(),
})

export const createValidationError = (
  message: string,
  field?: string,
  value?: unknown,
  constraints?: string[]
): ValidationError => ({
  code: 'VALIDATION_ERROR',
  message,
  field,
  value,
  constraints,
  timestamp: new Date().toISOString(),
})

export const createNetworkError = (
  message: string,
  isOnline = navigator.onLine,
  timeout?: number,
  retryCount = 0
): NetworkError => ({
  code: 'NETWORK_ERROR',
  message,
  isOnline,
  timeout,
  retryCount,
  timestamp: new Date().toISOString(),
})

// Common error codes
export const ERROR_CODES = {
  // API errors
  API_TIMEOUT: 'API_TIMEOUT',
  API_UNAUTHORIZED: 'API_UNAUTHORIZED',
  API_FORBIDDEN: 'API_FORBIDDEN',
  API_NOT_FOUND: 'API_NOT_FOUND',
  API_SERVER_ERROR: 'API_SERVER_ERROR',
  API_BAD_REQUEST: 'API_BAD_REQUEST',

  // WebSocket errors
  WEBSOCKET_CONNECTION_FAILED: 'WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_UNEXPECTED_CLOSE: 'WEBSOCKET_UNEXPECTED_CLOSE',
  WEBSOCKET_PROTOCOL_ERROR: 'WEBSOCKET_PROTOCOL_ERROR',

  // Validation errors
  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  VALIDATION_INVALID_TYPE: 'VALIDATION_INVALID_TYPE',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',

  // Network errors
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_REFUSED: 'NETWORK_CONNECTION_REFUSED',
} as const

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Extended error with severity
export interface SeverityError extends BaseError {
  severity: ErrorSeverity
}
