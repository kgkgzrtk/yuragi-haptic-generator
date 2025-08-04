"""
Haptic device management module
"""

from typing import Optional

import numpy as np

from .channel import HapticChannel


class HapticDevice:
    """4チャンネル触覚デバイス管理クラス

    4つの独立したチャンネルを管理し、2つの2軸アクチュエータ
    （デバイス1: Ch0,1、デバイス2: Ch2,3）を制御します。
    """

    def __init__(self, sample_rate: int = 44100):
        """
        初期化

        Args:
            sample_rate: サンプリングレート (Hz)
        """
        self.sample_rate = sample_rate
        self.channels: list[HapticChannel] = []

        # 4つのチャンネルを作成
        for i in range(4):
            self.channels.append(HapticChannel(channel_id=i, sample_rate=sample_rate))

    def set_channel_parameters(
        self,
        channel_id: int,
        frequency: Optional[float] = None,
        amplitude: Optional[float] = None,
        phase: Optional[float] = None,
        polarity: Optional[bool] = None,
    ) -> None:
        """
        特定チャンネルのパラメータを設定

        Args:
            channel_id: チャンネルID (0-3)
            frequency: 周波数 (Hz)
            amplitude: 振幅 (0.0-1.0)
            phase: 位相オフセット (度)
            polarity: True=上昇波形, False=下降波形
        """
        if 0 <= channel_id < 4:
            self.channels[channel_id].set_parameters(
                frequency=frequency, amplitude=amplitude, phase=phase, polarity=polarity
            )

    def set_all_parameters(self, params_list: list[dict]) -> None:
        """
        全チャンネルのパラメータを一括設定

        Args:
            params_list: 各チャンネルのパラメータ辞書のリスト
        """
        for i, params in enumerate(params_list[:4]):  # 最大4チャンネル
            self.set_channel_parameters(i, **params)

    def set_vector_force(
        self,
        device_id: int,
        angle: float,
        magnitude: float,
        frequency: float,
        phase: float = 0.0,
    ) -> None:
        """
        ベクトル力覚を生成

        Args:
            device_id: デバイスID (1 or 2)
            angle: 力の方向 (度、0=右、90=上)
            magnitude: 力の大きさ (0.0-1.0)
            frequency: 周波数 (Hz)
            phase: 位相オフセット (度)

        Raises:
            ValueError: デバイスIDが無効な場合
        """
        if device_id not in [1, 2]:
            raise ValueError("Device ID must be 1 or 2")

        # 角度をラジアンに変換
        angle_rad = np.deg2rad(angle)

        # X/Y成分を計算
        x_amplitude = magnitude * np.cos(angle_rad)
        y_amplitude = magnitude * np.sin(angle_rad)

        # チャンネルインデックスを計算
        base_channel = (device_id - 1) * 2

        # X軸チャンネル設定
        self.set_channel_parameters(
            base_channel,
            frequency=frequency,
            amplitude=abs(x_amplitude),
            phase=phase,
            polarity=(x_amplitude >= 0),
        )

        # Y軸チャンネル設定
        self.set_channel_parameters(
            base_channel + 1,
            frequency=frequency,
            amplitude=abs(y_amplitude),
            phase=phase,
            polarity=(y_amplitude >= 0),
        )

        # 対象デバイスのチャンネルを有効化
        self.channels[base_channel].activate()
        self.channels[base_channel + 1].activate()

    def get_output_block(self, block_size: int) -> np.ndarray:
        """
        4チャンネル出力ブロックを取得

        Args:
            block_size: ブロックサイズ（サンプル数）

        Returns:
            4チャンネル波形データ (shape: [block_size, 4])
        """
        output = np.zeros((block_size, 4), dtype=np.float32)

        for i, channel in enumerate(self.channels):
            output[:, i] = channel.get_next_chunk(block_size)

        return output

    def activate_all(self) -> None:
        """全チャンネルを有効化"""
        for channel in self.channels:
            channel.activate()

    def deactivate_all(self) -> None:
        """全チャンネルを無効化"""
        for channel in self.channels:
            channel.deactivate()
