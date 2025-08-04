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
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return
    }

    try {
      wsRef.current = new WebSocket(url)

      wsRef.current.onopen = () => {
        logger.logWebSocket('connected', { url })
        setConnection(true)
        reconnectAttemptsRef.current = 0
      }

      wsRef.current.onmessage = handleMessage

      wsRef.current.onerror = error => {
        logger.logWebSocket('connection_error', { error, url })
        setConnection(false, 'Connection error')
      }

      wsRef.current.onclose = event => {
        logger.logWebSocket('disconnected', { code: event.code, reason: event.reason, url })
        setConnection(false)

        // Clear the reference so connect() can create a new connection
        wsRef.current = null

        // Don't reconnect if it was a manual close (code 1000)
        if (event.code === 1000) {
          return
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          logger.logWebSocket('reconnecting', { attempt: reconnectAttemptsRef.current, maxAttempts: maxReconnectAttempts, url })

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        } else {
          setConnection(false, 'Max reconnection attempts reached')
        }
      }
    } catch (error) {
      logger.error('Failed to create WebSocket', { error: error instanceof Error ? error.message : error, url }, error instanceof Error ? error : undefined)
      setConnection(false, 'Failed to connect')
    }
  }, [url, handleMessage, setConnection, reconnectInterval, maxReconnectAttempts])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setConnection(false)
  }, [setConnection])

  // Send message
  const sendMessage = useCallback((message: IWSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      logger.warn('WebSocket is not connected', { readyState: wsRef.current?.readyState, url })
    }
  }, [url])

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
