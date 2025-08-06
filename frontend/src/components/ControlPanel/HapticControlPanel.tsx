import React from 'react'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import { ChannelControl } from './ChannelControl'
import { VectorControl } from './VectorControl'

interface HapticControlPanelProps {
  isSingleDeviceMode?: boolean
}

export const HapticControlPanel: React.FC<HapticControlPanelProps> = ({
  isSingleDeviceMode = false,
}) => {
  return (
    <div className='haptic-control-panel'>
      <h2 className='panel-title'>Haptic Control System</h2>

      <div className={`device-controls ${isSingleDeviceMode ? 'single-device' : ''}`}>
        <div className='device-section'>
          <h3 className='device-title'>Device 1</h3>
          <div className='channel-controls'>
            <ChannelControl channelId={CHANNEL_IDS.DEVICE1_X} label='X Axis (Channel 0)' />
            <ChannelControl channelId={CHANNEL_IDS.DEVICE1_Y} label='Y Axis (Channel 1)' />
          </div>
          <VectorControl deviceId={1} />
        </div>

        {!isSingleDeviceMode && (
          <div className='device-section'>
            <h3 className='device-title'>Device 2</h3>
            <div className='channel-controls'>
              <ChannelControl channelId={CHANNEL_IDS.DEVICE2_X} label='X Axis (Channel 2)' />
              <ChannelControl channelId={CHANNEL_IDS.DEVICE2_Y} label='Y Axis (Channel 3)' />
            </div>
            <VectorControl deviceId={2} />
          </div>
        )}
      </div>
    </div>
  )
}

export default HapticControlPanel
