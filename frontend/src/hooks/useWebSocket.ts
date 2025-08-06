import { useEffect, useRef, useCallback } from 'react'
import { useHapticStore } from '@/contexts/hapticStore'
import { WSMessageType } from '@/types/hapticTypes'
import type { IWSMessage } from '@/types/hapticTypes'
import { logger } from '@/utils/logger'

interface UseWebSocketOptions {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export const useWebSocket = ({
  url,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  const { setConnection, setChannels, setStatus } = useHapticStore()

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: IWSMessage = JSON.parse(event.data)

        switch (message.type) {
          case WSMessageType.PARAMETERS_UPDATE:
            setChannels(message.data as any)
            break
          case WSMessageType.STATUS_UPDATE:
            setStatus(message.data as any)
            break
          case WSMessageType.ERROR:
            logger.logWebSocket('error', { error: message.data })
            break
          default:
            logger.logWebSocket('unknown_message_type', { messageType: message.type })
        }
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
      }
    },
    [setChannels, setStatus]
  )

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Check if already connected or connecting
    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        logger.logWebSocket('already_connected_or_connecting', { readyState: state, url })
        return
      }
      // Clean up existing connection if CLOSING or CLOSED
      if (state === WebSocket.CLOSING || state === WebSocket.CLOSED) {
        wsRef.current = null
      }
    }

    try {
      logger.logWebSocket('creating_connection', { url })
      wsRef.current = new WebSocket(url)

      wsRef.current.onopen = () => {
        logger.logWebSocket('connected', { url })
        setConnection(true)
        reconnectAttemptsRef.current = 0
      }

      wsRef.current.onmessage = handleMessage

      wsRef.current.onerror = error => {
        logger.logWebSocket('connection_error', { error, url })
        // Don't set connection to false here as onclose will handle it
      }

      wsRef.current.onclose = event => {
        logger.logWebSocket('disconnected', { code: event.code, reason: event.reason, url })
        setConnection(false)

        // Clear the reference
        wsRef.current = null

        // Don't reconnect if it was a manual close (code 1000) or going away (code 1001)
        if (event.code === 1000 || event.code === 1001) {
          return
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          logger.logWebSocket('reconnecting', { 
            attempt: reconnectAttemptsRef.current, 
            maxAttempts: maxReconnectAttempts, 
            waitTime: reconnectInterval,
            url 
          })

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        } else {
          logger.logWebSocket('max_reconnect_attempts_reached', { maxAttempts: maxReconnectAttempts })
          setConnection(false, 'Max reconnection attempts reached')
        }
      }
    } catch (error) {
      logger.error('Failed to create WebSocket', { error: error instanceof Error ? error.message : error, url }, error instanceof Error ? error : undefined)
      setConnection(false, 'Failed to connect')
      
      // Attempt to reconnect on creation failure
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectInterval)
      }
    }
  }, [url, handleMessage, setConnection, reconnectInterval, maxReconnectAttempts])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    logger.logWebSocket('disconnecting', { url })
    
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    // Reset reconnect attempts
    reconnectAttemptsRef.current = 0

    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        // Close with normal closure code
        wsRef.current.close(1000, 'Client disconnect')
      }
      wsRef.current = null
    }

    setConnection(false)
  }, [setConnection, url])

  // Send message
  const sendMessage = useCallback((message: IWSMessage) => {
    if (!wsRef.current) {
      logger.warn('WebSocket is not initialized', { url })
      return false
    }
    
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket is not connected', { 
        readyState: wsRef.current.readyState, 
        readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsRef.current.readyState],
        url 
      })
      
      // Attempt to reconnect if closed
      if (wsRef.current.readyState === WebSocket.CLOSED) {
        connect()
      }
      return false
    }
    
    try {
      wsRef.current.send(JSON.stringify(message))
      return true
    } catch (error) {
      logger.error('Failed to send WebSocket message', { 
        error: error instanceof Error ? error.message : error,
        message,
        url 
      }, error instanceof Error ? error : undefined)
      return false
    }
  }, [url, connect])

  // Setup and cleanup
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    sendMessage,
    disconnect,
    reconnect: connect,
  }
}
