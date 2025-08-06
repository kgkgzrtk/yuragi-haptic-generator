"""
Test module for 16-direction verification mode.
Tests discrete 22.5° step control as in reference implementation.
"""

import pytest
import numpy as np
from haptic_system.device import HapticDevice


class Test16DirectionMode:
    """Test cases for 16-direction verification mode."""

    def test_device_has_16_direction_mode(self):
        """Test that HapticDevice has 16-direction mode methods."""
        device = HapticDevice(sample_rate=44100)
        assert hasattr(
            device, "enable_16_direction_mode"
        ), "Device should have 16-direction mode"
        assert hasattr(
            device, "disable_16_direction_mode"
        ), "Device should have disable method"
        assert hasattr(
            device, "set_discrete_direction"
        ), "Device should have discrete direction control"

    def test_16_direction_mode_disabled_by_default(self):
        """Test that 16-direction mode is disabled by default."""
        device = HapticDevice(sample_rate=44100)
        assert hasattr(
            device, "discrete_mode_enabled"
        ), "Device should have discrete_mode_enabled property"
        assert (
            device.discrete_mode_enabled == False
        ), "Discrete mode should be disabled by default"

    def test_enable_16_direction_mode(self):
        """Test enabling 16-direction mode."""
        device = HapticDevice(sample_rate=44100)
        device.enable_16_direction_mode()

        assert device.discrete_mode_enabled == True
        assert device.num_directions == 16
        assert device.direction_step == 22.5  # degrees

    def test_set_discrete_direction(self):
        """Test setting discrete directions (0-15)."""
        device = HapticDevice(sample_rate=44100)
        device.enable_16_direction_mode()

        # Test all 16 directions
        for idx in range(16):
            device.set_discrete_direction(
                device_id=1, direction_idx=idx, magnitude=1.0, frequency=30
            )

            # Check that angle is correctly calculated
            expected_angle = idx * 22.5
            params = device.get_channel_parameters(0)  # X channel of device 1

            # Verify angle was set correctly (through amplitude calculation)
            angle_rad = np.deg2rad(expected_angle)
            expected_x_amp = abs(np.cos(angle_rad))  # Amplitude is always positive

            assert params["amplitude"] == pytest.approx(
                expected_x_amp, abs=0.01
            ), f"Direction {idx} (angle {expected_angle}°) X amplitude mismatch"

    def test_discrete_direction_validation(self):
        """Test validation of discrete direction index."""
        device = HapticDevice(sample_rate=44100)
        device.enable_16_direction_mode()

        # Valid indices
        device.set_discrete_direction(1, 0, 1.0, 30)  # First direction
        device.set_discrete_direction(1, 15, 1.0, 30)  # Last direction

        # Invalid indices
        with pytest.raises(ValueError):
            device.set_discrete_direction(1, -1, 1.0, 30)  # Negative

        with pytest.raises(ValueError):
            device.set_discrete_direction(1, 16, 1.0, 30)  # Too high

    def test_continuous_mode_after_discrete(self):
        """Test switching back to continuous mode."""
        device = HapticDevice(sample_rate=44100)

        # Enable discrete mode
        device.enable_16_direction_mode()
        assert device.discrete_mode_enabled == True

        # Disable and go back to continuous
        device.disable_16_direction_mode()
        assert device.discrete_mode_enabled == False

        # Should accept any angle now
        device.set_vector_force(
            1, angle=47.3, magnitude=1.0, frequency=30
        )  # Arbitrary angle

    def test_16_directions_match_reference_angles(self):
        """Test that 16 directions match reference implementation angles."""
        device = HapticDevice(sample_rate=44100)
        device.enable_16_direction_mode()

        # Reference angles from implementation
        reference_angles = [22.5 * idx for idx in range(16)]

        for idx, expected_angle in enumerate(reference_angles):
            device.set_discrete_direction(1, idx, 1.0, 30)

            # Get X and Y amplitudes
            x_params = device.get_channel_parameters(0)
            y_params = device.get_channel_parameters(1)

            x_amp = x_params["amplitude"]
            y_amp = y_params["amplitude"]

            # Calculate actual angle from amplitudes
            # Need to consider polarity for correct angle calculation
            x_polarity = x_params["polarity"]
            y_polarity = y_params["polarity"]

            # Reconstruct signed amplitudes
            x_signed = x_amp if x_polarity else -x_amp
            y_signed = y_amp if y_polarity else -y_amp

            # Y is inverted in implementation, so negate it
            actual_angle = np.rad2deg(np.arctan2(-y_signed, x_signed))
            if actual_angle < 0:
                actual_angle += 360

            assert actual_angle == pytest.approx(
                expected_angle, abs=0.1
            ), f"Direction {idx} angle mismatch: expected {expected_angle}°, got {actual_angle}°"

    def test_get_all_discrete_directions(self):
        """Test getting all 16 direction angles."""
        device = HapticDevice(sample_rate=44100)
        device.enable_16_direction_mode()

        directions = device.get_discrete_directions()

        assert len(directions) == 16
        assert directions[0] == 0.0
        assert directions[1] == 22.5
        assert directions[15] == 337.5

    def test_16_direction_with_different_parameters(self):
        """Test 16-direction mode with various parameters."""
        device = HapticDevice(sample_rate=20000)  # Different sample rate
        device.enable_16_direction_mode()

        # Test with different frequencies and magnitudes
        test_cases = [
            (0, 0.5, 30),  # Half magnitude, 30Hz
            (8, 1.0, 60),  # Full magnitude, 60Hz
            (12, 0.7, 100),  # 70% magnitude, 100Hz
        ]

        for direction_idx, magnitude, frequency in test_cases:
            device.set_discrete_direction(1, direction_idx, magnitude, frequency)

            # Verify parameters are applied
            x_params = device.get_channel_parameters(0)
            assert x_params["frequency"] == frequency

            # Check magnitude scaling
            angle = direction_idx * 22.5
            angle_rad = np.deg2rad(angle)
            expected_x_amp = magnitude * abs(
                np.cos(angle_rad)
            )  # Amplitude is always positive

            assert x_params["amplitude"] == pytest.approx(expected_x_amp, abs=0.01)
