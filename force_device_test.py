#!/usr/bin/env python3
"""
Test script to force specific device selection for debugging
"""

import asyncio
import sounddevice as sd
from backend.src.haptic_system.controller import HapticController

async def test_specific_device(device_id: int):
    """Test haptic controller with a specific device ID"""
    print(f"\n=== TESTING WITH DEVICE {device_id} ===")
    
    # Create controller
    controller = HapticController(sample_rate=44100, block_size=512)
    
    # Override device selection
    if device_id is not None:
        controller.device_info['device_id'] = device_id
        dev = sd.query_devices(device_id)
        controller.device_info['name'] = dev['name']
        controller.device_info['channels'] = min(4, dev['max_output_channels'])
        controller.available_channels = controller.device_info['channels']
        print(f"Forced device: {dev['name']} with {controller.available_channels} channels")
    
    # Test device2
    print("\nTesting Device2 (channels 3-4)...")
    controller.device.set_vector_force(
        device_id=2,
        angle=45,
        magnitude=0.8,
        frequency=100
    )
    
    # Start streaming
    controller.start_streaming()
    print("Streaming started. You should hear 100Hz on Device2.")
    
    # Wait
    await asyncio.sleep(3)
    
    # Stop
    controller.stop_streaming()
    print("Streaming stopped.")
    
    return controller

async def main():
    """Main test function"""
    # List devices
    print("=== AVAILABLE DEVICES ===")
    devices = sd.query_devices()
    four_ch_devices = []
    
    for idx, dev in enumerate(devices):
        if dev['max_output_channels'] >= 4:
            print(f"Device {idx}: {dev['name']} - {dev['max_output_channels']} channels")
            four_ch_devices.append(idx)
    
    if not four_ch_devices:
        print("No 4-channel devices found!")
        return
    
    # Test each 4-channel device
    for device_id in four_ch_devices:
        await test_specific_device(device_id)
        
    print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(main())