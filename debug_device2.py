#!/usr/bin/env python3
"""
Debug script to test device2 (channels 3-4) functionality
"""

import sounddevice as sd
import numpy as np
import time
import json

def list_all_devices():
    """List all available audio devices with detailed info"""
    print("=== ALL AUDIO DEVICES ===")
    devices = sd.query_devices()
    for idx, dev in enumerate(devices):
        print(f"\n[Device {idx}]")
        print(f"  Name: {dev['name']}")
        print(f"  Max Input Channels: {dev['max_input_channels']}")
        print(f"  Max Output Channels: {dev['max_output_channels']}")
        print(f"  Default Sample Rate: {dev['default_samplerate']}")
        print(f"  Is Default Output: {idx == sd.default.device[1]}")
        if dev['max_output_channels'] >= 4:
            print(f"  ✓ Supports 4 channels (dual device mode)")
        elif dev['max_output_channels'] >= 2:
            print(f"  ✓ Supports 2 channels (single device mode)")

def test_4channel_output(device_id=None, duration=3.0):
    """Test 4-channel output with different frequencies per channel"""
    print(f"\n=== TESTING 4-CHANNEL OUTPUT ===")
    
    sample_rate = 44100
    frequencies = [60, 80, 100, 120]  # Different frequency for each channel
    
    # Generate test signals
    t = np.linspace(0, duration, int(sample_rate * duration))
    signals = []
    
    for freq in frequencies:
        signal = 0.5 * np.sin(2 * np.pi * freq * t)
        signals.append(signal)
    
    # Stack signals for 4-channel output
    output_signal = np.column_stack(signals)
    
    print(f"Testing channels with frequencies:")
    print(f"  Channel 1 (Device1 X): {frequencies[0]}Hz")
    print(f"  Channel 2 (Device1 Y): {frequencies[1]}Hz")
    print(f"  Channel 3 (Device2 X): {frequencies[2]}Hz")
    print(f"  Channel 4 (Device2 Y): {frequencies[3]}Hz")
    
    try:
        # Play the signal
        print(f"\nPlaying for {duration} seconds...")
        sd.play(output_signal, samplerate=sample_rate, device=device_id)
        sd.wait()  # Wait until playback is finished
        print("✓ Playback completed successfully")
    except Exception as e:
        print(f"✗ Error during playback: {e}")
        return False
    
    return True

def test_device2_only(device_id=None, duration=3.0):
    """Test only device2 (channels 3-4) with other channels silent"""
    print(f"\n=== TESTING DEVICE2 ONLY (Channels 3-4) ===")
    
    sample_rate = 44100
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Create 4-channel signal with only channels 3-4 active
    ch1 = np.zeros_like(t)  # Silent
    ch2 = np.zeros_like(t)  # Silent
    ch3 = 0.7 * np.sin(2 * np.pi * 100 * t)  # 100Hz on channel 3
    ch4 = 0.7 * np.sin(2 * np.pi * 120 * t)  # 120Hz on channel 4
    
    output_signal = np.column_stack([ch1, ch2, ch3, ch4])
    
    print(f"Testing with:")
    print(f"  Channels 1-2 (Device1): SILENT")
    print(f"  Channel 3 (Device2 X): 100Hz")
    print(f"  Channel 4 (Device2 Y): 120Hz")
    
    try:
        print(f"\nPlaying for {duration} seconds...")
        sd.play(output_signal, samplerate=sample_rate, device=device_id)
        sd.wait()
        print("✓ Device2 playback completed successfully")
    except Exception as e:
        print(f"✗ Error testing Device2: {e}")
        return False
    
    return True

def interactive_channel_test(device_id=None):
    """Interactive test for individual channels"""
    print(f"\n=== INTERACTIVE CHANNEL TEST ===")
    print("Commands:")
    print("  1-4: Test channel N")
    print("  a: Test all channels")
    print("  d2: Test device2 only (channels 3-4)")
    print("  q: Quit")
    
    sample_rate = 44100
    duration = 1.0
    
    while True:
        cmd = input("\nEnter command: ").strip().lower()
        
        if cmd == 'q':
            break
        elif cmd in ['1', '2', '3', '4']:
            ch_num = int(cmd) - 1
            print(f"\nTesting channel {ch_num + 1}...")
            
            # Create 4-channel signal with only selected channel active
            t = np.linspace(0, duration, int(sample_rate * duration))
            channels = [np.zeros_like(t) for _ in range(4)]
            channels[ch_num] = 0.7 * np.sin(2 * np.pi * 100 * t)
            
            output_signal = np.column_stack(channels)
            
            try:
                sd.play(output_signal, samplerate=sample_rate, device=device_id)
                sd.wait()
                print(f"✓ Channel {ch_num + 1} test completed")
            except Exception as e:
                print(f"✗ Error: {e}")
        
        elif cmd == 'a':
            test_4channel_output(device_id, duration)
        
        elif cmd == 'd2':
            test_device2_only(device_id, duration)

def main():
    print("=== HAPTIC DEVICE DEBUG TOOL ===\n")
    
    # List all devices
    list_all_devices()
    
    # Get default device info
    default_id = sd.default.device[1]
    print(f"\n=== DEFAULT OUTPUT DEVICE ===")
    print(f"Device ID: {default_id}")
    
    if default_id is not None:
        dev = sd.query_devices(default_id)
        print(f"Name: {dev['name']}")
        print(f"Channels: {dev['max_output_channels']}")
        
        # Ask if user wants to use a different device
        print("\nDo you want to:")
        print("  1. Use default device")
        print("  2. Select a specific device")
        choice = input("Enter choice (1/2): ").strip()
        
        device_id = None
        if choice == '2':
            device_id = int(input("Enter device ID: ").strip())
            print(f"\nUsing device {device_id}")
        else:
            print(f"\nUsing default device")
        
        # Run tests
        print("\n" + "="*50)
        
        # Test all channels
        if test_4channel_output(device_id):
            # If successful, test device2 specifically
            test_device2_only(device_id)
        
        # Interactive test
        interactive_channel_test(device_id)
    else:
        print("No default output device found!")

if __name__ == "__main__":
    main()