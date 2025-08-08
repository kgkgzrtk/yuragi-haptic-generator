"""
FastAPI統合テスト
"""

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    """テストクライアントのフィクスチャ"""
    with TestClient(app) as client:
        yield client


class TestAPIHealth:
    """ヘルスチェックAPIのテスト"""

    def test_health_check_returns_ok(self, client):
        """ヘルスチェックエンドポイントが正常に応答する"""
        # Act
        response = client.get("/api/health")

        # Assert
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_root_endpoint(self, client):
        """ルートエンドポイントが正常に応答する"""
        # Act
        response = client.get("/")

        # Assert
        assert response.status_code == 200
        assert "message" in response.json()


class TestParametersAPI:
    """パラメータ管理APIのテスト"""

    def test_get_initial_parameters(self, client):
        """初期パラメータを取得できる"""
        # Act
        response = client.get("/api/parameters")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "channels" in data
        assert len(data["channels"]) == 4

        # 各チャンネルの初期値を確認
        for i, channel in enumerate(data["channels"]):
            assert channel["channelId"] == i
            assert channel["frequency"] == 60.0  # 初期化時に設定される周波数
            assert channel["amplitude"] == 0.0  # デフォルト値（実際の初期値は0.0）

    def test_update_parameters(self, client):
        """パラメータを更新できる"""
        # Arrange
        new_params = {
            "channels": [
                {
                    "channel_id": 0,
                    "frequency": 60.0,
                    "amplitude": 0.5,
                    "phase": 0.0,
                    "polarity": True,
                },
                {
                    "channel_id": 1,
                    "frequency": 70.0,
                    "amplitude": 0.6,
                    "phase": 90.0,
                    "polarity": True,
                },
                {
                    "channel_id": 2,
                    "frequency": 80.0,
                    "amplitude": 0.7,
                    "phase": 180.0,
                    "polarity": False,
                },
                {
                    "channel_id": 3,
                    "frequency": 90.0,
                    "amplitude": 0.8,
                    "phase": 270.0,
                    "polarity": False,
                },
            ]
        }

        # Act
        response = client.put("/api/parameters", json=new_params)

        # Assert
        assert response.status_code == 200
        assert response.json() == {"status": "updated"}

        # 更新されたパラメータを確認
        get_response = client.get("/api/parameters")
        updated_data = get_response.json()

        for i, channel in enumerate(updated_data["channels"]):
            assert channel["frequency"] == new_params["channels"][i]["frequency"]
            assert channel["amplitude"] == new_params["channels"][i]["amplitude"]

    def test_update_invalid_parameters(self, client):
        """無効なパラメータを拒否する"""
        # Arrange - 無効な周波数
        invalid_params = {
            "channels": [
                {"channel_id": 0, "frequency": 200.0, "amplitude": 0.5}  # 120Hz超
            ]
        }

        # Act
        response = client.put("/api/parameters", json=invalid_params)

        # Assert
        assert response.status_code == 422  # Validation Error


class TestChannelAPI:
    """個別チャンネル制御APIのテスト"""

    def test_update_single_channel(self, client):
        """単一チャンネルを更新できる"""
        # Arrange
        channel_params = {
            "frequency": 75.0,
            "amplitude": 0.65,
            "phase": 45.0,
            "polarity": True,
        }

        # Act
        response = client.put("/api/channels/1", json=channel_params)

        # Assert
        assert response.status_code == 200
        assert response.json()["channel_id"] == 1
        assert response.json()["status"] == "updated"

        # パラメータが更新されたことを確認
        get_response = client.get("/api/parameters")
        channels = get_response.json()["channels"]
        assert channels[1]["frequency"] == 75.0
        assert channels[1]["amplitude"] == 0.65

    def test_update_invalid_channel_id(self, client):
        """無効なチャンネルIDを拒否する"""
        # Arrange
        channel_params = {"frequency": 60.0, "amplitude": 0.5}

        # Act
        response = client.put("/api/channels/5", json=channel_params)  # チャンネル5は存在しない

        # Assert
        assert response.status_code == 400
        assert "Invalid channel ID" in response.json()["detail"]


class TestWaveformAPI:
    """波形データAPIのテスト"""

    def test_get_waveform_data(self, client):
        """波形データを取得できる"""
        # Arrange
        request_data = {"duration": 0.1, "sample_rate": 44100}

        # Act
        response = client.post("/api/waveform", json=request_data)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "timestamp" in data
        assert "sample_rate" in data
        assert "channels" in data
        assert len(data["channels"]) == 4

        # 各チャンネルのデータを確認
        for i, channel in enumerate(data["channels"]):
            assert channel["channelId"] == i
            assert "data" in channel
            assert isinstance(channel["data"], list)

    @pytest.mark.skip(
        reason="Waveform generation requires sounddevice module which is not available in test environment"
    )
    def test_waveform_with_active_channels(self, client):
        """アクティブなチャンネルの波形データを取得"""
        # Arrange - チャンネルを設定
        params = {
            "channels": [
                {
                    "channel_id": 0,
                    "frequency": 60.0,
                    "amplitude": 1.0,
                    "phase": 0.0,
                    "polarity": True,
                },
                {
                    "channel_id": 1,
                    "frequency": 0.0,
                    "amplitude": 0.0,
                    "phase": 0.0,
                    "polarity": True,
                },  # 無音
                {
                    "channel_id": 2,
                    "frequency": 0.0,
                    "amplitude": 0.0,
                    "phase": 0.0,
                    "polarity": True,
                },  # 無音
                {
                    "channel_id": 3,
                    "frequency": 0.0,
                    "amplitude": 0.0,
                    "phase": 0.0,
                    "polarity": True,
                },  # 無音
            ]
        }
        client.put("/api/parameters", json=params)

        # Act
        response = client.post("/api/waveform", json={"duration": 0.01})

        # Assert
        assert response.status_code == 200
        data = response.json()

        # チャンネル0は波形データあり
        ch0_data = data["channels"][0]["data"]
        assert len(ch0_data) > 0
        assert any(abs(val) > 0 for val in ch0_data)

        # 他のチャンネルは無音
        for i in range(1, 4):
            ch_data = data["channels"][i]["data"]
            assert all(val == 0 for val in ch_data)


# NOTE: Streaming endpoints have been removed as part of the refactoring
# The functionality is now handled differently without explicit streaming control


@pytest.mark.skip(reason="Streaming endpoints removed in refactoring")
class TestStreamingControl:
    """ストリーミング制御APIのテスト - DEPRECATED"""

    def test_start_streaming(self, client):
        """ストリーミングを開始できる"""
        pass

    def test_stop_streaming(self, client):
        """ストリーミングを停止できる"""
        pass

    def test_get_streaming_status(self, client):
        """ストリーミング状態を取得できる"""
        pass


class TestVectorForceAPI:
    """ベクトル力覚APIのテスト"""

    def test_set_vector_force(self, client):
        """ベクトル力覚を設定できる"""
        # Skip this test as it requires a real audio device
        pytest.skip("Requires audio device")

        # Arrange - Start streaming first
        # start_response = client.post("/api/streaming/start")
        # assert start_response.status_code == 200

        # vector_params = {
        #     "device_id": 1,
        #     "angle": 45.0,
        #     "magnitude": 0.8,
        #     "frequency": 60.0,
        # }

        # # Act
        # response = client.post("/api/vector-force", json=vector_params)

        # # Assert
        # assert response.status_code == 200
        # assert response.json()["status"] == "applied"

        # パラメータが正しく設定されたか確認
        params_response = client.get("/api/parameters")
        channels = params_response.json()["channels"]

        # 45度の場合、Ch0とCh1が同じ振幅
        import math

        expected_amp = 0.8 * math.cos(math.radians(45))
        assert abs(channels[0]["amplitude"] - expected_amp) < 0.01
        assert abs(channels[1]["amplitude"] - expected_amp) < 0.01

    def test_invalid_device_id(self, client):
        """無効なデバイスIDを拒否する"""
        # Arrange
        vector_params = {
            "device_id": 3,  # 無効なID
            "angle": 0.0,
            "magnitude": 1.0,
            "frequency": 60.0,
        }

        # Act
        response = client.post("/api/vector-force", json=vector_params)

        # Assert
        assert response.status_code == 422  # Pydantic validation error
        # ValidationErrorの詳細確認は省略（Pydanticのエラー形式は複雑）

    def test_vector_force_requires_streaming(self, client):
        """ストリーミングが開始されていない場合はエラーが返る"""
        # Arrange - Stop streaming first since it auto-starts in lifespan
        client.post("/api/streaming/stop")

        vector_params = {
            "device_id": 1,
            "angle": 45.0,
            "magnitude": 0.8,
            "frequency": 60.0,
        }

        # Act
        response = client.post("/api/vector-force", json=vector_params)

        # Assert
        assert response.status_code == 400
        assert "Streaming is not started" in response.json()["detail"]
        assert "/api/streaming/start" in response.json()["detail"]
