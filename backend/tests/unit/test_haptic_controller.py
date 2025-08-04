"""
HapticControllerクラスのユニットテスト
TDDサイクル4: API統合とストリーミング
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
        assert controller.is_streaming == False
    
    @patch('haptic_system.controller.sd')
    def test_can_start_and_stop_streaming(self, mock_sd):
        """ストリーミングの開始・停止ができる"""
        # Arrange
        mock_stream = MagicMock()
        mock_sd.OutputStream.return_value.__enter__.return_value = mock_stream
        controller = HapticController(sample_rate=44100)
        
        # Act & Assert
        controller.start_streaming()
        assert controller.is_streaming == True
        mock_sd.OutputStream.assert_called_once()
        
        controller.stop_streaming()
        assert controller.is_streaming == False


class TestHapticControllerAPI:
    """API統合のテスト"""
    
    @patch('haptic_system.controller.sd')
    def test_updates_parameters_thread_safely(self, mock_sd):
        """スレッドセーフにパラメータ更新できる"""
        # Arrange
        mock_stream = MagicMock()
        mock_sd.OutputStream.return_value.__enter__.return_value = mock_stream
        controller = HapticController()
        controller.start_streaming()
        
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
        time.sleep(0.1)  # 更新が反映されるまで待機
        current_params = controller.get_current_parameters()
        assert current_params["channels"][0]["frequency"] == 60
        assert current_params["channels"][0]["amplitude"] == 0.5
    
    @patch('haptic_system.controller.sd')
    def test_measures_latency(self, mock_sd):
        """レイテンシを測定できる"""
        # Arrange
        mock_stream = MagicMock()
        mock_sd.OutputStream.return_value.__enter__.return_value = mock_stream
        controller = HapticController()
        
        # Act
        controller.start_streaming()
        time.sleep(0.1)
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
        assert "is_streaming" in status
        assert "sample_rate" in status
        assert "block_size" in status
        assert "channels" in status
        assert len(status["channels"]) == 4


class TestHapticControllerCallback:
    """オーディオコールバックのテスト"""
    
    @patch('haptic_system.controller.sd')
    def test_audio_callback_generates_output(self, mock_sd):
        """オーディオコールバックが出力を生成する"""
        # Arrange
        controller = HapticController(sample_rate=44100, block_size=512)
        controller.device.set_channel_parameters(0, frequency=60, amplitude=1.0)
        controller.device.activate_all()
        
        # シミュレート用の出力バッファ
        outdata = np.zeros((512, 4), dtype=np.float32)
        
        # Act
        controller._audio_callback(outdata, 512, None, None)
        
        # Assert
        assert not np.all(outdata == 0)  # 無音ではない
        assert outdata.shape == (512, 4)
    
    @patch('haptic_system.controller.sd')
    def test_audio_callback_handles_stop_flag(self, mock_sd):
        """停止フラグが設定されたら無音を出力"""
        # Arrange
        controller = HapticController()
        controller._stop_flag = True
        outdata = np.zeros((512, 4), dtype=np.float32)
        
        # Act
        controller._audio_callback(outdata, 512, None, None)
        
        # Assert
        assert np.all(outdata == 0)  # 無音


class TestHapticControllerThreadSafety:
    """スレッドセーフティのテスト"""
    
    @patch('haptic_system.controller.sd')
    def test_concurrent_parameter_updates(self, mock_sd):
        """並行パラメータ更新が安全に処理される"""
        # Arrange
        mock_stream = MagicMock()
        mock_sd.OutputStream.return_value.__enter__.return_value = mock_stream
        controller = HapticController()
        controller.start_streaming()
        
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
        assert controller.is_streaming == True
        current_params = controller.get_current_parameters()
        assert current_params is not None
    
    def test_stream_context_management(self):
        """ストリームのコンテキスト管理が適切"""
        # Arrange
        controller = HapticController()
        
        # Act & Assert - with文での使用
        with controller as ctrl:
            assert ctrl.is_streaming == True
        
        # with文を抜けたら停止
        assert controller.is_streaming == False