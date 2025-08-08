/**
 * Error handling and notification system for React Query integration
 */
import { useCallback, useEffect, useState } from 'react'
import { useHapticStore } from '@/contexts/hapticStore'
import { invalidateHapticQueries } from '@/lib/queryClient'
import { logger } from '@/utils/logger'

export interface ErrorNotification {
  id: string
  title: string
  message: string
  type: 'error' | 'warning' | 'info' | 'success'
  duration?: number
  action?: {
    label: string
    handler: () => void
  }
}

// Simple in-memory notification store (could be replaced with a proper notification library)
class NotificationManager {
  private notifications: ErrorNotification[] = []
  private listeners: ((notifications: ErrorNotification[]) => void)[] = []

  addNotification(notification: Omit<ErrorNotification, 'id'>) {
    const id = Math.random().toString(36).substring(2, 15)
    const newNotification: ErrorNotification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000,
    }

    this.notifications.push(newNotification)
    this.notifyListeners()

    // Auto remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }

  removeNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id)
    this.notifyListeners()
  }

  clearAll() {
    this.notifications = []
    this.notifyListeners()
  }

  subscribe(listener: (notifications: ErrorNotification[]) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  getNotifications() {
    return [...this.notifications]
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.notifications]))
  }
}

export const notificationManager = new NotificationManager()

/**
 * Hook for managing error notifications
 */
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([])

  useEffect(() => {
    const unsubscribe = notificationManager.subscribe(setNotifications)
    setNotifications(notificationManager.getNotifications())
    return unsubscribe
  }, [])

  const addNotification = useCallback((notification: Omit<ErrorNotification, 'id'>) => {
    return notificationManager.addNotification(notification)
  }, [])

  const removeNotification = useCallback((id: string) => {
    notificationManager.removeNotification(id)
  }, [])

  const clearAll = useCallback(() => {
    notificationManager.clearAll()
  }, [])

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
  }
}

/**
 * Hook for handling React Query errors with proper categorization
 */
export const useErrorHandler = () => {
  const setConnection = useHapticStore(state => state.setConnection)
  const { addNotification } = useNotifications()

  // Categorize errors by type
  const categorizeError = useCallback(
    (
      error: unknown
    ): {
      category: 'network' | 'validation' | 'server' | 'unknown'
      severity: 'low' | 'medium' | 'high' | 'critical'
      retryable: boolean
    } => {
      if (!error) {
        return { category: 'unknown', severity: 'low', retryable: false }
      }

      // Network errors
      if (
        error.code === 'NETWORK_ERROR' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('fetch')
      ) {
        return { category: 'network', severity: 'high', retryable: true }
      }

      // HTTP status codes
      if (error.response?.status) {
        const status = error.response.status

        if (status >= 400 && status < 500) {
          return {
            category: 'validation',
            severity: status === 422 ? 'medium' : 'high',
            retryable: false,
          }
        }

        if (status >= 500) {
          return { category: 'server', severity: 'critical', retryable: true }
        }
      }

      return { category: 'unknown', severity: 'medium', retryable: true }
    },
    []
  )

  // Handle different error types with appropriate responses
  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const { category, severity, retryable } = categorizeError(error)

      let title = 'Error'
      let message = error.message || 'An unexpected error occurred'
      let action: ErrorNotification['action'] | undefined

      switch (category) {
        case 'network':
          title = 'Connection Error'
          message = 'Unable to connect to the haptic system. Please check your connection.'
          setConnection(false, message)
          action = {
            label: 'Retry Connection',
            handler: () => {
              setConnection(true, null)
              invalidateHapticQueries.all()
            },
          }
          break

        case 'validation':
          title = 'Validation Error'
          message = `Invalid data: ${error.response?.data?.message || message}`
          break

        case 'server':
          title = 'Server Error'
          message = 'The haptic system is experiencing issues. Please try again.'
          action = retryable
            ? {
                label: 'Retry',
                handler: () => invalidateHapticQueries.all(),
              }
            : undefined
          break

        case 'unknown':
          title = 'Unexpected Error'
          break
      }

      // Add context if provided
      if (context) {
        title = `${context}: ${title}`
      }

      // Show notification based on severity
      if (severity !== 'low') {
        addNotification({
          title,
          message,
          type: severity === 'critical' ? 'error' : 'warning',
          duration: severity === 'critical' ? 0 : 5000, // Critical errors don't auto-dismiss
          action,
        })
      }

      // Log error for debugging
      logger.error(
        `[${category.toUpperCase()}] ${title}`,
        { category, title, error: error instanceof Error ? error.message : error },
        error instanceof Error ? error : undefined
      )

      return { category, severity, retryable }
    },
    [categorizeError, setConnection, addNotification]
  )

  // Retry logic with exponential backoff
  const createRetryFunction = useCallback(
    (_queryKey: unknown[], maxRetries: number = 3, baseDelay: number = 1000) => {
      return async (failureCount: number, error: unknown) => {
        const { retryable } = categorizeError(error)

        if (!retryable || failureCount >= maxRetries) {
          return false
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, failureCount) + Math.random() * 1000

        await new Promise(resolve => setTimeout(resolve, delay))

        return true
      }
    },
    [categorizeError]
  )

  // Global error handler for unhandled errors
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      handleError(event.error, 'Unhandled Error')
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(event.reason, 'Unhandled Promise Rejection')
    }

    window.addEventListener('error', handleUnhandledError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleUnhandledError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [handleError])

  return {
    handleError,
    categorizeError,
    createRetryFunction,
  }
}

/**
 * Hook for handling specific haptic system errors
 */
export const useHapticErrorHandler = () => {
  const { handleError, createRetryFunction } = useErrorHandler()

  const handleParameterError = useCallback(
    (error: unknown, channelId?: number) => {
      const context = channelId !== undefined ? `Channel ${channelId} Parameter` : 'Parameter'
      const result = handleError(error, context)

      if (result.retryable) {
        // Invalidate parameter queries for retry
        invalidateHapticQueries.parameters()
      }

      return result
    },
    [handleError]
  )

  const handleWaveformError = useCallback(
    (error: unknown) => {
      const result = handleError(error, 'Waveform Data')

      // Don't show notifications for waveform errors in real-time mode
      // as they can be frequent and annoying
      if (result.severity === 'low' || result.severity === 'medium') {
        return result
      }

      return result
    },
    [handleError]
  )

  const handleVectorForceError = useCallback(
    (error: unknown, deviceId?: number) => {
      const context = deviceId !== undefined ? `Device ${deviceId} Vector Force` : 'Vector Force'
      return handleError(error, context)
    },
    [handleError]
  )

  return {
    handleParameterError,
    handleWaveformError,
    handleVectorForceError,
    createRetryFunction,
  }
}
