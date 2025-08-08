"""Test Device1 and Device2 symmetry and automatic operation"""

import sys
from pathlib import Path

import numpy as np
import pytest

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.haptic_system.device import HapticDevice


class TestDeviceSymmetry:
    """Test device symmetry functionality"""

    def test_device2_opposite_rotation(self):
        """Test that Device2 rotates in opposite direction to Device1"""
        device = HapticDevice(sample_rate=44100)
        
        # Set same angle for both devices
        test_angle = 45.0
        test_magnitude = 0.5
        test_frequency = 60.0
        
        # Set Device1
        device.set_vector_force(
            device_id=1,
            angle=test_angle,
            magnitude=test_magnitude,
            frequency=test_frequency
        )
        
        # Set Device2 with same angle
        device.set_vector_force(
            device_id=2,
            angle=test_angle,
            magnitude=test_magnitude,
            frequency=test_frequency
        )
        
        # Get channel parameters
        ch0_params = device.get_channel_parameters(0)  # Device1 X
        ch1_params = device.get_channel_parameters(1)  # Device1 Y
        ch2_params = device.get_channel_parameters(2)  # Device2 X
        ch3_params = device.get_channel_parameters(3)  # Device2 Y
        
        # Calculate expected values
        # Device1: angle = 45°
        # Device2: angle = -45° (due to symmetry)
        expected_d1_x = test_magnitude * np.cos(np.deg2rad(test_angle))
        expected_d1_y = test_magnitude * np.sin(np.deg2rad(test_angle))
        expected_d2_x = test_magnitude * np.cos(np.deg2rad(-test_angle))
        expected_d2_y = test_magnitude * np.sin(np.deg2rad(-test_angle))
        
        # Verify amplitudes
        assert np.isclose(ch0_params["amplitude"], abs(expected_d1_x))
        assert np.isclose(ch1_params["amplitude"], abs(expected_d1_y))
        assert np.isclose(ch2_params["amplitude"], abs(expected_d2_x))
        assert np.isclose(ch3_params["amplitude"], abs(expected_d2_y))
        
        # Verify polarity (direction)
        assert ch0_params["polarity"] == (expected_d1_x >= 0)
        assert ch1_params["polarity"] == (expected_d1_y <= 0)  # Y is inverted
        assert ch2_params["polarity"] == (expected_d2_x >= 0)
        assert ch3_params["polarity"] == (expected_d2_y <= 0)  # Y is inverted
        
    def test_device2_automatic_activation(self):
        """Test that Device2 channels are activated even with zero magnitude"""
        device = HapticDevice(sample_rate=44100)
        
        # Set Device2 with zero magnitude
        device.set_vector_force(
            device_id=2,
            angle=0.0,
            magnitude=0.0,
            frequency=60.0
        )
        
        # Verify channels are active
        assert device.channels[2].is_active
        assert device.channels[3].is_active
        
    def test_circular_motion_symmetry(self):
        """Test circular motion creates opposite patterns for Device1 and Device2"""
        device = HapticDevice(sample_rate=44100)
        
        angles = [0, 90, 180, 270]  # Test 4 cardinal directions
        magnitude = 0.7
        frequency = 60.0
        
        for angle in angles:
            # Set both devices
            device.set_vector_force(1, angle, magnitude, frequency)
            device.set_vector_force(2, angle, magnitude, frequency)
            
            # Get parameters
            d1_x = device.get_channel_parameters(0)
            d1_y = device.get_channel_parameters(1)
            d2_x = device.get_channel_parameters(2)
            d2_y = device.get_channel_parameters(3)
            
            # For circular motion, Device2 should have opposite angle
            # This means when Device1 is at angle θ, Device2 is at -θ
            expected_d1_angle = np.deg2rad(angle)
            expected_d2_angle = np.deg2rad(-angle)
            
            # Calculate expected amplitudes
            d1_x_expected = magnitude * np.cos(expected_d1_angle)
            d1_y_expected = -magnitude * np.sin(expected_d1_angle)  # Y inverted
            d2_x_expected = magnitude * np.cos(expected_d2_angle)
            d2_y_expected = -magnitude * np.sin(expected_d2_angle)  # Y inverted
            
            # Verify amplitudes match expected values
            assert np.isclose(d1_x["amplitude"], abs(d1_x_expected), atol=1e-6)
            assert np.isclose(d1_y["amplitude"], abs(d1_y_expected), atol=1e-6)
            assert np.isclose(d2_x["amplitude"], abs(d2_x_expected), atol=1e-6)
            assert np.isclose(d2_y["amplitude"], abs(d2_y_expected), atol=1e-6)
            
    def test_all_channels_active_after_init(self):
        """Test that all channels can be activated properly"""
        device = HapticDevice(sample_rate=44100)
        
        # Activate all channels
        device.activate_all()
        
        # Verify all channels are active
        for i in range(4):
            assert device.channels[i].is_active