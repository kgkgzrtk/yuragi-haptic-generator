"""
Haptic channel management module
"""

import numpy as np

from .validators import validate_channel_id
from .waveform import SawtoothWaveform, resonator

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
        validate_channel_id(channel_id)

        self.channel_id = channel_id
        self.sample_rate = sample_rate
        self.is_active = False

        # 現在のパラメータ（frequency=60で初期化）
        self.current_frequency = 60.0
        self.current_amplitude = 0.0
        self.current_phase = 0.0
        self.current_polarity = True

        # 波形生成器
        self.waveform_generator = SawtoothWaveform(sample_rate)

        # 位相連続性のための累積時間
        self.cumulative_time = 0.0

        # Resonator設定
        self.resonator_enabled = True  # Enable resonator by default
        self.resonator_f_n = 360.0  # Default resonance frequency (6x base frequency)
        self.resonator_zeta = 0.08  # Default damping ratio

        # Noise設定
        self.noise_enabled = False
        self.noise_level = 0.03  # Default 3% noise
        self.noise_rng = None  # Random number generator for noise

    def set_parameters(
        self,
        frequency: float | None = None,
        amplitude: float | None = None,
        phase: float | None = None,
        polarity: bool | None = None,
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

        # のこぎり波を生成
        # 位相連続性のため、累積時間を使用
        wave = self.current_amplitude * (
            2 * ((self.current_frequency * t + self.current_phase / 360.0) % 1.0) - 1
        )

        if not self.current_polarity:
            wave = -wave

        # 累積時間を更新
        self.cumulative_time += duration

        # Apply resonator if enabled
        if self.resonator_enabled:
            wave = resonator(
                wave, self.sample_rate, self.resonator_f_n, self.resonator_zeta
            )

        # Apply noise if enabled
        if self.noise_enabled:
            if self.noise_rng is not None:
                noise = self.noise_rng.normal(0, self.noise_level, len(wave))
            else:
                noise = np.random.normal(0, self.noise_level, len(wave))

            # Scale noise by signal RMS for relative noise level
            signal_rms = np.sqrt(np.mean(wave**2))
            if signal_rms > 0:
                wave = wave + noise * signal_rms

        return wave.astype(np.float32)

    def enable_resonator(self, f_n: float = 360.0, zeta: float = 0.08) -> None:
        """
        Enable resonator filter for this channel.

        Args:
            f_n: Natural frequency (resonance frequency) in Hz (default 360Hz = 6x base frequency)
            zeta: Damping ratio (typically 0.08 for Q≈6)
        """
        self.resonator_enabled = True
        self.resonator_f_n = f_n
        self.resonator_zeta = zeta

    def disable_resonator(self) -> None:
        """Disable resonator filter for this channel."""
        self.resonator_enabled = False

    def enable_noise(self, level: float = 0.03, seed: int | None = None) -> None:
        """
        Enable noise simulation for this channel.

        Args:
            level: Noise level as fraction of signal RMS (default 0.03 = 3%)
            seed: Random seed for reproducible noise (optional)

        Raises:
            ValueError: If noise level is invalid
        """
        if level < 0 or level > 1.0:
            raise ValueError("Noise level must be between 0 and 1.0")

        self.noise_enabled = True
        self.noise_level = level

        if seed is not None:
            self.noise_rng = np.random.RandomState(seed)
        else:
            self.noise_rng = None

    def disable_noise(self) -> None:
        """Disable noise simulation for this channel."""
        self.noise_enabled = False
        self.noise_rng = None
