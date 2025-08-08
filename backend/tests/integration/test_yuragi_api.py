"""
YURAGI API 統合テスト
既存実装のためTDD Red Phase完了 - 実装済みAPI動作検証
"""

import math

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    """テストクライアントのフィクスチャ"""
    with TestClient(app) as client:
        yield client


@pytest.mark.skip(reason="Requires audio device and streaming")
class TestYuragiPresetAPI:
    """YURAGIプリセットAPIのテスト - 既存実装の動作検証"""

    def test_apply_default_preset_device_1(self, client):
        """デフォルトプリセットをデバイス1に適用できる"""
        # Arrange
        preset_request = {"device_id": 1, "preset": "default", "enabled": True}

        # Act
        response = client.post("/api/yuragi/preset", json=preset_request)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "applied"
        assert data["device_id"] == 1
        assert data["preset"] == "default"
        assert data["enabled"] is True

        # 実装済みデフォルトプリセットのパラメータを検証
        assert "parameters" in data
        params = data["parameters"]
        assert params["frequency"] == 60.0  # 実際のレスポンス値
        assert params["magnitude"] == 0.7  # 実際のレスポンス値
        assert params["angle"] == 0.0  # 実際のレスポンス値
        assert params["rotation_freq"] == 0.33  # 実際のレスポンス値

        # 実際のチャンネルパラメータが設定されたことを確認
        params_response = client.get("/api/parameters")
        channels = params_response.json()["channels"]

        # Device 1 はチャンネル0,1 (base_channel = 0)
        # X軸チャンネル (channel 0) - magnitude * cos(0) = 0.7 * 1 = 0.7
        assert abs(channels[0]["amplitude"] - 0.7) < 0.01
        assert channels[0]["frequency"] == 60.0
        assert channels[0]["polarity"] is True  # 正の振幅

        # Y軸チャンネル (channel 1) - magnitude * sin(0) = 0.7 * 0 = 0.0
        assert abs(channels[1]["amplitude"] - 0.0) < 0.01
        assert channels[1]["frequency"] == 60.0

    def test_apply_gentle_preset_device_2(self, client):
        """ジェントルプリセットをデバイス2に適用できる"""
        # Arrange
        preset_request = {"device_id": 2, "preset": "gentle", "enabled": True}

        # Act
        response = client.post("/api/yuragi/preset", json=preset_request)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "applied"
        assert data["device_id"] == 2
        assert data["preset"] == "gentle"

        # 実装済みジェントルプリセットのパラメータを検証
        params = data["parameters"]
        assert params["frequency"] == 40.0  # 実際のレスポンス値
        assert params["magnitude"] == 0.4  # 実際のレスポンス値
        assert params["angle"] == 45.0  # 実際のレスポンス値
        assert params["rotation_freq"] == 0.2  # 実際のレスポンス値

        # 実際のチャンネルパラメータが設定されたことを確認
        params_response = client.get("/api/parameters")
        channels = params_response.json()["channels"]

        # Device 2 はチャンネル2,3 (base_channel = 2)
        # 45度の場合：X = magnitude * cos(45°), Y = -magnitude * sin(45°)
        expected_x = 0.4 * math.cos(math.radians(45))  # ≈ 0.283
        expected_y = -0.4 * math.sin(math.radians(45))  # ≈ -0.283

        assert abs(channels[2]["amplitude"] - abs(expected_x)) < 0.01
        assert channels[2]["frequency"] == 40.0
        assert abs(channels[3]["amplitude"] - abs(expected_y)) < 0.01
        assert channels[3]["frequency"] == 40.0

    def test_apply_strong_preset(self, client):
        """ストロングプリセットを適用できる"""
        # Arrange
        preset_request = {"device_id": 1, "preset": "strong", "enabled": True}

        # Act
        response = client.post("/api/yuragi/preset", json=preset_request)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["preset"] == "strong"

        # 実装済みストロングプリセットのパラメータを検証
        params = data["parameters"]
        assert params["frequency"] == 80.0  # 実際のレスポンス値
        assert params["magnitude"] == 1.0  # 実際のレスポンス値
        assert params["angle"] == 90.0  # 実際のレスポンス値
        assert params["rotation_freq"] == 0.5  # 実際のレスポンス値

    def test_apply_slow_preset(self, client):
        """スロープリセットを適用できる"""
        # Arrange
        preset_request = {"device_id": 1, "preset": "slow", "enabled": True}

        # Act
        response = client.post("/api/yuragi/preset", json=preset_request)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["preset"] == "slow"

        # 実装済みスロープリセットのパラメータを検証
        params = data["parameters"]
        assert params["frequency"] == 25.0  # 実際のレスポンス値
        assert params["magnitude"] == 0.8  # 実際のレスポンス値
        assert params["angle"] == 180.0  # 実際のレスポンス値
        assert params["rotation_freq"] == 0.15  # 実際のレスポンス値

    def test_disable_preset(self, client):
        """プリセットを無効化できる"""
        # Arrange - まず有効化
        enable_request = {"device_id": 1, "preset": "default", "enabled": True}
        client.post("/api/yuragi/preset", json=enable_request)

        # 無効化リクエスト
        disable_request = {"device_id": 1, "preset": "default", "enabled": False}

        # Act
        response = client.post("/api/yuragi/preset", json=disable_request)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "disabled"
        assert data["enabled"] is False

        # 無効化時のパラメータを検証
        params = data["parameters"]
        assert params["magnitude"] == 0.0
        assert params["frequency"] == 60.0  # デフォルト周波数
        assert params["angle"] == 0.0
        assert params["rotation_freq"] == 0.0

        # チャンネルが無効化されたことを確認（振幅が0）
        params_response = client.get("/api/parameters")
        channels = params_response.json()["channels"]
        assert channels[0]["amplitude"] == 0.0
        assert channels[1]["amplitude"] == 0.0

    def test_invalid_device_id(self, client):
        """無効なデバイスIDを拒否する"""
        # Arrange
        invalid_request = {
            "device_id": 3,  # 無効（1または2のみ有効）
            "preset": "default",
            "enabled": True,
        }

        # Act
        response = client.post("/api/yuragi/preset", json=invalid_request)

        # Assert
        assert response.status_code == 422  # Pydantic validation error

    def test_invalid_preset_name(self, client):
        """無効なプリセット名を拒否する"""
        # Arrange
        invalid_request = {
            "device_id": 1,
            "preset": "invalid_preset",  # 無効なプリセット
            "enabled": True,
        }

        # Act
        response = client.post("/api/yuragi/preset", json=invalid_request)

        # Assert
        assert response.status_code == 422  # Pydantic validation error

    def test_missing_required_fields(self, client):
        """必須フィールドが欠けている場合を拒否する"""
        # Arrange - device_id なし
        invalid_request = {"preset": "default", "enabled": True}

        # Act
        response = client.post("/api/yuragi/preset", json=invalid_request)

        # Assert
        assert response.status_code == 422  # Pydantic validation error

    def test_preset_parameter_defaults(self, client):
        """プリセットのデフォルト値が正しく設定されている"""
        # Arrange - presetとenabledを省略
        minimal_request = {"device_id": 1}

        # Act
        response = client.post("/api/yuragi/preset", json=minimal_request)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["preset"] == "default"  # デフォルトプリセット
        assert data["enabled"] is True  # デフォルトで有効

    def test_all_preset_types_have_required_fields(self, client):
        """全プリセットタイプが必要なフィールドを持っている"""
        presets = ["default", "gentle", "strong", "slow"]

        for preset_name in presets:
            request = {"device_id": 1, "preset": preset_name, "enabled": True}

            response = client.post("/api/yuragi/preset", json=request)
            assert response.status_code == 200

            data = response.json()
            params = data["parameters"]

            # 全プリセットで必要なフィールドが存在することを確認（実際のレスポンス形式）
            required_fields = ["angle", "magnitude", "frequency", "rotation_freq"]
            for field in required_fields:
                assert field in params, f"Missing field {field} in preset {preset_name}"
                assert isinstance(
                    params[field], int | float
                ), f"Field {field} should be numeric in preset {preset_name}"

    def test_both_devices_independent_presets(self, client):
        """両方のデバイスで独立してプリセットを設定できる"""
        # Arrange & Act
        device1_request = {"device_id": 1, "preset": "gentle", "enabled": True}
        device2_request = {"device_id": 2, "preset": "strong", "enabled": True}

        response1 = client.post("/api/yuragi/preset", json=device1_request)
        response2 = client.post("/api/yuragi/preset", json=device2_request)

        # Assert
        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response1.json()["preset"] == "gentle"
        assert response2.json()["preset"] == "strong"

        # 両方のデバイスのチャンネルが正しく設定されたことを確認
        params_response = client.get("/api/parameters")
        channels = params_response.json()["channels"]

        # Device 1 (channels 0,1) - gentle preset (40Hz)
        assert channels[0]["frequency"] == 40.0
        assert channels[1]["frequency"] == 40.0

        # Device 2 (channels 2,3) - strong preset (80Hz)
        assert channels[2]["frequency"] == 80.0
        assert channels[3]["frequency"] == 80.0

    def test_response_format_validation(self, client):
        """レスポンス形式が実装仕様通りであることを検証"""
        # Arrange
        request = {"device_id": 1, "preset": "default", "enabled": True}

        # Act
        response = client.post("/api/yuragi/preset", json=request)

        # Assert
        assert response.status_code == 200
        data = response.json()

        # 必須フィールドの存在を確認（実装に基づく）
        required_fields = ["status", "device_id", "preset", "enabled", "parameters"]
        for field in required_fields:
            assert field in data, f"Required field '{field}' missing from response"

        # parametersの構造を確認（実際のレスポンス形式）
        params = data["parameters"]
        param_fields = ["angle", "magnitude", "frequency", "rotation_freq"]
        for field in param_fields:
            assert field in params, f"Required parameter field '{field}' missing"

        # データ型の確認
        assert isinstance(data["device_id"], int)
        assert isinstance(data["preset"], str)
        assert isinstance(data["enabled"], bool)
        assert isinstance(params["angle"], int | float)
        assert isinstance(params["magnitude"], int | float)
        assert isinstance(params["frequency"], int | float)
        assert isinstance(params["rotation_freq"], int | float)

    def test_preset_specific_values(self, client):
        """各プリセットの具体的な値を検証"""
        expected_presets = {
            "default": {
                "angle": 0.0,
                "magnitude": 0.7,
                "frequency": 60.0,
                "rotation_freq": 0.33,
            },
            "gentle": {
                "angle": 45.0,
                "magnitude": 0.4,
                "frequency": 40.0,
                "rotation_freq": 0.2,
            },
            "strong": {
                "angle": 90.0,
                "magnitude": 1.0,
                "frequency": 80.0,
                "rotation_freq": 0.5,
            },
            "slow": {
                "angle": 180.0,
                "magnitude": 0.8,
                "frequency": 25.0,
                "rotation_freq": 0.15,
            },
        }

        for preset_name, expected_params in expected_presets.items():
            request = {"device_id": 1, "preset": preset_name, "enabled": True}

            response = client.post("/api/yuragi/preset", json=request)
            assert response.status_code == 200

            data = response.json()
            params = data["parameters"]

            for param_key, expected_value in expected_params.items():
                assert (
                    params[param_key] == expected_value
                ), f"Preset {preset_name}: expected {param_key}={expected_value}, got {params[param_key]}"
