#!/usr/bin/env python3
"""
Test script to verify local waveform generation
"""
import time
import requests
import json

BASE_URL = "http://localhost:8000"

def main():
    print("=== Local Waveform Generation Test ===\n")
    
    # 1. Check health
    print("1. Checking API health...")
    health = requests.get(f"{BASE_URL}/api/health").json()
    print(f"   Health: {health['status']}")
    
    # 2. Check device info
    print("\n2. Checking device info...")
    device_info = requests.get(f"{BASE_URL}/api/device-info").json()
    print(f"   Device: {device_info['name']} ({device_info['channels']} channels)")
    print(f"   Mode: {device_info['device_mode']}")
    
    # 3. Start streaming
    print("\n3. Starting streaming...")
    stream_start = requests.post(f"{BASE_URL}/api/streaming/start").json()
    print(f"   Streaming: {stream_start['is_streaming']}")
    
    # 4. Update channel parameters
    print("\n4. Updating channel parameters...")
    channels = [
        {"channel_id": 0, "frequency": 60, "amplitude": 0.5, "phase": 0},
        {"channel_id": 1, "frequency": 80, "amplitude": 0.3, "phase": 90},
    ]
    
    for ch in channels:
        response = requests.put(
            f"{BASE_URL}/api/channels/{ch['channel_id']}",
            json={
                "frequency": ch['frequency'],
                "amplitude": ch['amplitude'],
                "phase": ch['phase'],
                "polarity": True
            }
        )
        print(f"   Channel {ch['channel_id']}: {response.json()['status']}")
    
    # 5. Check if waveform API is being called
    print("\n5. Monitoring for waveform API calls...")
    print("   (If frontend is using local generation, there should be NO waveform API calls)")
    
    # Wait a bit to see if any waveform calls happen
    time.sleep(2)
    
    # 6. Get current parameters
    print("\n6. Current parameters:")
    params = requests.get(f"{BASE_URL}/api/parameters").json()
    for ch in params['channels'][:2]:  # Show only first 2 channels
        print(f"   Channel {ch['channelId']}: freq={ch['frequency']}Hz, amp={ch['amplitude']}")
    
    print("\n=== Test Complete ===")
    print("✓ If you see the waveforms animating in the browser without")
    print("  any '/api/waveform' calls in the backend log, the local")
    print("  generation is working correctly!")
    
    # Stop streaming
    requests.post(f"{BASE_URL}/api/streaming/stop")

if __name__ == "__main__":
    main()