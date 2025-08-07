"""
Haptic controller module for streaming and API integration
"""

import threading
import time
from typing import Any

import numpy as np

try:
    from src.config.logging import get_logger
except ImportError:
    from config.logging import get_logger

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
        self.logger = get_logger(__name__)
        self._lock = threading.Lock()
        self.is_streaming = False

        # ストリーミング関連
        self._stream = None
        self._stop_flag = False

        # レイテンシ測定
        self._callback_times = []
        self._max_latency_samples = 100

        # デバイス情報
        self.device_info = self._detect_audio_device()
        self.available_channels = self.device_info.get("channels", 0)

    def _detect_audio_device(self) -> dict[str, Any]:
        """利用可能なオーディオデバイスを検出"""
        if sd is None:
            return {"available": False, "channels": 0, "name": "No sounddevice module"}

        try:
            devices = sd.query_devices()
            self.logger.info(
                "Audio devices detected", extra={"device_count": len(devices)}
            )

            # デフォルトデバイスを優先的に確認
            default_device_id = sd.default.device[1]  # デフォルト出力デバイス
            if default_device_id is not None and default_device_id >= 0:
                default_dev = devices[default_device_id]
                self.logger.info(
                    "Default audio device info",
                    extra={
                        "device_name": default_dev["name"],
                        "channels": default_dev["max_output_channels"],
                    },
                )

                # デフォルトデバイスが4ch以上をサポートしていれば使用
                if default_dev["max_output_channels"] >= 4:
                    return {
                        "available": True,
                        "channels": 4,
                        "device_id": default_device_id,
                        "name": default_dev["name"],
                        "sample_rate": default_dev["default_samplerate"],
                    }
                # デフォルトデバイスが2chをサポートしていれば使用
                elif default_dev["max_output_channels"] >= 2:
                    return {
                        "available": True,
                        "channels": 2,
                        "device_id": default_device_id,
                        "name": default_dev["name"],
                        "sample_rate": default_dev["default_samplerate"],
                    }

            # デフォルトデバイスが使えない場合、他のデバイスを探す
            # 4chデバイスを探す（出力デバイスのみ）
            for idx, dev in enumerate(devices):
                if dev["max_output_channels"] >= 4 and dev["max_input_channels"] == 0:
                    self.logger.info(
                        "Found 4-channel audio device",
                        extra={"device_name": dev["name"], "device_id": idx},
                    )
                    return {
                        "available": True,
                        "channels": 4,
                        "device_id": idx,
                        "name": dev["name"],
                        "sample_rate": dev["default_samplerate"],
                    }

            # 2chデバイスを探す（出力デバイスのみ）
            for idx, dev in enumerate(devices):
                if dev["max_output_channels"] >= 2 and dev["max_input_channels"] == 0:
                    self.logger.info(
                        "Found 2-channel audio device",
                        extra={"device_name": dev["name"], "device_id": idx},
                    )
                    return {
                        "available": True,
                        "channels": 2,
                        "device_id": idx,
                        "name": dev["name"],
                        "sample_rate": dev["default_samplerate"],
                    }

            # デバイスが見つからない
            return {
                "available": False,
                "channels": 0,
                "name": "No suitable output device",
            }

        except Exception as e:
            return {"available": False, "channels": 0, "name": f"Error: {str(e)}"}

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
            "device_info": {
                "available": self.device_info.get("available", False),
                "channels": self.available_channels,
                "name": self.device_info.get("name", "Unknown"),
                "device_mode": "dual" if self.available_channels == 4 else "single",
            },
        }

    def set_vector_force(self, vector_params: dict[str, Any]) -> None:
        """
        ベクトル力制御を設定

        Args:
            vector_params: ベクトル力パラメータ
        """
        with self._lock:
            device_id = vector_params.get("device_id", 1)
            angle = vector_params.get("angle", 0.0)
            magnitude = vector_params.get("magnitude", 0.0)
            frequency = vector_params.get("frequency", 60.0)  # デフォルト60Hz

            self.device.set_vector_force(device_id, angle, magnitude, frequency)

    def get_latency_ms(self) -> float:
        """
        レイテンシを取得

        Returns:
            レイテンシ（ミリ秒）
        """
        if self._callback_times:
            return np.mean(self._callback_times)
        else:
            # コールバックがない場合は理論値を返す
            return (self.block_size / self.sample_rate) * 1000

    def start_streaming(self) -> None:
        """ストリーミングを開始"""
        if self.is_streaming:
            return

        self._stop_flag = False

        if not self.device_info.get('available', False):
            # デバイスが利用できない場合はエラーを発生させる
            raise Exception(f"No audio device available: {self.device_info.get('name', 'Unknown error')}")

        if sd is not None and self.available_channels > 0:
            try:
                # First try with detected device ID
                try:
                    self._stream = sd.OutputStream(
                        device=self.device_info.get('device_id'),
                        channels=self.available_channels,
                        samplerate=self.sample_rate,
                        blocksize=self.block_size,
                        callback=self._audio_callback,
                        dtype="float32",
                    )
                    self._stream.start()
                except Exception as e:
                    # If that fails, try without device ID (use default device)
                    self.logger.warning(f"Failed with device_id, trying default device: {e}")
                    self._stream = sd.OutputStream(
                        channels=self.available_channels,
                        samplerate=self.sample_rate,
                        blocksize=self.block_size,
                        callback=self._audio_callback,
                        dtype="float32",
                    )
                    self._stream.start()
            except Exception as e:
                raise Exception(f"Failed to open audio device: {e}")

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
            self.logger.warning(f"Audio callback status: {status}")

        if self._stop_flag:
            outdata.fill(0)
            return

        try:
            # デバイスから波形データを取得
            with self._lock:
                waveform = self.device.get_output_block(frames)

            # チャンネル数に応じて出力
            if self.available_channels == 2:
                # 2chデバイス: 最初の2チャンネルのみ使用
                outdata[:] = waveform[:, :2]
            elif self.available_channels == 4:
                # 4chデバイス: 全チャンネル使用
                outdata[:] = waveform
            else:
                outdata.fill(0)

        except Exception as e:
            self.logger.error(f"Error in audio callback: {e}")
            outdata.fill(0)

        # レイテンシ測定
        callback_time = (time.perf_counter() - start_time) * 1000  # ms
        self._callback_times.append(callback_time)
        if len(self._callback_times) > self._max_latency_samples:
            self._callback_times.pop(0)

    def __enter__(self):
        """コンテキストマネージャー: 開始"""
        self.start_streaming()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """コンテキストマネージャー: 終了"""
        self.stop_streaming()
