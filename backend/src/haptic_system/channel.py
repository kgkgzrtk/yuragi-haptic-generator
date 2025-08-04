"""
Haptic channel management module
"""
import numpy as np
from typing import Optional
from .waveform import SawtoothWaveform

# チャンネルID制限
MIN_CHANNEL_ID = 0
MAX_CHANNEL_ID = 3


class HapticChannel:
    """単一触覚チャンネル管理クラス
    
    単一の振動アクチュエータチャンネルを管理し、
    連続的な波形ストリームを生成します。
    """
    
    def __init__(self, channel_id: int, sample_rate: int = 44100):
        """
        初期化
        
        Args:
            channel_id: チャンネルID (0-3)
            sample_rate: サンプリングレート (Hz)
            
        Raises:
            ValueError: チャンネルIDが無効な場合
        """
        if channel_id < MIN_CHANNEL_ID or channel_id > MAX_CHANNEL_ID:
            raise ValueError(f"Channel ID must be between {MIN_CHANNEL_ID}-{MAX_CHANNEL_ID}")
            
        self.channel_id = channel_id
        self.sample_rate = sample_rate
        self.is_active = False
        
        # 現在のパラメータ
        self.current_frequency = 0.0
        self.current_amplitude = 0.0
        self.current_phase = 0.0
        self.current_polarity = True
        
        # 波形生成器
        self.waveform_generator = SawtoothWaveform(sample_rate)
        
        # 位相連続性のための累積時間
        self.cumulative_time = 0.0
    
    def set_parameters(
        self,
        frequency: Optional[float] = None,
        amplitude: Optional[float] = None,
        phase: Optional[float] = None,
        polarity: Optional[bool] = None
    ) -> None:
        """
        パラメータを設定
        
        Args:
            frequency: 周波数 (Hz)
            amplitude: 振幅 (0.0-1.0)
            phase: 位相オフセット (度)
            polarity: True=上昇波形, False=下降波形
        """
        if frequency is not None:
            self.current_frequency = frequency
        if amplitude is not None:
            self.current_amplitude = amplitude
        if phase is not None:
            self.current_phase = phase
        if polarity is not None:
            self.current_polarity = polarity
    
    def activate(self) -> None:
        """チャンネルを有効化"""
        self.is_active = True
    
    def deactivate(self) -> None:
        """チャンネルを無効化"""
        self.is_active = False
    
    def get_next_chunk(self, block_size: int) -> np.ndarray:
        """
        次の波形チャンクを取得
        
        Args:
            block_size: 取得するサンプル数
            
        Returns:
            波形データ
        """
        if not self.is_active or self.current_amplitude == 0:
            return np.zeros(block_size, dtype=np.float32)
        
        # 生成する時間長
        duration = block_size / self.sample_rate
        
        # 時間配列を生成（累積時間から開始）
        t = np.arange(block_size) / self.sample_rate + self.cumulative_time
        
        # サwtooth波を生成
        # 位相連続性のため、累積時間を使用
        wave = self.current_amplitude * (
            2 * ((self.current_frequency * t + self.current_phase / 360.0) % 1.0) - 1
        )
        
        if not self.current_polarity:
            wave = -wave
        
        # 累積時間を更新
        self.cumulative_time += duration
        
        return wave.astype(np.float32)