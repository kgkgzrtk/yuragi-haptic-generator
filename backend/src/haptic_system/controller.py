"""
Haptic controller module for API integration
"""

import threading
from typing import Any

from .device import HapticDevice
from config.logging import get_logger

try:
    import sounddevice as sd
except ImportError:
    # テスト環境ではモックを使用
    sd = None


class HapticController:
    """触覚システムコントローラークラス

    API統合、スレッドセーフなパラメータ更新を管理します。
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
        
        # デバイス情報
        self.device_info = self._detect_audio_device()
        self.available_channels = self.device_info.get('channels', 0)

    def _detect_audio_device(self) -> dict[str, Any]:
        """利用可能なオーディオデバイスを検出"""
        if sd is None:
            return {"available": False, "channels": 0, "name": "No sounddevice module"}
        
        try:
            devices = sd.query_devices()
            self.logger.info("Audio devices detected", extra={"device_count": len(devices)})
            
            # デフォルトデバイスを優先的に確認
            default_device_id = sd.default.device[1]  # デフォルト出力デバイス
            if default_device_id is not None and default_device_id >= 0:
                default_dev = devices[default_device_id]
                self.logger.info("Default audio device info", extra={
                    "device_name": default_dev['name'],
                    "channels": default_dev['max_output_channels']
                })
                
                # デフォルトデバイスが4ch以上をサポートしていれば使用
                if default_dev['max_output_channels'] >= 4:
                    return {
                        "available": True,
                        "channels": 4,
                        "device_id": default_device_id,
                        "name": default_dev['name'],
                        "sample_rate": default_dev['default_samplerate']
                    }
                # デフォルトデバイスが2chをサポートしていれば使用
                elif default_dev['max_output_channels'] >= 2:
                    return {
                        "available": True,
                        "channels": 2,
                        "device_id": default_device_id,
                        "name": default_dev['name'],
                        "sample_rate": default_dev['default_samplerate']
                    }
            
            # デフォルトデバイスが使えない場合、他のデバイスを探す
            # 4chデバイスを探す（出力デバイスのみ）
            for idx, dev in enumerate(devices):
                if dev['max_output_channels'] >= 4 and dev['max_input_channels'] == 0:
                    self.logger.info("Found 4-channel audio device", extra={"device_name": dev['name'], "device_id": idx})
                    return {
                        "available": True,
                        "channels": 4,
                        "device_id": idx,
                        "name": dev['name'],
                        "sample_rate": dev['default_samplerate']
                    }
            
            # 2chデバイスを探す（出力デバイスのみ）
            for idx, dev in enumerate(devices):
                if dev['max_output_channels'] >= 2 and dev['max_input_channels'] == 0:
                    self.logger.info("Found 2-channel audio device", extra={"device_name": dev['name'], "device_id": idx})
                    return {
                        "available": True,
                        "channels": 2,
                        "device_id": idx,
                        "name": dev['name'],
                        "sample_rate": dev['default_samplerate']
                    }
            
            # デバイスが見つからない
            return {"available": False, "channels": 0, "name": "No suitable output device"}
            
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
            "sample_rate": self.sample_rate,
            "block_size": self.block_size,
            "channels": self.get_current_parameters()["channels"],
            "device_info": {
                "available": self.device_info.get('available', False),
                "channels": self.available_channels,
                "name": self.device_info.get('name', 'Unknown'),
                "device_mode": "dual" if self.available_channels == 4 else "single"
            }
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
        レイテンシを取得（ストリーミング削除後は固定値）

        Returns:
            レイテンシ（ミリ秒）
        """
        # ストリーミング削除後は固定の理論値を返す
        # block_size / sample_rate * 1000
        return (self.block_size / self.sample_rate) * 1000



    def __enter__(self):
        """コンテキストマネージャー: 開始"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """コンテキストマネージャー: 終了"""
        pass
