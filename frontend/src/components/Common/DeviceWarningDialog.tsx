import { useEffect, useState } from 'react'
import clsx from 'clsx'
import './DeviceWarningDialog.css'

interface DeviceWarningDialogProps {
  isOpen: boolean
  deviceInfo: {
    available: boolean
    channels: number
    name: string
    device_mode: 'dual' | 'single' | 'none'
  }
  onClose: () => void
}

export function DeviceWarningDialog({ isOpen, deviceInfo, onClose }: DeviceWarningDialogProps) {
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    setIsVisible(isOpen)
  }, [isOpen])

  if (!isVisible) {
    return null
  }

  const getWarningMessage = () => {
    if (!deviceInfo.available) {
      return {
        title: 'No Audio Device Detected',
        message:
          'No compatible audio device was found. Please connect a Miraisense Haptics device or other audio output device.',
        severity: 'error' as const,
      }
    }

    if (deviceInfo.channels === 2) {
      return {
        title: '2-Channel Device Detected',
        message: `Only a 2-channel audio device (${deviceInfo.name}) was detected. The system will operate in single device mode.`,
        severity: 'warning' as const,
      }
    }

    return null
  }

  const warning = getWarningMessage()
  if (!warning) {
    return null
  }

  return (
    <div className='device-warning-overlay'>
      <div className={clsx('device-warning-dialog', warning.severity)}>
        <div className='device-warning-header'>
          <h2>{warning.title}</h2>
          <button className='close-button' onClick={onClose} aria-label='Close'>
            ×
          </button>
        </div>
        <div className='device-warning-content'>
          <p>{warning.message}</p>
          {!deviceInfo.available && (
            <div className='device-warning-instructions'>
              <h3>To use this application:</h3>
              <ol>
                <li>Connect a Miraisense Haptics device via USB</li>
                <li>Ensure the device is properly configured in your audio settings</li>
                <li>Refresh this page after connecting the device</li>
              </ol>
            </div>
          )}
          {deviceInfo.channels === 2 && (
            <div className='device-warning-info'>
              <p>In single device mode, only Device 1 controls will be available.</p>
            </div>
          )}
        </div>
        <div className='device-warning-actions'>
          <button className='action-button' onClick={() => window.location.reload()}>
            Refresh Page
          </button>
          <button className='action-button secondary' onClick={onClose}>
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
