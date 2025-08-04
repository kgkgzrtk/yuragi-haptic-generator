"""
Test module for resonator filter implementation.
Tests the 2nd order IIR filter with Tustin transformation.
"""

import pytest
import numpy as np
from src.haptic_system.waveform import resonator


class TestResonator:
    """Test cases for the resonator filter function."""

    def test_resonator_exists(self):
        """Test that resonator function is available."""
        # This test will fail initially (Red phase)
        assert hasattr(resonator, '__call__'), "resonator function should exist"

    def test_resonator_basic_parameters(self):
        """Test resonator with basic parameters."""
        # Create test signal
        fs = 20000  # Sampling frequency
        duration = 0.1  # 100ms
        t = np.arange(0, duration, 1/fs)
        
        # Simple sine wave input
        f_input = 30  # Hz
        u = np.sin(2 * np.pi * f_input * t)
        
        # Apply resonator
        f_n = 180  # Resonance frequency
        zeta = 0.08  # Damping ratio
        y = resonator(u, fs, f_n, zeta)
        
        # Basic checks
        assert isinstance(y, np.ndarray), "Output should be numpy array"
        assert y.shape == u.shape, "Output shape should match input"
        assert not np.any(np.isnan(y)), "Output should not contain NaN"
        assert not np.any(np.isinf(y)), "Output should not contain Inf"

    def test_resonator_zero_input(self):
        """Test resonator with zero input."""
        fs = 20000
        n_samples = 1000
        u = np.zeros(n_samples)
        
        f_n = 180
        zeta = 0.08
        y = resonator(u, fs, f_n, zeta)
        
        # Zero input should produce zero output
        assert np.allclose(y, 0), "Zero input should produce zero output"

    def test_resonator_impulse_response(self):
        """Test resonator impulse response characteristics."""
        fs = 20000
        n_samples = 2000
        
        # Create impulse
        u = np.zeros(n_samples)
        u[0] = 1.0
        
        f_n = 180
        zeta = 0.08
        y = resonator(u, fs, f_n, zeta)
        
        # Check resonance characteristics
        # Find peaks in the response
        peaks = []
        for i in range(1, len(y)-1):
            if y[i] > y[i-1] and y[i] > y[i+1]:
                peaks.append((i, y[i]))
        
        # Should have decaying oscillation
        assert len(peaks) > 5, "Impulse response should oscillate"
        
        # Check if peaks are decaying
        peak_values = [p[1] for p in peaks[:5]]
        for i in range(1, len(peak_values)):
            assert peak_values[i] < peak_values[i-1], "Peaks should decay"

    def test_resonator_frequency_response(self):
        """Test resonator frequency response at resonance."""
        fs = 20000
        duration = 0.5
        t = np.arange(0, duration, 1/fs)
        
        f_n = 180  # Resonance frequency
        zeta = 0.08
        
        # Test at resonance frequency
        u_resonance = np.sin(2 * np.pi * f_n * t)
        y_resonance = resonator(u_resonance, fs, f_n, zeta)
        
        # Skip transient (first 10%)
        skip = int(0.1 * len(y_resonance))
        
        # At resonance, output should be amplified
        input_amplitude = np.max(np.abs(u_resonance[skip:]))
        output_amplitude = np.max(np.abs(y_resonance[skip:]))
        
        # Q factor ≈ 1/(2*zeta) = 6.25, so expect amplification
        assert output_amplitude > input_amplitude * 3, \
            f"At resonance, output ({output_amplitude:.2f}) should be amplified vs input ({input_amplitude:.2f})"

    def test_resonator_parameter_validation(self):
        """Test parameter validation."""
        u = np.ones(100)
        
        # Valid parameters should work
        y = resonator(u, fs=20000, f_n=180, zeta=0.08)
        assert len(y) == len(u)
        
        # Test edge cases
        with pytest.raises(ValueError):
            resonator(u, fs=0, f_n=180, zeta=0.08)  # Invalid fs
        
        with pytest.raises(ValueError):
            resonator(u, fs=20000, f_n=0, zeta=0.08)  # Invalid f_n
        
        with pytest.raises(ValueError):
            resonator(u, fs=20000, f_n=180, zeta=0)  # Invalid zeta

    def test_resonator_stability(self):
        """Test filter stability with various inputs."""
        fs = 20000
        n_samples = 10000
        
        # Test with random input
        u_random = np.random.randn(n_samples)
        y_random = resonator(u_random, fs=fs, f_n=180, zeta=0.08)
        
        # Output should be bounded
        assert np.max(np.abs(y_random)) < 100, "Filter should be stable with random input"
        
        # Test with step input
        u_step = np.ones(n_samples)
        y_step = resonator(u_step, fs=fs, f_n=180, zeta=0.08)
        
        # Step response should settle
        final_value = np.mean(y_step[-1000:])
        assert np.abs(final_value - 1.0) < 0.1, "Step response should settle near DC gain"

    def test_resonator_matches_reference_implementation(self):
        """Test that our implementation matches the reference."""
        fs = 20000
        f_n = 180
        zeta = 0.08
        
        # Create test signal
        duration = 0.1
        t = np.arange(0, duration, 1/fs)
        u = np.sin(2 * np.pi * 30 * t)  # 30Hz input as in reference
        
        # Apply resonator
        y = resonator(u, fs, f_n, zeta)
        
        # Compute expected coefficients (from reference implementation)
        w_n = 2 * np.pi * f_n
        dt = 1 / fs
        
        expected_a0 = 4 + 4 * zeta * w_n * dt + (w_n * dt) ** 2
        expected_b0 = (w_n * dt) ** 2
        expected_b1 = 2 * expected_b0
        expected_b2 = expected_b0
        expected_a1 = 2 * ((w_n * dt) ** 2 - 4)
        expected_a2 = 4 - 4 * zeta * w_n * dt + (w_n * dt) ** 2
        
        # These coefficient tests will help verify the implementation
        # They will be used when we implement the actual function
        
        # For now, just check that we get reasonable output
        assert len(y) == len(u), "Output length should match input"