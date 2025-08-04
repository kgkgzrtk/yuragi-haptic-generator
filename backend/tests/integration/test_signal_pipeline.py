"""
Integration tests for complete signal processing pipeline.
Tests the flow: sawtooth -> X/Y distribution -> resonator -> output
"""

import pytest
import numpy as np
from src.haptic_system.waveform import SawtoothWaveform, resonator
from src.haptic_system.channel import HapticChannel


class TestSignalPipeline:
    """Test cases for the complete signal processing pipeline."""
    
    def test_channel_with_resonator_exists(self):
        """Test that HapticChannel can process with resonator."""
        # This test will fail initially if resonator is not integrated
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        assert hasattr(channel, 'enable_resonator'), "Channel should have resonator control"
    
    def test_basic_pipeline_flow(self):
        """Test basic signal flow through the pipeline."""
        # Parameters from reference implementation
        fs = 20000  # Sampling frequency
        f_saw = 30  # Sawtooth frequency
        f_res = 180  # Resonance frequency 
        zeta = 0.08  # Damping ratio
        duration = 0.1  # 100ms
        
        # 1. Generate sawtooth wave
        waveform = SawtoothWaveform(sample_rate=fs)
        t = np.arange(0, duration, 1/fs)
        saw = waveform.generate(f_saw, duration)
        
        # 2. Apply angle-based X/Y distribution (45 degrees example)
        angle_rad = np.deg2rad(45)
        V0 = 1.0
        Vx = V0 * np.cos(angle_rad) * saw
        Vy = -V0 * np.sin(angle_rad) * saw  # Y is inverted
        
        # 3. Apply resonator filter
        Ax = resonator(Vx, fs, f_res, zeta)
        Ay = resonator(Vy, fs, f_res, zeta)
        
        # Verify output characteristics
        assert len(Ax) == len(saw), "X output length should match input"
        assert len(Ay) == len(saw), "Y output length should match input"
        
        # Check that resonator amplifies at resonance frequency
        # Skip transient
        skip = int(0.1 * len(Ax))
        input_power = np.mean(Vx[skip:]**2)
        output_power = np.mean(Ax[skip:]**2)
        assert output_power > input_power, "Resonator should amplify signal"
    
    def test_channel_integrated_processing(self):
        """Test signal processing integrated into HapticChannel."""
        # Create channel with resonator enabled
        channel = HapticChannel(channel_id=0, sample_rate=20000)
        channel.enable_resonator(f_n=180, zeta=0.08)
        
        # Set channel parameters
        channel.set_parameters(
            frequency=30,
            amplitude=1.0,
            phase=0,
            polarity=True
        )
        channel.activate()  # Activate the channel
        
        # Generate output
        num_samples = 2000
        output = channel.get_next_chunk(num_samples)
        
        # Verify resonator is applied
        assert len(output) == num_samples
        assert not np.allclose(output, 0), "Output should not be zero"
        
        # Check for resonance characteristics
        # The output should show oscillation at resonance frequency
        fft = np.fft.rfft(output)
        freqs = np.fft.rfftfreq(len(output), 1/20000)
        
        # Find peaks in spectrum
        fft_abs = np.abs(fft)
        # Find indices where we have significant content (above 10% of max)
        significant_indices = np.where(fft_abs > 0.1 * np.max(fft_abs))[0]
        significant_freqs = freqs[significant_indices]
        
        # Should have significant content near 180Hz (resonance) 
        # Note: 30Hz fundamental will also be present
        resonance_found = any(150 < f < 210 for f in significant_freqs)
        assert resonance_found, f"No significant content near 180Hz resonance. Found peaks at: {significant_freqs[significant_freqs > 20]}"
    
    def test_multi_channel_vector_control(self):
        """Test vector control with multiple channels."""
        # Device configuration (2 channels per device)
        sample_rate = 20000
        channels = []
        
        # Create X and Y channels
        for ch_id in range(2):
            channel = HapticChannel(ch_id, sample_rate)
            channel.enable_resonator(f_n=180, zeta=0.08)
            channels.append(channel)
        
        # Apply vector force at 45 degrees
        angle = 45
        magnitude = 1.0
        frequency = 30
        
        angle_rad = np.deg2rad(angle)
        x_amplitude = magnitude * np.cos(angle_rad)
        y_amplitude = -magnitude * np.sin(angle_rad)
        
        # Set channel parameters
        channels[0].set_parameters(frequency, x_amplitude, 0, True)  # X
        channels[1].set_parameters(frequency, y_amplitude, 0, True)  # Y
        
        # Activate channels
        channels[0].activate()
        channels[1].activate()
        
        # Generate outputs
        num_samples = 2000
        x_output = channels[0].get_next_chunk(num_samples)
        y_output = channels[1].get_next_chunk(num_samples)
        
        # Verify vector relationship
        assert len(x_output) == len(y_output)
        
        # Check amplitude ratio matches angle
        x_rms = np.sqrt(np.mean(x_output**2))
        y_rms = np.sqrt(np.mean(y_output**2))
        
        expected_ratio = np.abs(np.tan(angle_rad))
        actual_ratio = y_rms / x_rms if x_rms > 0 else 0
        
        assert actual_ratio == pytest.approx(expected_ratio, rel=0.1), \
            f"Y/X ratio {actual_ratio:.2f} should match tan(45°) = {expected_ratio:.2f}"
    
    def test_pipeline_with_noise(self):
        """Test pipeline with noise addition."""
        fs = 20000
        duration = 0.1
        noise_level = 0.03  # 3% as in reference
        
        # Generate base signal
        waveform = SawtoothWaveform(sample_rate=fs)
        saw = waveform.generate(30, duration)
        
        # Apply resonator
        filtered = resonator(saw, fs, 180, 0.08)
        
        # Add noise
        noise = noise_level * np.random.randn(len(filtered))
        output_with_noise = filtered + noise
        
        # Verify noise characteristics
        noise_actual = output_with_noise - filtered
        noise_rms = np.sqrt(np.mean(noise_actual**2))
        signal_rms = np.sqrt(np.mean(filtered**2))
        
        snr = 20 * np.log10(signal_rms / noise_rms)
        expected_snr = 20 * np.log10(1 / noise_level)  # Approximately
        
        assert snr == pytest.approx(expected_snr, abs=3), \
            f"SNR {snr:.1f}dB should be approximately {expected_snr:.1f}dB"