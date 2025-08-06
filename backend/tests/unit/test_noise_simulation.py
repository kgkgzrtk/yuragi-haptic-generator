"""
Test module for noise simulation functionality.
Tests the 3% Gaussian noise addition as in reference implementation.
"""

import pytest
import numpy as np
from haptic_system.channel import HapticChannel


class TestNoiseSimulation:
    """Test cases for noise simulation feature."""
    
    def test_channel_has_noise_control(self):
        """Test that HapticChannel has noise control methods."""
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        assert hasattr(channel, 'enable_noise'), "Channel should have noise control"
        assert hasattr(channel, 'disable_noise'), "Channel should have noise disable"
    
    def test_noise_disabled_by_default(self):
        """Test that noise is disabled by default."""
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        assert hasattr(channel, 'noise_enabled'), "Channel should have noise_enabled property"
        assert channel.noise_enabled == False, "Noise should be disabled by default"
    
    def test_enable_noise_with_level(self):
        """Test enabling noise with specific level."""
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.enable_noise(level=0.03)  # 3% as in reference
        
        assert channel.noise_enabled == True
        assert channel.noise_level == 0.03
    
    def test_noise_affects_output(self):
        """Test that noise actually affects the output signal."""
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.set_parameters(frequency=100, amplitude=1.0)
        channel.activate()
        
        # Generate output without noise
        np.random.seed(42)  # For reproducibility
        output_no_noise = channel.get_next_chunk(1000)
        
        # Enable noise and generate again
        channel.enable_noise(level=0.03)
        np.random.seed(42)  # Reset seed
        channel.cumulative_time = 0  # Reset time for same phase
        output_with_noise = channel.get_next_chunk(1000)
        
        # Outputs should be different
        assert not np.allclose(output_no_noise, output_with_noise), \
            "Output with noise should differ from output without noise"
    
    def test_noise_level_statistics(self):
        """Test that noise level matches expected statistics."""
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.set_parameters(frequency=100, amplitude=1.0)
        channel.activate()
        channel.enable_noise(level=0.03)
        
        # Generate long signal for statistics
        num_samples = 100000
        output = channel.get_next_chunk(num_samples)
        
        # Generate clean signal for comparison
        channel.disable_noise()
        channel.cumulative_time = 0
        clean_output = channel.get_next_chunk(num_samples)
        
        # Calculate actual noise
        noise = output - clean_output
        
        # Check noise statistics
        noise_rms = np.sqrt(np.mean(noise**2))
        signal_rms = np.sqrt(np.mean(clean_output**2))
        
        # Noise should be approximately 3% of signal RMS
        expected_noise_rms = 0.03 * signal_rms
        assert noise_rms == pytest.approx(expected_noise_rms, rel=0.1), \
            f"Noise RMS {noise_rms:.4f} should be approximately {expected_noise_rms:.4f}"
        
        # Noise should be zero-mean Gaussian
        assert np.mean(noise) == pytest.approx(0, abs=0.001), \
            "Noise should have zero mean"
    
    def test_noise_with_resonator(self):
        """Test noise works correctly with resonator enabled."""
        channel = HapticChannel(channel_id=0, sample_rate=20000)
        channel.set_parameters(frequency=30, amplitude=1.0)
        channel.activate()
        channel.enable_resonator(f_n=180, zeta=0.08)
        channel.enable_noise(level=0.03)
        
        # Generate output
        output = channel.get_next_chunk(2000)
        
        # Should produce non-zero output with both resonator and noise
        assert not np.allclose(output, 0), "Output should not be zero"
        assert len(output) == 2000
    
    def test_noise_parameter_validation(self):
        """Test noise parameter validation."""
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        
        # Valid noise levels
        channel.enable_noise(level=0.01)  # 1%
        assert channel.noise_level == 0.01
        
        channel.enable_noise(level=0.1)   # 10%
        assert channel.noise_level == 0.1
        
        # Invalid noise levels should raise ValueError
        with pytest.raises(ValueError):
            channel.enable_noise(level=-0.01)  # Negative
        
        with pytest.raises(ValueError):
            channel.enable_noise(level=1.5)    # Too high
    
    def test_reproducible_noise_with_seed(self):
        """Test that noise can be made reproducible with seed."""
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.set_parameters(frequency=100, amplitude=1.0)
        channel.activate()
        channel.enable_noise(level=0.03, seed=12345)
        
        # Generate two outputs with same seed
        output1 = channel.get_next_chunk(1000)
        
        # Reset and generate again
        channel.cumulative_time = 0
        channel.enable_noise(level=0.03, seed=12345)
        output2 = channel.get_next_chunk(1000)
        
        # Should be identical with same seed
        assert np.allclose(output1, output2), \
            "Output should be identical with same seed"