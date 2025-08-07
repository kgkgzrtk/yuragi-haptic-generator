#!/usr/bin/env python
"""Check if all imports work correctly - mimics CI environment."""

import sys
import traceback

def check_imports():
    """Check all critical imports."""
    print("Python version:", sys.version)
    print("Python path:", sys.path)
    print()
    
    imports_to_check = [
        ("Basic haptic imports", [
            "from haptic_system.channel import HapticChannel",
            "from haptic_system.device import HapticDevice",
            "from haptic_system.waveform import SawtoothWaveform",
        ]),
        ("Modulation imports", [
            "from haptic_system.modulation import CircularMotionGenerator",
            "from haptic_system.modulation import AmplitudeModulator",
            "from haptic_system.modulation import NoiseGenerator",
        ]),
        ("Motion generators imports", [
            "from haptic_system.motion_generators import CircularMotionGenerator",
            "from haptic_system.motion_generators import AmplitudeModulator",
            "from haptic_system.motion_generators import NoiseGenerator",
        ]),
        ("Main app import", [
            "from main import app",
        ]),
    ]
    
    all_passed = True
    
    for section, imports in imports_to_check:
        print(f"Testing {section}:")
        for import_stmt in imports:
            try:
                exec(import_stmt)
                print(f"  ✓ {import_stmt}")
            except Exception as e:
                print(f"  ✗ {import_stmt}")
                print(f"    Error: {e}")
                traceback.print_exc()
                all_passed = False
        print()
    
    return all_passed

if __name__ == "__main__":
    success = check_imports()
    sys.exit(0 if success else 1)