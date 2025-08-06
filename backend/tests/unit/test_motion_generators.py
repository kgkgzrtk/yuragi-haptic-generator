"""
Motion Generators Unit Tests - TDD Implementation
Comprehensive testing for massage feature motion generation components.

Tests for:
- CircularMotionGenerator: circular motion with fluctuations
- AmplitudeModulator: massage-like amplitude variations
- DirectionalFluctuationGenerator: multi-component directional modulation
"""

import numpy as np
import pytest


class TestCircularMotionGenerator:
    """Test circular motion generator for massage patterns"""

    def test_generates_correct_rotation_frequency_within_tolerance(self):
        """Rotation frequency should be accurate to ±0.1%"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator

        rotation_freq = 0.33  # Hz (3 seconds per rotation)
        duration = 10.0  # seconds
        sample_rate = 20000
        tolerance = 0.001  # ±0.1%

        generator = CircularMotionGenerator(
            rotation_freq=rotation_freq,
            fluctuation_amplitude=0.0,  # No fluctuations for precise measurement
            seed=42,
        )

        # Act
        t = np.linspace(0, duration, int(sample_rate * duration))
        theta, omega_inst = generator.modulate(t)

        # Assert
        # Calculate actual rotation frequency from phase change
        total_rotations = (theta[-1] - theta[0]) / (2 * np.pi)
        actual_freq = total_rotations / duration

        expected_freq = rotation_freq
        assert (
            abs(actual_freq - expected_freq) <= tolerance * expected_freq
        ), f"Frequency accuracy failed: expected {expected_freq:.6f} ±{tolerance*100:.1f}%, got {actual_freq:.6f}"

    @pytest.mark.parametrize(
        "rotation_freq,expected_period",
        [
            (0.2, 5.0),  # 5 seconds per rotation
            (0.33, 3.03),  # ~3 seconds per rotation
            (0.5, 2.0),  # 2 seconds per rotation
            (0.6, 1.67),  # ~1.67 seconds per rotation
        ],
    )
    def test_rotation_frequency_precision_multiple_values(
        self, rotation_freq, expected_period
    ):
        """Test rotation frequency precision across valid range"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator

        generator = CircularMotionGenerator(
            rotation_freq=rotation_freq, fluctuation_amplitude=0.0, seed=42
        )

        # Act - Generate enough data to measure accurately
        duration = max(expected_period * 3, 6.0)  # At least 3 periods or 6 seconds
        t = np.linspace(0, duration, int(20000 * duration))
        theta, _ = generator.modulate(t)

        # Assert
        total_rotations = (theta[-1] - theta[0]) / (2 * np.pi)
        actual_period = duration / total_rotations

        tolerance = 0.01  # 1% tolerance
        assert abs(actual_period - expected_period) <= tolerance * expected_period

    def test_fluctuation_amplitude_stays_within_specified_range(self):
        """Fluctuation amplitude should not exceed specified bounds"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator

        fluctuation_deg = 15.0  # degrees
        fluctuation_rad = np.deg2rad(fluctuation_deg)

        generator = CircularMotionGenerator(
            rotation_freq=0.33, fluctuation_amplitude=fluctuation_deg, seed=42
        )

        # Act
        duration = 30.0  # Long duration to capture fluctuation range
        t = np.linspace(0, duration, int(20000 * duration))
        theta, _ = generator.modulate(t)

        # Calculate fluctuations by removing linear trend
        base_theta = 2 * np.pi * 0.33 * t  # Base rotation without fluctuations
        fluctuations = theta - base_theta

        # Assert
        max_fluctuation = np.max(np.abs(fluctuations))
        safety_margin = 1.5  # Allow some margin for 1/f noise characteristics

        assert (
            max_fluctuation <= safety_margin * fluctuation_rad
        ), f"Fluctuation exceeded bounds: max={np.rad2deg(max_fluctuation):.1f}°, limit={fluctuation_deg*safety_margin:.1f}°"

    def test_1f_noise_characteristics_in_fluctuations(self):
        """Generated noise should exhibit 1/f characteristics"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator

        generator = CircularMotionGenerator(
            rotation_freq=0.0,  # No base rotation to isolate noise
            fluctuation_amplitude=10.0,
            fluctuation_bandwidth=0.5,
            seed=42,
        )

        # Act
        duration = 100.0  # Long duration for good spectral analysis
        sample_rate = 1000  # Lower sample rate for computational efficiency
        t = np.linspace(0, duration, int(sample_rate * duration))
        theta, _ = generator.modulate(t)

        # Remove any linear trend
        theta_detrended = theta - np.linspace(theta[0], theta[-1], len(theta))

        # Calculate power spectral density
        freqs = np.fft.rfftfreq(len(theta_detrended), 1 / sample_rate)
        fft = np.fft.rfft(theta_detrended)
        psd = np.abs(fft) ** 2

        # Assert
        # For 1/f noise, log(PSD) vs log(freq) should have negative slope
        # Focus on frequencies above DC and below Nyquist/4
        valid_freqs = (freqs > 0.01) & (freqs < sample_rate / 8)

        if np.sum(valid_freqs) > 10:  # Enough points for analysis
            log_freqs = np.log10(freqs[valid_freqs])
            log_psd = np.log10(psd[valid_freqs])

            # Linear regression to find slope
            slope = np.polyfit(log_freqs, log_psd, 1)[0]

            # 1/f noise should have slope approximately -1, allow range [-2, 0]
            assert -2.0 <= slope <= 0.0, f"1/f noise slope out of range: {slope:.2f}"

    def test_instantaneous_angular_velocity_accuracy(self):
        """Instantaneous angular velocity should match expected values"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator

        rotation_freq = 0.4  # Hz
        expected_omega = 2 * np.pi * rotation_freq  # rad/s

        generator = CircularMotionGenerator(
            rotation_freq=rotation_freq,
            fluctuation_amplitude=0.0,  # No fluctuations for clean measurement
            fm_depth=0.0,  # No FM modulation
            seed=42,
        )

        # Act
        t = np.linspace(0, 5.0, 10000)
        theta, omega_inst = generator.modulate(t)

        # Assert
        mean_omega = np.mean(omega_inst)
        omega_std = np.std(omega_inst)

        # Mean should match expected value within 1%
        assert abs(mean_omega - expected_omega) <= 0.01 * expected_omega

        # Standard deviation should be very small without fluctuations
        assert omega_std <= 0.05 * expected_omega

    def test_fm_modulation_depth_effect(self):
        """FM modulation depth should affect angular velocity variation"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator

        # Create two generators: one without FM, one with FM
        gen_no_fm = CircularMotionGenerator(
            rotation_freq=0.33, fluctuation_amplitude=0.0, fm_depth=0.0, seed=42
        )

        gen_with_fm = CircularMotionGenerator(
            rotation_freq=0.33,
            fluctuation_amplitude=0.0,
            fm_depth=0.1,  # 10% FM modulation
            seed=42,
        )

        # Act
        t = np.linspace(0, 20.0, 20000)
        _, omega_no_fm = gen_no_fm.modulate(t)
        _, omega_with_fm = gen_with_fm.modulate(t)

        # Assert
        std_no_fm = np.std(omega_no_fm)
        std_with_fm = np.std(omega_with_fm)

        # FM should increase angular velocity variation
        assert (
            std_with_fm > 2 * std_no_fm
        ), f"FM modulation effect insufficient: std_no_fm={std_no_fm:.4f}, std_with_fm={std_with_fm:.4f}"


class TestAmplitudeModulator:
    """Test amplitude modulator for massage-like intensity variations"""

    def test_envelope_frequency_accuracy_within_tolerance(self):
        """Envelope frequency should be accurate to ±0.1%"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator

        envelope_freq = 0.4  # Hz
        duration = 25.0  # seconds (multiple periods)
        sample_rate = 10000
        tolerance = 0.001  # ±0.1%

        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=envelope_freq,
            envelope_depth=0.3,
            noise_level=0.0,  # No noise for clean measurement
            seed=42,
        )

        # Act
        t = np.linspace(0, duration, int(sample_rate * duration))
        amplitude = modulator.modulate(t)

        # Remove DC component and noise to isolate envelope
        amplitude_ac = amplitude - np.mean(amplitude)

        # Find dominant frequency using FFT
        freqs = np.fft.rfftfreq(len(amplitude_ac), 1 / sample_rate)
        fft = np.fft.rfft(amplitude_ac)
        dominant_freq_idx = np.argmax(np.abs(fft[1:]))  # Skip DC
        actual_freq = freqs[dominant_freq_idx + 1]

        # Assert
        assert (
            abs(actual_freq - envelope_freq) <= tolerance * envelope_freq
        ), f"Envelope frequency accuracy failed: expected {envelope_freq:.6f} ±{tolerance*100:.1f}%, got {actual_freq:.6f}"

    def test_amplitude_clipping_boundaries_enforced(self):
        """Amplitude should be clipped to prevent over-modulation"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator

        base_amplitude = 1.0
        expected_min = 0.2 * base_amplitude
        expected_max = 1.5 * base_amplitude

        # Create extreme modulation to test clipping
        modulator = AmplitudeModulator(
            base_amplitude=base_amplitude,
            envelope_freq=0.1,
            envelope_depth=1.0,  # 100% modulation (extreme)
            noise_level=0.5,  # High noise level
            seed=42,
        )

        # Act
        t = np.linspace(0, 50.0, 50000)  # Long duration to capture extremes
        amplitude = modulator.modulate(t)

        # Assert
        min_amplitude = np.min(amplitude)
        max_amplitude = np.max(amplitude)

        assert (
            min_amplitude >= expected_min - 1e-6
        ), f"Amplitude below minimum: {min_amplitude:.4f} < {expected_min:.4f}"
        assert (
            max_amplitude <= expected_max + 1e-6
        ), f"Amplitude above maximum: {max_amplitude:.4f} > {expected_max:.4f}"

    @pytest.mark.parametrize(
        "envelope_depth,expected_variation_ratio",
        [
            (0.0, 0.05),  # No envelope - minimal variation
            (0.1, 0.15),  # Small envelope
            (0.25, 0.35),  # Medium envelope
            (0.3, 0.4),  # Large envelope
        ],
    )
    def test_modulation_depth_effects_amplitude_variation(
        self, envelope_depth, expected_variation_ratio
    ):
        """Different modulation depths should produce proportional amplitude variations"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator

        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.5,
            envelope_depth=envelope_depth,
            noise_level=0.0,  # No noise for clean measurement
            seed=42,
        )

        # Act
        t = np.linspace(0, 10.0, 10000)
        amplitude = modulator.modulate(t)

        # Calculate variation ratio
        amplitude_range = np.max(amplitude) - np.min(amplitude)
        base_amplitude = 1.0
        variation_ratio = amplitude_range / base_amplitude

        # Assert
        tolerance = 0.1  # 10% tolerance
        assert (
            abs(variation_ratio - expected_variation_ratio) <= tolerance
        ), f"Variation ratio mismatch: expected {expected_variation_ratio:.2f} ±{tolerance:.1f}, got {variation_ratio:.2f}"

    def test_combined_envelope_and_noise_modulation(self):
        """Envelope and noise should combine correctly without interference"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator

        # Create modulator with both envelope and noise
        modulator_both = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.3,
            envelope_depth=0.2,
            noise_level=0.1,
            seed=42,
        )

        # Create envelope-only modulator for comparison
        modulator_envelope_only = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.3,
            envelope_depth=0.2,
            noise_level=0.0,
            seed=42,
        )

        # Act
        t = np.linspace(0, 20.0, 20000)
        amplitude_both = modulator_both.modulate(t)
        amplitude_envelope = modulator_envelope_only.modulate(t)

        # Assert
        # Combined signal should have higher variance than envelope-only
        std_both = np.std(amplitude_both)
        std_envelope = np.std(amplitude_envelope)

        assert (
            std_both > std_envelope
        ), f"Combined modulation should increase variance: both={std_both:.4f}, envelope_only={std_envelope:.4f}"

        # But the mean should be similar
        mean_both = np.mean(amplitude_both)
        mean_envelope = np.mean(amplitude_envelope)

        assert (
            abs(mean_both - mean_envelope) <= 0.05
        ), f"Mean should be preserved: both={mean_both:.3f}, envelope_only={mean_envelope:.3f}"


class TestDirectionalFluctuationGenerator:
    """Test directional fluctuation generator for complex modulation patterns"""

    def test_multiple_frequency_components_present(self):
        """All specified frequency components should be present in output"""
        # Arrange
        from haptic_system.modulation import DirectionalFluctuationGenerator

        components = [
            {"freq": 0.3, "amp": 5.0, "phase": 0.0},
            {"freq": 0.5, "amp": 3.0, "phase": np.pi / 3},
            {"freq": 0.8, "amp": 2.0, "phase": 2 * np.pi / 3},
        ]

        generator = DirectionalFluctuationGenerator(fluctuation_components=components)

        # Act
        duration = 50.0  # Long enough for good frequency resolution
        sample_rate = 2000
        t = np.linspace(0, duration, int(sample_rate * duration))
        fluctuation = generator.modulate(t)

        # Calculate power spectral density
        freqs = np.fft.rfftfreq(len(fluctuation), 1 / sample_rate)
        fft = np.fft.rfft(fluctuation)
        psd = np.abs(fft) ** 2

        # Assert
        for comp in components:
            target_freq = comp["freq"]
            freq_tolerance = 0.02  # ±0.02 Hz

            # Find frequency bin closest to target
            freq_mask = np.abs(freqs - target_freq) <= freq_tolerance

            if np.any(freq_mask):
                peak_power = np.max(psd[freq_mask])

                # Power should be proportional to amplitude squared
                expected_relative_power = (comp["amp"]) ** 2

                # Normalize by checking relative powers
                if target_freq == 0.3:  # Use first component as reference
                    reference_power = peak_power
                else:
                    reference_comp = components[0]
                    expected_ratio = expected_relative_power / (
                        reference_comp["amp"] ** 2
                    )
                    actual_ratio = peak_power / reference_power

                    tolerance = 0.3  # 30% tolerance for spectral analysis
                    assert (
                        abs(actual_ratio - expected_ratio) <= tolerance
                    ), f"Component {target_freq}Hz power ratio incorrect: expected {expected_ratio:.2f}, got {actual_ratio:.2f}"

    def test_phase_relationships_between_components(self):
        """Phase relationships between components should be preserved"""
        # Arrange
        from haptic_system.modulation import DirectionalFluctuationGenerator

        # Two components with known phase relationship
        components = [
            {"freq": 0.2, "amp": 1.0, "phase": 0.0},
            {"freq": 0.2, "amp": 1.0, "phase": np.pi / 2},  # 90° phase shift
        ]

        gen1 = DirectionalFluctuationGenerator(fluctuation_components=[components[0]])
        gen2 = DirectionalFluctuationGenerator(fluctuation_components=[components[1]])

        # Act
        duration = 25.0  # Multiple periods
        sample_rate = 1000
        t = np.linspace(0, duration, int(sample_rate * duration))

        fluctuation1 = gen1.modulate(t)
        fluctuation2 = gen2.modulate(t)

        # Assert
        # Cross-correlation should show 90° phase shift
        correlation = np.correlate(fluctuation1, fluctuation2, mode="full")
        max_corr_idx = np.argmax(correlation)

        # Calculate phase shift from correlation peak position
        center_idx = len(correlation) // 2
        shift_samples = max_corr_idx - center_idx

        # For 0.2 Hz with 1000 Hz sampling: period = 5000 samples
        # 90° phase shift = 1250 samples
        period_samples = int(sample_rate / 0.2)
        expected_shift = period_samples // 4  # 90°

        shift_tolerance = period_samples // 20  # ±5% tolerance

        assert (
            abs(abs(shift_samples) - expected_shift) <= shift_tolerance
        ), f"Phase shift incorrect: expected ±{expected_shift} samples, got {shift_samples} samples"

    def test_amplitude_control_per_component(self):
        """Each component amplitude should be independently controllable"""
        # Arrange
        from haptic_system.modulation import DirectionalFluctuationGenerator

        # Create two generators with different amplitudes for same frequency
        small_amp = DirectionalFluctuationGenerator(
            [{"freq": 0.4, "amp": 2.0, "phase": 0.0}]
        )

        large_amp = DirectionalFluctuationGenerator(
            [{"freq": 0.4, "amp": 8.0, "phase": 0.0}]
        )

        # Act
        duration = 12.5  # Multiple periods
        sample_rate = 2000
        t = np.linspace(0, duration, int(sample_rate * duration))

        fluct_small = small_amp.modulate(t)
        fluct_large = large_amp.modulate(t)

        # Assert
        # RMS should be proportional to amplitude
        rms_small = np.sqrt(np.mean(fluct_small**2))
        rms_large = np.sqrt(np.mean(fluct_large**2))

        amplitude_ratio = 8.0 / 2.0  # 4:1 ratio
        rms_ratio = rms_large / rms_small

        tolerance = 0.1  # 10% tolerance
        assert (
            abs(rms_ratio - amplitude_ratio) <= tolerance * amplitude_ratio
        ), f"Amplitude control failed: expected ratio {amplitude_ratio:.1f}, got {rms_ratio:.2f}"

    def test_default_components_configuration(self):
        """Default configuration should use reasonable parameters"""
        # Arrange & Act
        from haptic_system.modulation import DirectionalFluctuationGenerator

        generator = DirectionalFluctuationGenerator()  # Use defaults

        # Act
        duration = 10.0
        sample_rate = 1000
        t = np.linspace(0, duration, int(sample_rate * duration))
        fluctuation = generator.modulate(t)

        # Assert
        # Output should be reasonable
        max_fluctuation = np.max(np.abs(fluctuation))

        # Should have some variation but not excessive
        assert (
            0.05 <= max_fluctuation <= 0.3
        ), f"Default fluctuation amplitude unreasonable: {np.rad2deg(max_fluctuation):.1f}°"

        # Should not be constant
        std_fluctuation = np.std(fluctuation)
        assert (
            std_fluctuation > 0.01
        ), "Default configuration produces too little variation"


class TestMotionGeneratorIntegration:
    """Integration tests for motion generator components"""

    def test_circular_motion_with_directional_fluctuations_combined(self):
        """Circular motion and directional fluctuations should combine correctly"""
        # Arrange
        from haptic_system.modulation import (
            CircularMotionGenerator,
            DirectionalFluctuationGenerator,
        )

        circular_gen = CircularMotionGenerator(
            rotation_freq=0.25,
            fluctuation_amplitude=0.0,  # No built-in fluctuations
            seed=42,
        )

        direction_gen = DirectionalFluctuationGenerator(
            [{"freq": 0.1, "amp": 5.0, "phase": 0.0}]
        )

        # Act
        duration = 20.0
        sample_rate = 5000
        t = np.linspace(0, duration, int(sample_rate * duration))

        base_theta, _ = circular_gen.modulate(t)
        fluctuations = direction_gen.modulate(t)
        combined_theta = base_theta + fluctuations

        # Assert
        # Combined signal should have both base rotation and fluctuations
        # Base rotation: 0.25 Hz = 5 rotations in 20 seconds
        expected_rotations = 0.25 * duration
        actual_rotations = (combined_theta[-1] - combined_theta[0]) / (2 * np.pi)

        rotation_tolerance = 0.5  # Allow for fluctuation effects
        assert (
            abs(actual_rotations - expected_rotations) <= rotation_tolerance
        ), f"Combined rotation count incorrect: expected {expected_rotations:.1f}, got {actual_rotations:.1f}"

        # Should have more variation than base rotation alone
        base_variation = np.std(np.diff(base_theta))
        combined_variation = np.std(np.diff(combined_theta))

        assert (
            combined_variation > base_variation
        ), "Combined signal should show more variation than base rotation alone"

    def test_amplitude_modulation_preserves_vector_magnitude_properties(self):
        """Amplitude modulation should not introduce DC bias or excessive clipping"""
        # Arrange
        from haptic_system.modulation import AmplitudeModulator

        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.3,
            envelope_depth=0.2,
            noise_level=0.05,
            seed=42,
        )

        # Act
        duration = 33.33  # Multiple envelope periods
        sample_rate = 1000
        t = np.linspace(0, duration, int(sample_rate * duration))
        amplitude = modulator.modulate(t)

        # Assert
        # Mean should be close to base amplitude
        mean_amplitude = np.mean(amplitude)
        assert (
            abs(mean_amplitude - 1.0) <= 0.1
        ), f"Mean amplitude drift: expected 1.0, got {mean_amplitude:.3f}"

        # Should not spend excessive time at clipping boundaries
        at_min_clip = np.sum(amplitude <= 0.21)  # Near minimum clip
        at_max_clip = np.sum(amplitude >= 1.49)  # Near maximum clip
        total_samples = len(amplitude)

        clip_fraction = (at_min_clip + at_max_clip) / total_samples

        assert (
            clip_fraction <= 0.05
        ), f"Excessive clipping: {clip_fraction*100:.1f}% of samples near boundaries"


# Performance and edge case tests
class TestMotionGeneratorPerformance:
    """Performance and edge case testing"""

    @pytest.mark.parametrize("sample_count", [1000, 10000, 100000])
    def test_generation_performance_scales_linearly(self, sample_count):
        """Generation time should scale approximately linearly with sample count"""
        # Arrange
        import time

        from haptic_system.modulation import CircularMotionGenerator

        generator = CircularMotionGenerator(seed=42)

        # Act
        sample_rate = 20000
        duration = sample_count / sample_rate
        t = np.linspace(0, duration, sample_count)

        start_time = time.time()
        theta, omega = generator.modulate(t)
        end_time = time.time()

        generation_time = end_time - start_time

        # Assert
        # Should complete within reasonable time (rough benchmark)
        max_time_per_1k_samples = 0.01  # 10ms per 1000 samples
        expected_max_time = (sample_count / 1000) * max_time_per_1k_samples

        assert (
            generation_time <= expected_max_time
        ), f"Generation too slow: {generation_time:.3f}s for {sample_count} samples (max: {expected_max_time:.3f}s)"

    def test_zero_duration_handling(self):
        """Should handle zero duration gracefully"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator

        generator = CircularMotionGenerator()

        # Act & Assert
        t = np.array([])  # Empty time array
        theta, omega = generator.modulate(t)

        assert len(theta) == 0
        assert len(omega) == 0

    def test_single_sample_generation(self):
        """Should handle single sample generation"""
        # Arrange
        from haptic_system.modulation import CircularMotionGenerator

        generator = CircularMotionGenerator(rotation_freq=1.0, seed=42)

        # Act
        t = np.array([0.5])  # Single time point
        theta, omega = generator.modulate(t)

        # Assert
        assert len(theta) == 1
        assert len(omega) == 1
        assert np.isfinite(theta[0])
        assert np.isfinite(omega[0])
