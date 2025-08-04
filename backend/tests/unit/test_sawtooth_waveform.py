"""
SawtoothWaveformクラスのユニットテスト
TDDサイクル1: 基本的な波形生成
"""
import pytest
import numpy as np
from haptic_system.waveform import SawtoothWaveform


class TestSawtoothWaveformGeneration:
    """サwtooth波生成の基本機能テスト"""
    
    def test_creates_ascending_sawtooth_at_100hz(self):
        """100Hzの上昇サwtooth波を生成できる"""
        # Arrange
        frequency = 100.0
        sample_rate = 44100
        duration = 0.01  # 10ms = 1周期
        
        # Act
        waveform = SawtoothWaveform(sample_rate)
        samples = waveform.generate(frequency, duration)
        
        # Assert
        assert len(samples) == 441  # 44100 * 0.01
        assert samples[0] == pytest.approx(-1.0, abs=0.01)
        assert samples[220] == pytest.approx(0.0, abs=0.01)
        assert samples[440] == pytest.approx(1.0, abs=0.01)
    
    def test_creates_descending_sawtooth_with_negative_polarity(self):
        """極性を反転させると下降サwtooth波を生成できる"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act
        ascending = waveform.generate(100, 0.01, polarity=True)
        descending = waveform.generate(100, 0.01, polarity=False)
        
        # Assert
        assert ascending[100] == pytest.approx(-descending[100])
    
    def test_applies_amplitude_scaling(self):
        """振幅スケーリングが正しく適用される"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act
        full_amp = waveform.generate(100, 0.01, amplitude=1.0)
        half_amp = waveform.generate(100, 0.01, amplitude=0.5)
        
        # Assert
        # サwtooth波の特性上、正確に1.0には到達しない
        assert max(full_amp) == pytest.approx(1.0, abs=0.01)
        assert max(half_amp) == pytest.approx(0.5, abs=0.01)
    
    def test_phase_offset_shifts_waveform(self):
        """位相オフセットで波形がシフトする"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act
        no_phase = waveform.generate(100, 0.01, phase=0)
        quarter_phase = waveform.generate(100, 0.01, phase=90)
        
        # Assert
        # 90度位相シフト = 1/4周期分前方にシフト
        # つまり、quarter_phase[0]はno_phase[1/4周期]と等しい
        shift_samples = int(441 / 4)  # 110サンプル
        assert quarter_phase[0] == pytest.approx(no_phase[shift_samples], abs=0.01)


class TestSawtoothWaveformValidation:
    """パラメータ検証のテスト"""
    
    def test_rejects_frequency_below_40hz(self):
        """40Hz未満の周波数を拒否する"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Frequency must be between 40.0-120.0Hz"):
            waveform.generate(30, 0.01)
    
    def test_rejects_frequency_above_120hz(self):
        """120Hz超の周波数を拒否する"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Frequency must be between 40.0-120.0Hz"):
            waveform.generate(150, 0.01)
    
    def test_rejects_invalid_amplitude(self):
        """0-1範囲外の振幅を拒否する"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Amplitude must be between 0.0-1.0"):
            waveform.generate(60, 0.01, amplitude=1.5)