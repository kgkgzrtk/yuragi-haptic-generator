"""
Sawtooth waveform generation module
"""

import numpy as np

# 周波数制限定数（参考実装の30Hz基音に対応）
MIN_FREQUENCY = 30.0  # Hz - Changed from 40.0 to support reference implementation
MAX_FREQUENCY = 120.0  # Hz

# 振幅制限定数
MIN_AMPLITUDE = 0.0
MAX_AMPLITUDE = 1.0


class SawtoothWaveform:
    """サwtooth波形生成クラス

    研究結果に基づいた30-120Hzの範囲で動作する
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


def resonator(u: np.ndarray, fs: float, f_n: float, zeta: float) -> np.ndarray:
    """
    2nd order resonator filter using bilinear transform (Tustin method).

    Implements transfer function: G(s) = ωn²/(s² + 2ζωn*s + ωn²)

    Args:
        u: Input signal array
        fs: Sampling frequency in Hz
        f_n: Natural frequency (resonance frequency) in Hz
        zeta: Damping ratio (typically 0.08 for Q≈6)

    Returns:
        Filtered output signal

    Raises:
        ValueError: If parameters are invalid
    """
    # Parameter validation
    if fs <= 0:
        raise ValueError("Sampling frequency must be positive")
    if f_n <= 0:
        raise ValueError("Natural frequency must be positive")
    if zeta <= 0:
        raise ValueError("Damping ratio must be positive")

    # Convert to angular frequency
    w_n = 2 * np.pi * f_n
    dt = 1 / fs

    # Bilinear transform coefficients
    # From continuous s-domain to discrete z-domain
    a0 = 4 + 4 * zeta * w_n * dt + (w_n * dt) ** 2
    b0 = (w_n * dt) ** 2
    b1 = 2 * b0
    b2 = b0
    a1 = 2 * ((w_n * dt) ** 2 - 4)
    a2 = 4 - 4 * zeta * w_n * dt + (w_n * dt) ** 2

    # Initialize output array
    y = np.zeros_like(u, dtype=np.float64)

    # Apply IIR filter (Direct Form II)
    for n in range(2, len(u)):
        y[n] = (
            b0 * u[n] + b1 * u[n - 1] + b2 * u[n - 2] - a1 * y[n - 1] - a2 * y[n - 2]
        ) / a0

    return y
