/**
 * Frontend logging utility
 * Provides structured logging with different levels and remote logging capabilities
 */

import { env, isDevelopment, isProduction } from '@/config/environment'

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string
  level: string
  message: string
  context?: Record<string, any>
  stack?: string
  url?: string
  userAgent?: string
  userId?: string
  sessionId?: string
}

class Logger {
  private logLevel: LogLevel
  private sessionId: string
  private userId?: string
  private remoteLoggingEnabled: boolean

  constructor() {
    // Set log level based on environment
    this.logLevel = this.parseLogLevel(env.logLevel)
    this.sessionId = this.generateSessionId()
    this.remoteLoggingEnabled = isProduction && env.enableAnalytics
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG
      case 'info':
        return LogLevel.INFO
      case 'warn':
        return LogLevel.WARN
      case 'error':
        return LogLevel.ERROR
      default:
        return LogLevel.INFO
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
    }

    if (context) {
      entry.context = context
    }

    if (this.userId) {
      entry.userId = this.userId
    }

    if (error && error.stack) {
      entry.stack = error.stack
    }

    return entry
  }

  private logToConsole(entry: LogEntry): void {
    if (!env.enableLogging) {
      return
    }

    const { level, message, context, stack } = entry
    const consoleArgs = [
      `[${entry.timestamp}] ${level}: ${message}`,
      ...(context ? [context] : []),
      ...(stack ? [stack] : []),
    ]

    switch (level) {
      case 'DEBUG':
        // eslint-disable-next-line no-console
        console.debug(...consoleArgs)
        break
      case 'INFO':
        console.info(...consoleArgs)
        break
      case 'WARN':
        console.warn(...consoleArgs)
        break
      case 'ERROR':
        console.error(...consoleArgs)
        break
    }
  }

  private async logToRemote(entry: LogEntry): Promise<void> {
    if (!this.remoteLoggingEnabled) {
      return
    }

    try {
      // In a real implementation, you would send logs to your logging service
      // For example: Sentry, LogRocket, DataDog, etc.
      await fetch(`${env.apiBaseUrl}/api/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      })
    } catch (error) {
      // Fail silently to avoid recursive logging
      console.warn('Failed to send log to remote service:', error)
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return
    }

    const entry = this.createLogEntry(level, message, context, error)

    // Always log to console in development
    if (isDevelopment || env.enableLogging) {
      this.logToConsole(entry)
    }

    // Send to remote service in production
    if (isProduction && this.remoteLoggingEnabled) {
      this.logToRemote(entry).catch(() => {
        // Fail silently
      })
    }

    // Store in local storage for debugging (limited to last 100 entries)
    this.storeLocalLog(entry)
  }

  private storeLocalLog(entry: LogEntry): void {
    try {
      const logs = this.getLocalLogs()
      logs.push(entry)

      // Keep only last 100 entries
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100)
      }

      localStorage.setItem('haptic_logs', JSON.stringify(logs))
    } catch (error) {
      // Storage might be full or unavailable
    }
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context)
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context)
  }

  public error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  public setUserId(userId: string): void {
    this.userId = userId
  }

  public getLocalLogs(): LogEntry[] {
    try {
      const logs = localStorage.getItem('haptic_logs')
      return logs ? JSON.parse(logs) : []
    } catch {
      return []
    }
  }

  public clearLocalLogs(): void {
    try {
      localStorage.removeItem('haptic_logs')
    } catch {
      // Fail silently
    }
  }

  public exportLogs(): string {
    const logs = this.getLocalLogs()
    return JSON.stringify(logs, null, 2)
  }

  // Performance logging
  public logPerformance(name: string, duration: number, context?: Record<string, any>): void {
    this.info(`Performance: ${name}`, {
      duration_ms: duration,
      ...context,
    })
  }

  // API call logging
  public logApiCall(
    method: string,
    url: string,
    status: number,
    duration: number,
    context?: Record<string, any>
  ): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO
    this.log(level, `API Call: ${method} ${url}`, {
      method,
      url,
      status,
      duration_ms: duration,
      ...context,
    })
  }

  // User action logging
  public logUserAction(action: string, context?: Record<string, any>): void {
    this.info(`User Action: ${action}`, {
      action,
      ...context,
    })
  }

  // WebSocket logging
  public logWebSocket(event: string, context?: Record<string, any>): void {
    this.debug(`WebSocket: ${event}`, {
      event,
      ...context,
    })
  }
}

// Create singleton instance
export const logger = new Logger()

// Performance monitoring utilities
export const withPerformanceLogging = <T extends (...args: any[]) => any>(
  fn: T,
  name?: string
): T => {
  return ((...args: any[]) => {
    const start = performance.now()
    const result = fn(...args)
    const duration = performance.now() - start

    logger.logPerformance(name || fn.name, duration)

    return result
  }) as T
}

export const measureAsync = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    logger.logPerformance(name, duration, { success: true })
    return result
  } catch (error) {
    const duration = performance.now() - start
    logger.logPerformance(name, duration, { success: false })
    logger.error(`${name} failed`, { error: error instanceof Error ? error.message : error })
    throw error
  }
}

// Error boundary logging
export const logErrorBoundary = (error: Error, errorInfo: { componentStack: string }): void => {
  logger.error(
    'React Error Boundary caught error',
    {
      error: error.message,
      componentStack: errorInfo.componentStack,
    },
    error
  )
}

export default logger
