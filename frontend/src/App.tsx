import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Button } from '@/components/Common/Button'
import { NotificationContainer } from '@/components/Common/NotificationContainer'
import { HapticControlPanel } from '@/components/ControlPanel/HapticControlPanel'
import { WaveformChart } from '@/components/Visualization/WaveformChart'
import { useSystemStatusQuery } from '@/hooks/queries/useHealthQuery'
import { useParametersQuery } from '@/hooks/queries/useParametersQuery'
import { useStreamingStateManager } from '@/hooks/queries/useStreamingQuery'
import { useQueryStoreIntegration } from '@/hooks/useQueryStoreIntegration'
import { useWebSocket } from '@/hooks/useWebSocket'
import { queryClient, startBackgroundSync } from '@/lib/queryClient'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import './App.css'

function HapticApp() {
  // Set up React Query and Zustand integration
  useQueryStoreIntegration()

  // Use React Query hooks for data management
  const parametersQuery = useParametersQuery()
  const systemStatusQuery = useSystemStatusQuery()
  const streamingManager = useStreamingStateManager()

  // Initialize WebSocket connection
  useWebSocket({
    url: 'ws://localhost:8000/ws',
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  })

  // Handle streaming toggle using React Query
  const toggleStreaming = streamingManager.toggleStreaming

  // Initialize background sync
  useEffect(() => {
    const cleanup = startBackgroundSync()
    return cleanup
  }, [])

  // Handle connection restoration
  useEffect(() => {
    if (systemStatusQuery.isConnected) {
      streamingManager.handleConnectionRestore()
    }
  }, [systemStatusQuery.isConnected, streamingManager])

  return (
    <div className='app'>
      <header className='app-header'>
        <h1>Yuragi Haptic Generator</h1>
        <div className='header-status'>
          <span
            className={`connection-status ${systemStatusQuery.isConnected ? 'connected' : 'disconnected'}`}
          >
            {systemStatusQuery.isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <Button
            onClick={toggleStreaming}
            variant={streamingManager.isStreaming ? 'danger' : 'primary'}
            loading={streamingManager.isToggling}
          >
            {streamingManager.isStreaming ? 'Stop Streaming' : 'Start Streaming'}
          </Button>
        </div>
      </header>

      <main className='app-main'>
        <section className='control-section'>
          {parametersQuery.isLoading ? (
            <div className='loading-state'>Loading haptic parameters...</div>
          ) : parametersQuery.isError ? (
            <div className='error-state'>
              Failed to load parameters. Please check your connection.
            </div>
          ) : (
            <HapticControlPanel />
          )}
        </section>

        <section className='visualization-section'>
          <h2>Waveform Visualization</h2>
          <div className='waveform-grid'>
            <div className='waveform-container'>
              <WaveformChart channelId={CHANNEL_IDS.DEVICE1_X} />
            </div>
            <div className='waveform-container'>
              <WaveformChart channelId={CHANNEL_IDS.DEVICE1_Y} />
            </div>
            <div className='waveform-container'>
              <WaveformChart channelId={CHANNEL_IDS.DEVICE2_X} />
            </div>
            <div className='waveform-container'>
              <WaveformChart channelId={CHANNEL_IDS.DEVICE2_Y} />
            </div>
          </div>
        </section>
      </main>

      {/* Notification system */}
      <NotificationContainer />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HapticApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
