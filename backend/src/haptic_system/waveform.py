"""
Sawtooth waveform generation module
"""

import numpy as np

# 周波数制限定数
MIN_FREQUENCY = 40.0  # Hz
MAX_FREQUENCY = 120.0  # Hz

# 振幅制限定数
MIN_AMPLITUDE = 0.0
MAX_AMPLITUDE = 1.0


class SawtoothWaveform:
    """サwtooth波形生成クラス

    研究結果に基づいた40-120Hzの範囲で動作する
    サwtooth波形を生成します。偏加速度による
    力覚提示に最適化されています。
    """

    def __init__(self, sample_rate: int = 44100):
        """
        初期化

        Args:
            sample_rate: サンプリングレート (Hz)
        """
        self.sample_rate = sample_rate

    def generate(
        self,
        frequency: float,
        duration: float,
        amplitude: float = 1.0,
        phase: float = 0.0,
        polarity: bool = True,
    ) -> np.ndarray:
        """
        サwtooth波を生成

        Args:
            frequency: 周波数 (Hz)
            duration: 生成する波形の長さ (秒)
            amplitude: 振幅 (0.0-1.0)
            phase: 位相オフセット (度)
            polarity: True=上昇波形, False=下降波形

        Returns:
            生成された波形データ

        Raises:
            ValueError: パラメータが無効な場合
        """
        # パラメータ検証
        self._validate_parameters(frequency, amplitude)

        # サンプル数計算
        num_samples = int(self.sample_rate * duration)

        # 時間配列生成
        t = np.arange(num_samples) / self.sample_rate

        # 位相をラジアンに変換
        phase_rad = np.deg2rad(phase)

        # サwtooth波生成 (研究資料の式を使用)
        # wave = amp * (2 * ((freq * t + phase) % 1.0) - 1)
        wave = amplitude * (2 * ((frequency * t + phase_rad / (2 * np.pi)) % 1.0) - 1)

        # 極性反転
        if not polarity:
            wave = -wave

        return wave.astype(np.float32)

    def _validate_parameters(self, frequency: float, amplitude: float) -> None:
        """
        パラメータの妥当性を検証

        Args:
            frequency: 周波数 (Hz)
            amplitude: 振幅 (0.0-1.0)

        Raises:
            ValueError: パラメータが無効な場合
        """
        if frequency < MIN_FREQUENCY or frequency > MAX_FREQUENCY:
            raise ValueError(
                f"Frequency must be between {MIN_FREQUENCY}-{MAX_FREQUENCY}Hz"
            )
        if amplitude < MIN_AMPLITUDE or amplitude > MAX_AMPLITUDE:
            raise ValueError(
                f"Amplitude must be between {MIN_AMPLITUDE}-{MAX_AMPLITUDE}"
            )
