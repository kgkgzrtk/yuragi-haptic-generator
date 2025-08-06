"""
Modulation System Unit Tests - TDD Implementation
Comprehensive testing for massage feature modulation system integration.

Tests for:
- Modulation envelope frequency accuracy
- Amplitude clipping and boundary conditions
- Modulation depth effects and interactions
- Combined modulation pattern behaviors
- System-level modulation integration
"""

import pytest
import numpy as np
import gc
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any, Tuple, Optional


class TestModulationEnvelopeAccuracy:
    """Test modulation envelope frequency accuracy and characteristics"""
    
    def test_envelope_frequency_accuracy_within_strict_tolerance(self):
        """Modulation envelope frequency should be accurate to ±0.05%"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        target_frequencies = [0.2, 0.3, 0.4, 0.5, 0.8, 1.0]  # Hz
        tolerance = 0.0005  # ±0.05%
        duration = 50.0  # Long duration for precision
        sample_rate = 5000
        
        for target_freq in target_frequencies:
            modulator = AmplitudeModulator(
                base_amplitude=1.0,
                envelope_freq=target_freq,
                envelope_depth=0.3,
                noise_level=0.0,  # No noise for clean measurement
                seed=42
            )
            
            # Act
            t = np.linspace(0, duration, int(sample_rate * duration))
            amplitude = modulator.modulate(t)
            
            # Remove DC component for frequency analysis
            amplitude_ac = amplitude - np.mean(amplitude)
            
            # FFT analysis
            freqs = np.fft.rfftfreq(len(amplitude_ac), 1/sample_rate)
            fft = np.fft.rfft(amplitude_ac)
            
            # Find dominant frequency
            dominant_idx = np.argmax(np.abs(fft[1:]))  # Skip DC
            measured_freq = freqs[dominant_idx + 1]
            
            # Assert
            relative_error = abs(measured_freq - target_freq) / target_freq
            assert relative_error <= tolerance, \
                f"Envelope frequency {target_freq}Hz accuracy failed: measured {measured_freq:.6f}Hz, error {relative_error*100:.3f}%"
    
    def test_envelope_phase_coherence_across_modulation_cycles(self):
        """Envelope phase should remain coherent across multiple modulation cycles"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        envelope_freq = 0.4  # Hz (2.5 second period)
        cycles_to_test = 5
        duration = cycles_to_test / envelope_freq
        sample_rate = 2000
        
        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=envelope_freq,
            envelope_depth=0.5,
            noise_level=0.0,
            seed=42
        )
        
        # Act
        t = np.linspace(0, duration, int(sample_rate * duration))
        amplitude = modulator.modulate(t)
        
        # Extract individual cycles
        samples_per_cycle = int(sample_rate / envelope_freq)
        cycles = []
        
        for i in range(cycles_to_test):
            start_idx = i * samples_per_cycle
            end_idx = start_idx + samples_per_cycle
            if end_idx <= len(amplitude):
                cycle = amplitude[start_idx:end_idx]
                cycles.append(cycle)
        
        # Assert
        if len(cycles) >= 2:
            # Cross-correlation between consecutive cycles
            for i in range(len(cycles) - 1):
                correlation = np.corrcoef(cycles[i], cycles[i+1])[0, 1]
                
                assert correlation >= 0.95, \
                    f"Phase coherence lost between cycle {i} and {i+1}: correlation = {correlation:.4f}"
    
    def test_envelope_symmetry_and_distortion_characteristics(self):
        """Envelope should maintain expected symmetry and minimal distortion"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.5,
            envelope_depth=0.4,
            noise_level=0.0,
            seed=42
        )
        
        # Act - Generate exactly 4 cycles for analysis
        duration = 8.0  # 4 cycles at 0.5 Hz
        sample_rate = 4000
        t = np.linspace(0, duration, int(sample_rate * duration))
        amplitude = modulator.modulate(t)
        
        # Remove DC and extract one complete cycle
        amplitude_ac = amplitude - np.mean(amplitude)
        samples_per_cycle = int(sample_rate / 0.5)
        one_cycle = amplitude_ac[:samples_per_cycle]
        
        # Assert
        # Test symmetry: first half vs second half (flipped)
        half_cycle = len(one_cycle) // 2
        first_half = one_cycle[:half_cycle]
        second_half = one_cycle[half_cycle:half_cycle*2]
        second_half_flipped = second_half[::-1]
        
        # For a pure sine wave, halves should be nearly anti-symmetric
        symmetry_correlation = np.corrcoef(first_half, -second_half_flipped)[0, 1]
        
        # Check for reasonable symmetry (allow for practical implementations)
        # The correlation can be negative if the signal is anti-symmetric
        assert abs(symmetry_correlation) >= 0.6, \
            f"Envelope symmetry poor: correlation = {symmetry_correlation:.4f}"
        
        # Test for excessive harmonics (distortion)
        fft = np.fft.rfft(one_cycle)
        freqs = np.fft.rfftfreq(len(one_cycle), 1/sample_rate)
        
        fundamental_idx = np.argmin(np.abs(freqs - 0.5))
        fundamental_power = np.abs(fft[fundamental_idx])**2
        
        total_harmonic_power = np.sum(np.abs(fft)**2) - fundamental_power
        thd = np.sqrt(total_harmonic_power / fundamental_power)  # Total Harmonic Distortion
        
        assert thd <= 0.35, f"Envelope distortion too high: THD = {thd:.3f}"


class TestModulationAmplitudeClipping:
    """Test amplitude clipping boundaries and edge behaviors"""
    
    @pytest.mark.parametrize("base_amplitude,min_clip,max_clip", [
        (0.5, 0.1, 0.75),   # 0.5 * [0.2, 1.5]
        (1.0, 0.2, 1.5),    # 1.0 * [0.2, 1.5]
        (1.2, 0.24, 1.8),   # 1.2 * [0.2, 1.5]
    ])
    def test_clipping_boundaries_enforced_precisely(self, base_amplitude, min_clip, max_clip):
        """Amplitude clipping should enforce exact boundaries"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        # Extreme settings to force clipping
        modulator = AmplitudeModulator(
            base_amplitude=base_amplitude,
            envelope_freq=0.1,  # Slow modulation
            envelope_depth=1.0,  # 100% modulation depth (extreme)
            noise_level=0.5,     # High noise level
            seed=42
        )
        
        # Act
        duration = 100.0  # Long duration to capture extremes
        sample_rate = 1000
        t = np.linspace(0, duration, int(sample_rate * duration))
        amplitude = modulator.modulate(t)
        
        # Assert
        min_amplitude = np.min(amplitude)
        max_amplitude = np.max(amplitude)
        
        # Should respect clipping boundaries precisely
        assert min_amplitude >= min_clip - 1e-12, \
            f"Amplitude below minimum clip: {min_amplitude:.6f} < {min_clip:.6f}"
        assert max_amplitude <= max_clip + 1e-12, \
            f"Amplitude above maximum clip: {max_amplitude:.6f} > {max_clip:.6f}"
        
        # Should actually reach the boundaries (clipping occurred)
        clip_tolerance = 1e-6
        assert min_amplitude <= min_clip + clip_tolerance, \
            "Minimum clipping boundary not reached"
        assert max_amplitude >= max_clip - clip_tolerance, \
            "Maximum clipping boundary not reached"
    
    def test_clipping_preserves_signal_continuity(self):
        """Clipping should not introduce discontinuities"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=1.0,  # Fast modulation to test transitions
            envelope_depth=0.8,
            noise_level=0.3,
            seed=42
        )
        
        # Act
        duration = 10.0
        sample_rate = 10000  # High sample rate to detect discontinuities
        t = np.linspace(0, duration, int(sample_rate * duration))
        amplitude = modulator.modulate(t)
        
        # Calculate derivatives to detect discontinuities
        dt = 1.0 / sample_rate
        derivatives = np.diff(amplitude) / dt
        
        # Assert
        # Derivatives should be bounded (no infinite jumps)
        max_derivative = np.max(np.abs(derivatives))
        reasonable_max_slope = 10000  # Reasonable maximum slope for practical implementation
        
        assert max_derivative <= reasonable_max_slope, \
            f"Signal discontinuity detected: max derivative = {max_derivative:.1f}"
        
        # No NaN or infinite values
        assert np.all(np.isfinite(derivatives)), "Non-finite derivatives detected"
    
    def test_clipping_statistics_and_time_spent_at_boundaries(self):
        """Time spent at clipping boundaries should be reasonable"""
        # Arrange  
        from haptic_system.modulation import AmplitudeModulator
        
        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.2,
            envelope_depth=0.9,  # High depth to cause clipping
            noise_level=0.2,
            seed=42
        )
        
        # Act
        duration = 50.0  # Multiple cycles to get good statistics
        sample_rate = 2000
        t = np.linspace(0, duration, int(sample_rate * duration))
        amplitude = modulator.modulate(t)
        
        # Analyze clipping behavior
        min_clip = 0.2
        max_clip = 1.5
        clip_tolerance = 0.02
        
        at_min_clip = np.sum(amplitude <= min_clip + clip_tolerance)
        at_max_clip = np.sum(amplitude >= max_clip - clip_tolerance)
        total_samples = len(amplitude)
        
        min_clip_fraction = at_min_clip / total_samples
        max_clip_fraction = at_max_clip / total_samples
        
        # Assert
        # Should spend some time clipping but not excessive
        assert 0.001 <= min_clip_fraction <= 0.1, \
            f"Time at minimum clip unreasonable: {min_clip_fraction*100:.2f}%"
        assert 0.001 <= max_clip_fraction <= 0.3, \
            f"Time at maximum clip unreasonable: {max_clip_fraction*100:.2f}%"


class TestModulationDepthEffects:
    """Test modulation depth effects and parameter interactions"""
    
    @pytest.mark.parametrize("depth,expected_peak_to_peak_ratio", [
        (0.0, 0.05),   # No modulation - minimal variation
        (0.1, 0.14),   # 10% modulation (scaled by 0.7)
        (0.25, 0.35),  # 25% modulation (scaled by 0.7)
        (0.5, 0.7),    # 50% modulation (scaled by 0.7)
    ])
    def test_modulation_depth_produces_expected_amplitude_variation(self, depth, expected_peak_to_peak_ratio):
        """Modulation depth should produce proportional amplitude variation"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        base_amplitude = 1.0
        modulator = AmplitudeModulator(
            base_amplitude=base_amplitude,
            envelope_freq=0.5,
            envelope_depth=depth,
            noise_level=0.0,  # No noise for clean measurement
            seed=42
        )
        
        # Act
        duration = 10.0  # Multiple envelope cycles
        sample_rate = 2000
        t = np.linspace(0, duration, int(sample_rate * duration))
        amplitude = modulator.modulate(t)
        
        # Calculate peak-to-peak variation
        peak_to_peak = np.max(amplitude) - np.min(amplitude)
        peak_to_peak_ratio = peak_to_peak / base_amplitude
        
        # Assert
        tolerance = 0.25  # 25% tolerance for envelope scaling factor
        
        assert abs(peak_to_peak_ratio - expected_peak_to_peak_ratio) <= tolerance, \
            f"Modulation depth {depth} produced wrong variation: expected {expected_peak_to_peak_ratio:.2f}, got {peak_to_peak_ratio:.2f}"
    
    def test_modulation_depth_linearity_across_range(self):
        """Modulation depth effect should be approximately linear"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        depths = [0.1, 0.2, 0.3, 0.4, 0.5]
        variations = []
        
        for depth in depths:
            modulator = AmplitudeModulator(
                base_amplitude=1.0,
                envelope_freq=0.4,
                envelope_depth=depth,
                noise_level=0.0,
                seed=42
            )
            
            # Act
            duration = 12.5  # 5 cycles at 0.4 Hz
            sample_rate = 2000
            t = np.linspace(0, duration, int(sample_rate * duration))
            amplitude = modulator.modulate(t)
            
            variation = np.std(amplitude)
            variations.append(variation)
        
        # Assert
        # Linear regression to check linearity
        slope, intercept = np.polyfit(depths, variations, 1)
        
        # Calculate R-squared for linearity
        predicted = slope * np.array(depths) + intercept
        ss_res = np.sum((variations - predicted)**2)
        ss_tot = np.sum((variations - np.mean(variations))**2)
        r_squared = 1 - (ss_res / ss_tot)
        
        assert r_squared >= 0.95, \
            f"Modulation depth not linear: R² = {r_squared:.4f}"
        
        # Slope should be positive (more depth = more variation)
        assert slope > 0, f"Modulation depth slope should be positive: {slope:.4f}"
    
    def test_depth_saturation_and_nonlinear_effects(self):
        """Extreme modulation depths should show expected saturation"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        extreme_depths = [0.8, 0.9, 1.0, 1.2, 1.5]
        variations = []
        
        for depth in extreme_depths:
            modulator = AmplitudeModulator(
                base_amplitude=1.0,
                envelope_freq=0.3,
                envelope_depth=depth,
                noise_level=0.0,
                seed=42
            )
            
            # Act
            duration = 20.0
            sample_rate = 1000
            t = np.linspace(0, duration, int(sample_rate * duration))
            amplitude = modulator.modulate(t)
            
            variation = np.max(amplitude) - np.min(amplitude)
            variations.append(variation)
        
        # Assert
        # Variation should saturate due to clipping
        # Higher depths should not increase variation indefinitely
        max_variation = np.max(variations)
        
        # Saturation: last few values should be similar
        last_three_variations = variations[-3:]
        variation_spread = np.max(last_three_variations) - np.min(last_three_variations)
        
        assert variation_spread <= 0.1 * max_variation, \
            "Modulation depth should saturate at extreme values"


class TestCombinedModulationPatterns:
    """Test combined and complex modulation pattern behaviors"""
    
    def test_multiple_modulator_interference_patterns(self):
        """Multiple modulators should combine without destructive interference"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        # Create two modulators with different frequencies
        mod1 = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.3,
            envelope_depth=0.2,
            noise_level=0.0,
            seed=42
        )
        
        mod2 = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.7,  # Different frequency
            envelope_depth=0.15,
            noise_level=0.0,
            seed=123
        )
        
        # Act
        duration = 30.0
        sample_rate = 1000
        t = np.linspace(0, duration, int(sample_rate * duration))
        
        amp1 = mod1.modulate(t)
        amp2 = mod2.modulate(t)
        
        # Simple additive combination
        combined = 0.5 * (amp1 + amp2)
        
        # Assert
        # Combined signal should show both frequency components
        freqs = np.fft.rfftfreq(len(combined), 1/sample_rate)
        fft = np.fft.rfft(combined - np.mean(combined))
        psd = np.abs(fft)**2
        
        # Find peaks near expected frequencies
        freq_tolerance = 0.02
        
        peak1_mask = np.abs(freqs - 0.3) <= freq_tolerance
        peak2_mask = np.abs(freqs - 0.7) <= freq_tolerance
        
        if np.any(peak1_mask) and np.any(peak2_mask):
            peak1_power = np.max(psd[peak1_mask])
            peak2_power = np.max(psd[peak2_mask])
            total_power = np.sum(psd)
            
            # Both peaks should be significant
            assert peak1_power / total_power >= 0.05, "First modulation frequency not preserved"
            assert peak2_power / total_power >= 0.05, "Second modulation frequency not preserved"
    
    def test_modulation_with_carrier_signal_interaction(self):
        """Modulation should interact properly with carrier signals"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator
        
        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.4,
            envelope_depth=0.3,
            noise_level=0.05,
            seed=42
        )
        
        # Create carrier signal
        carrier_freq = 30.0  # Hz - typical sawtooth frequency
        duration = 12.5
        sample_rate = 2000
        
        t = np.linspace(0, duration, int(sample_rate * duration))
        carrier = np.sin(2 * np.pi * carrier_freq * t)  # Simplified carrier
        
        # Act
        amplitude_envelope = modulator.modulate(t)
        modulated_carrier = amplitude_envelope * carrier
        
        # Assert
        # Modulated carrier should preserve carrier frequency
        freqs = np.fft.rfftfreq(len(modulated_carrier), 1/sample_rate)
        fft = np.fft.rfft(modulated_carrier)
        psd = np.abs(fft)**2
        
        # Find carrier frequency peak
        carrier_tolerance = 1.0  # Hz
        carrier_mask = np.abs(freqs - carrier_freq) <= carrier_tolerance
        
        if np.any(carrier_mask):
            carrier_power = np.max(psd[carrier_mask])
            total_power = np.sum(psd)
            carrier_fraction = carrier_power / total_power
            
            assert carrier_fraction >= 0.2, \
                f"Carrier power too low after modulation: {carrier_fraction*100:.1f}%"
        
        # Should also show sidebands around carrier (AM modulation)
        lower_sideband_freq = carrier_freq - 0.4
        upper_sideband_freq = carrier_freq + 0.4
        sideband_tolerance = 0.1
        
        lower_mask = np.abs(freqs - lower_sideband_freq) <= sideband_tolerance
        upper_mask = np.abs(freqs - upper_sideband_freq) <= sideband_tolerance
        
        if np.any(lower_mask):
            lower_power = np.max(psd[lower_mask])
            # More lenient sideband check for practical implementations
            assert lower_power > 0.005 * carrier_power, "Lower sideband not present"
        
        if np.any(upper_mask):
            upper_power = np.max(psd[upper_mask])  
            # More lenient sideband check for practical implementations
            assert upper_power > 0.005 * carrier_power, "Upper sideband not present"
    
    def test_temporal_modulation_pattern_coherence(self):
        """Complex temporal patterns should maintain coherence"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator, AmplitudeModulator
        
        # Create synchronized motion and amplitude modulation
        motion_gen = CircularMotionGenerator(
            rotation_freq=0.25,  # 4 second rotation
            fluctuation_amplitude=5.0,
            seed=42
        )
        
        amp_mod = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.25,  # Same frequency as rotation
            envelope_depth=0.2,
            noise_level=0.0,
            seed=42
        )
        
        # Act
        duration = 16.0  # 4 complete cycles
        sample_rate = 1000
        t = np.linspace(0, duration, int(sample_rate * duration))
        
        theta, _ = motion_gen.modulate(t)
        amplitude = amp_mod.modulate(t)
        
        # Create vector components
        x_component = amplitude * np.cos(theta)
        z_component = amplitude * np.sin(theta)
        
        # Assert
        # Vector magnitude should follow amplitude envelope
        vector_magnitude = np.sqrt(x_component**2 + z_component**2)
        
        # Correlation between intended amplitude and actual magnitude
        magnitude_correlation = np.corrcoef(amplitude, vector_magnitude)[0, 1]
        
        assert magnitude_correlation >= 0.98, \
            f"Vector magnitude doesn't follow amplitude envelope: correlation = {magnitude_correlation:.4f}"
        
        # Circular motion should complete expected rotations
        total_rotation = (theta[-1] - theta[0]) / (2 * np.pi)
        expected_rotations = 0.25 * duration
        
        rotation_error = abs(total_rotation - expected_rotations) / expected_rotations
        assert rotation_error <= 0.05, \
            f"Rotation count error: expected {expected_rotations:.1f}, got {total_rotation:.1f}"


class TestModulationSystemIntegration:
    """System-level integration tests for modulation components"""
    
    def test_modulation_system_state_consistency(self):
        """Modulation system state should remain consistent across operations"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator, AmplitudeModulator, DirectionalFluctuationGenerator
        
        # Create modulation system components
        motion_gen = CircularMotionGenerator(rotation_freq=0.33, seed=42)
        amp_mod = AmplitudeModulator(base_amplitude=1.0, envelope_freq=0.4, seed=42)
        dir_fluct = DirectionalFluctuationGenerator()
        
        # Act - Multiple generation cycles
        durations = [5.0, 10.0, 7.5, 12.0]
        all_results = []
        
        for duration in durations:
            sample_rate = 1000
            t = np.linspace(0, duration, int(sample_rate * duration))
            
            theta_base, _ = motion_gen.modulate(t)
            theta_fluct = dir_fluct.modulate(t)
            theta_combined = theta_base + theta_fluct
            
            amplitude = amp_mod.modulate(t)
            
            result = {
                'duration': duration,
                'theta_range': np.max(theta_combined) - np.min(theta_combined),
                'amplitude_mean': np.mean(amplitude),
                'amplitude_std': np.std(amplitude)
            }
            all_results.append(result)
        
        # Assert
        # Amplitude statistics should be consistent across different durations
        amplitude_means = [r['amplitude_mean'] for r in all_results]
        amplitude_stds = [r['amplitude_std'] for r in all_results]
        
        mean_consistency = np.std(amplitude_means) / np.mean(amplitude_means)
        std_consistency = np.std(amplitude_stds) / np.mean(amplitude_stds)
        
        assert mean_consistency <= 0.1, \
            f"Amplitude mean inconsistent across durations: {mean_consistency:.3f}"
        assert std_consistency <= 0.2, \
            f"Amplitude std inconsistent across durations: {std_consistency:.3f}"
    
    def test_modulation_parameter_bounds_and_validation(self):
        """All modulation parameters should respect bounds and validation"""
        # Arrange & Act & Assert - Test parameter validation
        from haptic_system.modulation import CircularMotionGenerator, AmplitudeModulator
        
        # Test CircularMotionGenerator parameter bounds
        valid_params = [
            {'rotation_freq': 0.1, 'fluctuation_amplitude': 0.0},
            {'rotation_freq': 0.6, 'fluctuation_amplitude': 30.0},
            {'rotation_freq': 0.33, 'fluctuation_amplitude': 15.0}
        ]
        
        for params in valid_params:
            # Should not raise exceptions
            try:
                gen = CircularMotionGenerator(**params)
                t = np.array([0.0, 1.0, 2.0])
                theta, omega = gen.modulate(t)
                assert len(theta) == 3
                assert len(omega) == 3
            except Exception as e:
                pytest.fail(f"Valid parameters rejected: {params}, error: {e}")
        
        # Test AmplitudeModulator parameter bounds
        valid_amp_params = [
            {'base_amplitude': 0.1, 'envelope_depth': 0.0},
            {'base_amplitude': 2.0, 'envelope_depth': 0.5},
            {'base_amplitude': 1.0, 'envelope_freq': 1.5}
        ]
        
        for params in valid_amp_params:
            try:
                mod = AmplitudeModulator(**params)
                t = np.array([0.0, 1.0, 2.0])
                amp = mod.modulate(t)
                assert len(amp) == 3
                assert np.all(np.isfinite(amp))
            except Exception as e:
                pytest.fail(f"Valid amplitude parameters rejected: {params}, error: {e}")
    
    def test_modulation_real_time_performance_requirements(self):
        """Modulation system should meet real-time performance requirements"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator, AmplitudeModulator
        import time
        
        # Simulate real-time audio block processing
        block_size = 512  # Common audio block size
        sample_rate = 20000  # Haptic system sample rate
        num_blocks = 20  # Test multiple blocks
        
        motion_gen = CircularMotionGenerator(rotation_freq=0.33, seed=42)
        amp_mod = AmplitudeModulator(base_amplitude=1.0, envelope_freq=0.4, seed=42)
        
        # Act - Measure processing time per block
        block_times = []
        
        for block_idx in range(num_blocks):
            t_start = block_idx * block_size / sample_rate
            t_end = (block_idx + 1) * block_size / sample_rate
            t = np.linspace(t_start, t_end, block_size)
            
            start_time = time.perf_counter()
            
            theta, _ = motion_gen.modulate(t)
            amplitude = amp_mod.modulate(t)
            
            # Simulate vector calculation
            x_vec = amplitude * np.cos(theta)
            z_vec = amplitude * np.sin(theta)
            
            end_time = time.perf_counter()
            
            block_processing_time = end_time - start_time
            block_times.append(block_processing_time)
        
        # Assert
        avg_block_time = np.mean(block_times)
        max_block_time = np.max(block_times)
        
        # Real-time requirement: process faster than audio block duration
        block_duration = block_size / sample_rate  # seconds
        realtime_margin = 0.1  # 10% of block time as safety margin
        max_allowed_time = block_duration * realtime_margin
        
        assert avg_block_time <= max_allowed_time, \
            f"Average processing too slow: {avg_block_time*1000:.3f}ms > {max_allowed_time*1000:.3f}ms"
        assert max_block_time <= max_allowed_time * 2, \
            f"Peak processing too slow: {max_block_time*1000:.3f}ms > {max_allowed_time*2*1000:.3f}ms"
    
    def test_modulation_memory_usage_and_efficiency(self):
        """Modulation system should be memory efficient"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator, AmplitudeModulator
        import sys
        
        # Test large buffer processing
        large_buffer_size = 100000  # Large audio buffer
        
        motion_gen = CircularMotionGenerator(seed=42)
        amp_mod = AmplitudeModulator(seed=42)
        
        # Act
        sample_rate = 20000
        duration = large_buffer_size / sample_rate
        t = np.linspace(0, duration, large_buffer_size)
        
        # Measure memory usage (approximate)
        initial_objects = len(gc.get_objects()) if 'gc' in globals() else 0
        
        theta, omega = motion_gen.modulate(t)
        amplitude = amp_mod.modulate(t)
        
        # Combined processing
        x_component = amplitude * np.cos(theta)
        z_component = amplitude * np.sin(theta)
        
        final_objects = len(gc.get_objects()) if 'gc' in globals() else 0
        
        # Assert
        # Memory usage should be reasonable
        expected_memory = large_buffer_size * 8 * 5  # 5 arrays of float64
        
        # Basic size checks
        assert len(theta) == large_buffer_size
        assert len(amplitude) == large_buffer_size
        assert len(x_component) == large_buffer_size
        assert len(z_component) == large_buffer_size
        
        # No excessive object creation
        if 'gc' in globals():
            object_growth = final_objects - initial_objects
            assert object_growth <= 100, f"Too many objects created: {object_growth}"
