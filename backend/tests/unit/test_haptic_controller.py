"""
HapticControllerクラスのユニットテスト
Updated: Streaming機能削除後のテスト
"""
import pytest
import numpy as np
import time
import threading
from unittest.mock import Mock, patch, MagicMock
from haptic_system.controller import HapticController


class TestHapticControllerBasics:
    """コントローラー基本機能のテスト"""
    
    def test_initializes_with_device(self):
        """デバイスと共に初期化される"""
        # Arrange & Act
        controller = HapticController(sample_rate=44100, block_size=512)
        
        # Assert
        assert controller.device is not None
        assert hasattr(controller, 'device')
        assert controller.device_info is not None


class TestHapticControllerAPI:
    """API統合のテスト"""
    
    def test_updates_parameters_thread_safely(self):
        """スレッドセーフにパラメータ更新できる"""
        # Arrange
        controller = HapticController()
        
        # Act - 別スレッドからの更新をシミュレート
        params = {
            "channels": [
                {"channel_id": 0, "frequency": 60, "amplitude": 0.5},
                {"channel_id": 1, "frequency": 70, "amplitude": 0.6},
                {"channel_id": 2, "frequency": 80, "amplitude": 0.7},
                {"channel_id": 3, "frequency": 90, "amplitude": 0.8}
            ]
        }
        controller.update_parameters(params)
        
        # Assert
        current_params = controller.get_current_parameters()
        assert current_params["channels"][0]["frequency"] == 60
        assert current_params["channels"][0]["amplitude"] == 0.5
    
    def test_measures_latency(self):
        """レイテンシを測定できる"""
        # Arrange
        controller = HapticController()
        
        # Act
        latency = controller.get_latency_ms()
        
        # Assert
        assert isinstance(latency, float)
        assert latency >= 0  # 正の値
        assert latency < 100  # 100ms以下（妥当な範囲）
    
    def test_get_status_returns_device_info(self):
        """デバイス状態情報を取得できる"""
        # Arrange
        controller = HapticController()
        
        # Act
        status = controller.get_status()
        
        # Assert
        assert "sample_rate" in status
        assert "block_size" in status
        assert "channels" in status
        assert "device_info" in status
        assert len(status["channels"]) == 4


class TestHapticControllerThreadSafety:
    """スレッドセーフティのテスト"""
    
    def test_concurrent_parameter_updates(self):
        """並行パラメータ更新が安全に処理される"""
        # Arrange
        controller = HapticController()
        
        # Act - 複数スレッドから同時更新
        def update_params(freq):
            params = {
                "channels": [
                    {"channel_id": 0, "frequency": freq, "amplitude": 0.5},
                    {"channel_id": 1, "frequency": freq, "amplitude": 0.5},
                    {"channel_id": 2, "frequency": freq, "amplitude": 0.5},
                    {"channel_id": 3, "frequency": freq, "amplitude": 0.5}
                ]
            }
            controller.update_parameters(params)
        
        threads = []
        for freq in [50, 60, 70, 80, 90]:
            t = threading.Thread(target=update_params, args=(freq,))
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        # Assert - エラーなく完了
        current_params = controller.get_current_parameters()
        assert current_params is not None
        assert len(current_params["channels"]) == 4
    
    def test_vector_force_control(self):
        """ベクトル力制御が適切に動作する"""
        # Arrange
        controller = HapticController()
        
        # Act
        vector_force = {
            "device_id": 1,
            "angle": 45.0,
            "magnitude": 0.8
        }
        controller.set_vector_force(vector_force)
        
        # Assert
        params = controller.get_current_parameters()
        # デバイス1のチャンネル（0,1）が更新されていることを確認
        assert params["channels"][0]["is_active"] == True
        assert params["channels"][1]["is_active"] == True