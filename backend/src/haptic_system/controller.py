"""
Haptic controller module for streaming and API integration
"""

import threading
import time
from typing import Any

import numpy as np

from .device import HapticDevice

try:
    import sounddevice as sd
except ImportError:
    # テスト環境ではモックを使用
    sd = None


class HapticController:
    """触覚システムコントローラークラス

    音声ストリーミング、API統合、スレッドセーフな
    パラメータ更新を管理します。
    """

    def __init__(self, sample_rate: int = 44100, block_size: int = 512):
        """
        初期化

        Args:
            sample_rate: サンプリングレート (Hz)
            block_size: ブロックサイズ（サンプル数）
        """
        self.sample_rate = sample_rate
        self.block_size = block_size
        self.device = HapticDevice(sample_rate)
        self.is_streaming = False

        # ストリーミング関連
        self._stream = None
        self._stop_flag = False
        self._lock = threading.Lock()

        # レイテンシ測定
        self._callback_times = []
        self._max_latency_samples = 100

    def start_streaming(self) -> None:
        """ストリーミングを開始"""
        if self.is_streaming:
            return

        self._stop_flag = False

        if sd is not None:
            self._stream = sd.OutputStream(
                channels=4,
                samplerate=self.sample_rate,
                blocksize=self.block_size,
                callback=self._audio_callback,
                dtype="float32",
            )
            self._stream.start()

        self.is_streaming = True

    def stop_streaming(self) -> None:
        """ストリーミングを停止"""
        self.is_streaming = False
        self._stop_flag = True
        if self._stream and sd is not None:
            self._stream.close()
            self._stream = None

    def _audio_callback(self, outdata, frames, time_info, status):
        """
        オーディオストリーミングのコールバック

        Args:
            outdata: 出力バッファ
            frames: フレーム数
            time_info: タイミング情報
            status: ステータス
        """
        start_time = time.perf_counter()

        if status:
            print(f"Audio callback status: {status}")

        if self._stop_flag:
            outdata.fill(0)
            return

        try:
            # デバイスから波形データを取得
            with self._lock:
                waveform = self.device.get_output_block(frames)

            # 出力バッファにコピー
            outdata[:] = waveform

        except Exception as e:
            print(f"Error in audio callback: {e}")
            outdata.fill(0)

        # レイテンシ測定
        callback_time = (time.perf_counter() - start_time) * 1000  # ms
        self._callback_times.append(callback_time)
        if len(self._callback_times) > self._max_latency_samples:
            self._callback_times.pop(0)

    def update_parameters(self, params: dict[str, Any]) -> None:
        """
        パラメータを更新（スレッドセーフ）

        Args:
            params: パラメータ辞書
        """
        with self._lock:
            if "channels" in params:
                for ch_params in params["channels"]:
                    ch_id = ch_params.get("channel_id", 0)
                    self.device.set_channel_parameters(
                        ch_id,
                        frequency=ch_params.get("frequency"),
                        amplitude=ch_params.get("amplitude"),
                        phase=ch_params.get("phase"),
                        polarity=ch_params.get("polarity"),
                    )
                    # 有効化も含む場合
                    if ch_params.get("amplitude", 0) > 0:
                        self.device.channels[ch_id].activate()

    def get_current_parameters(self) -> dict[str, Any]:
        """
        現在のパラメータを取得

        Returns:
            パラメータ辞書
        """
        with self._lock:
            params = {"channels": []}
            for ch in self.device.channels:
                params["channels"].append(
                    {
                        "channel_id": ch.channel_id,
                        "frequency": ch.current_frequency,
                        "amplitude": ch.current_amplitude,
                        "phase": ch.current_phase,
                        "polarity": ch.current_polarity,
                        "is_active": ch.is_active,
                    }
                )
            return params

    def get_latency_ms(self) -> float:
        """
        平均レイテンシを取得（ミリ秒）

        Returns:
            平均レイテンシ
        """
        if not self._callback_times:
            return 0.0
        return np.mean(self._callback_times)

    def get_status(self) -> dict[str, Any]:
        """
        システム状態を取得

        Returns:
            状態辞書
        """
        return {
            "is_streaming": self.is_streaming,
            "sample_rate": self.sample_rate,
            "block_size": self.block_size,
            "channels": self.get_current_parameters()["channels"],
            "latency_ms": self.get_latency_ms(),
        }

    def __enter__(self):
        """コンテキストマネージャー: 開始"""
        self.start_streaming()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """コンテキストマネージャー: 終了"""
        self.stop_streaming()
