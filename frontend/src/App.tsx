import { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { NotificationContainer } from '@/components/Common/NotificationContainer'
import { DeviceWarningDialog } from '@/components/Common/DeviceWarningDialog'
import { HapticControlPanel } from '@/components/ControlPanel/HapticControlPanel'
import { AccelerationTrajectoryContainer } from '@/components/Visualization/AccelerationTrajectoryContainer'
import { WaveformChartContainer } from '@/components/Visualization/WaveformChartContainer'
import { useDeviceInfoQuery } from '@/hooks/queries/useDeviceQuery'
import { useSystemStatusQuery } from '@/hooks/queries/useHealthQuery'
import { useParametersQuery } from '@/hooks/queries/useParametersQuery'
import { useQueryStoreIntegration } from '@/hooks/useQueryStoreIntegration'
import { queryClient, startBackgroundSync } from '@/lib/queryClient'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import './App.css'

function HapticApp() {
  // Set up React Query and Zustand integration
  useQueryStoreIntegration()

  // State for device warning dialog
  const [showDeviceWarning, setShowDeviceWarning] = useState(false)

  // Use React Query hooks for data management
  const parametersQuery = useParametersQuery()
  const systemStatusQuery = useSystemStatusQuery()
  const deviceQuery = useDeviceInfoQuery()


  // Initialize background sync
  useEffect(() => {
    const cleanup = startBackgroundSync()
    return cleanup
  }, [])

  // Check device availability on mount and when device info changes
  useEffect(() => {
    if (deviceQuery.data) {
      const { available, channels } = deviceQuery.data
      if (!available || channels < 4) {
        setShowDeviceWarning(true)
      }
    }
  }, [deviceQuery.data])

  // Determine if we're in single device mode
  const isSingleDeviceMode = deviceQuery.data?.device_mode === 'single'

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
            <HapticControlPanel isSingleDeviceMode={isSingleDeviceMode} />
          )}
        </section>

        <section className='visualization-section'>
          <h2>Visualization</h2>

          <div className='visualization-subsection'>
            <h3>Waveforms</h3>
            <div className={`waveform-grid ${isSingleDeviceMode ? 'single-device' : ''}`}>
              <div className='waveform-container'>
                <WaveformChartContainer channelId={CHANNEL_IDS.DEVICE1_X} />
              </div>
              <div className='waveform-container'>
                <WaveformChartContainer channelId={CHANNEL_IDS.DEVICE1_Y} />
              </div>
              {!isSingleDeviceMode && (
                <>
                  <div className='waveform-container'>
                    <WaveformChartContainer channelId={CHANNEL_IDS.DEVICE2_X} />
                  </div>
                  <div className='waveform-container'>
                    <WaveformChartContainer channelId={CHANNEL_IDS.DEVICE2_Y} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className='visualization-subsection'>
            <h3>Acceleration Trajectory</h3>
            <div className={`trajectory-grid ${isSingleDeviceMode ? 'single-device' : ''}`}>
              <AccelerationTrajectoryContainer deviceId={1} />
              {!isSingleDeviceMode && (
                <AccelerationTrajectoryContainer deviceId={2} />
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Device warning dialog */}
      {deviceQuery.data && (
        <DeviceWarningDialog
          isOpen={showDeviceWarning}
          deviceInfo={deviceQuery.data}
          onClose={() => setShowDeviceWarning(false)}
        />
      )}

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
