"""
HapticDeviceクラスのユニットテスト
TDDサイクル3: 4チャンネル統合管理
"""

import numpy as np
import pytest

from haptic_system.device import HapticDevice


class TestHapticDeviceInitialization:
    """デバイス初期化のテスト"""

    def test_creates_four_channels(self):
        """4つのチャンネルが作成される"""
        # Arrange & Act
        device = HapticDevice(sample_rate=44100)

        # Assert
        assert len(device.channels) == 4
        for i, channel in enumerate(device.channels):
            assert channel.channel_id == i

    def test_all_channels_start_inactive(self):
        """全チャンネルが非アクティブで開始"""
        # Arrange & Act
        device = HapticDevice(sample_rate=44100)

        # Assert
        for channel in device.channels:
            assert not channel.is_active


class TestHapticDeviceOperation:
    """デバイス動作のテスト"""

    def test_generates_4channel_output(self):
        """4チャンネル出力を生成できる"""
        # Arrange
        device = HapticDevice(sample_rate=44100)
        device.set_channel_parameters(0, frequency=60, amplitude=1.0)
        device.set_channel_parameters(1, frequency=70, amplitude=0.8)
        device.set_channel_parameters(2, frequency=80, amplitude=0.6)
        device.set_channel_parameters(3, frequency=90, amplitude=0.4)
        device.activate_all()  # チャンネルを有効化

        # Act
        output = device.get_output_block(block_size=512)

        # Assert
        assert output.shape == (512, 4)
        # 各チャンネルの振幅を確認（サwtooth波の特性を考慮）
        assert np.max(np.abs(output[:, 0])) == pytest.approx(1.0, abs=0.01)
        assert np.max(np.abs(output[:, 1])) == pytest.approx(0.8, abs=0.01)

    def test_xy_axis_coordination(self):
        """X/Y軸の協調動作（デバイス1: ch0,1、デバイス2: ch2,3）"""
        # Arrange
        device = HapticDevice(sample_rate=44100)

        # Act - 45度方向の力覚生成
        device.set_vector_force(
            device_id=1, angle=45, magnitude=1.0, frequency=60  # デバイス1  # 45度
        )

        # Assert
        output = device.get_output_block(512)
        # Ch0(X)とCh1(Y)が同じ振幅（45度の場合）
        assert np.max(np.abs(output[:, 0])) == pytest.approx(
            np.max(np.abs(output[:, 1])), abs=0.01
        )
        # Ch2,3は無音
        assert np.max(np.abs(output[:, 2])) == 0
        assert np.max(np.abs(output[:, 3])) == 0

    def test_set_all_channels_parameters(self):
        """全チャンネルのパラメータを一括設定"""
        # Arrange
        device = HapticDevice(sample_rate=44100)
        params = [
            {"frequency": 50, "amplitude": 0.5, "phase": 0, "polarity": True},
            {"frequency": 60, "amplitude": 0.6, "phase": 90, "polarity": True},
            {"frequency": 70, "amplitude": 0.7, "phase": 180, "polarity": False},
            {"frequency": 80, "amplitude": 0.8, "phase": 270, "polarity": False},
        ]

        # Act
        device.set_all_parameters(params)

        # Assert
        for i, channel in enumerate(device.channels):
            assert channel.current_frequency == params[i]["frequency"]
            assert channel.current_amplitude == params[i]["amplitude"]
            assert channel.current_phase == params[i]["phase"]
            assert channel.current_polarity == params[i]["polarity"]


class TestHapticDeviceVectorControl:
    """ベクトル制御のテスト"""

    def test_vector_force_0_degrees(self):
        """0度（右方向）の力覚生成"""
        # Arrange
        device = HapticDevice(sample_rate=44100)

        # Act
        device.set_vector_force(device_id=1, angle=0, magnitude=1.0, frequency=60)
        output = device.get_output_block(512)

        # Assert
        # X軸（Ch0）のみ出力、Y軸（Ch1）は無音
        assert np.max(np.abs(output[:, 0])) == pytest.approx(1.0, abs=0.01)
        assert np.max(np.abs(output[:, 1])) == pytest.approx(0.0, abs=0.01)

    def test_vector_force_90_degrees(self):
        """90度（上方向）の力覚生成"""
        # Arrange
        device = HapticDevice(sample_rate=44100)

        # Act
        device.set_vector_force(device_id=1, angle=90, magnitude=1.0, frequency=60)
        output = device.get_output_block(512)

        # Assert
        # Y軸（Ch1）のみ出力、X軸（Ch0）は無音
        assert np.max(np.abs(output[:, 0])) == pytest.approx(0.0, abs=0.01)
        assert np.max(np.abs(output[:, 1])) == pytest.approx(1.0, abs=0.01)

    def test_vector_force_device_2(self):
        """デバイス2（Ch2,3）でのベクトル力覚生成"""
        # Arrange
        device = HapticDevice(sample_rate=44100)

        # Act
        device.set_vector_force(device_id=2, angle=45, magnitude=0.5, frequency=80)
        output = device.get_output_block(512)

        # Assert
        # デバイス1（Ch0,1）は無音
        assert np.max(np.abs(output[:, 0])) == 0
        assert np.max(np.abs(output[:, 1])) == 0
        # デバイス2（Ch2,3）は45度方向
        ch2_max = np.max(np.abs(output[:, 2]))
        ch3_max = np.max(np.abs(output[:, 3]))
        assert ch2_max == pytest.approx(ch3_max, abs=0.01)
        assert ch2_max == pytest.approx(0.5 * np.cos(np.deg2rad(45)), abs=0.05)

    def test_invalid_device_id(self):
        """無効なデバイスIDを拒否"""
        # Arrange
        device = HapticDevice(sample_rate=44100)

        # Act & Assert
        with pytest.raises(ValueError, match="Device ID must be 1 or 2"):
            device.set_vector_force(device_id=3, angle=0, magnitude=1.0, frequency=60)


class TestHapticDeviceActivation:
    """チャンネル有効化のテスト"""

    def test_activate_all_channels(self):
        """全チャンネルを有効化"""
        # Arrange
        device = HapticDevice(sample_rate=44100)
        device.set_channel_parameters(0, frequency=60, amplitude=0.5)
        device.set_channel_parameters(1, frequency=70, amplitude=0.5)
        device.set_channel_parameters(2, frequency=80, amplitude=0.5)
        device.set_channel_parameters(3, frequency=90, amplitude=0.5)

        # Act
        device.activate_all()

        # Assert
        for channel in device.channels:
            assert channel.is_active

    def test_deactivate_all_channels(self):
        """全チャンネルを無効化"""
        # Arrange
        device = HapticDevice(sample_rate=44100)
        device.activate_all()

        # Act
        device.deactivate_all()
        output = device.get_output_block(512)

        # Assert
        for channel in device.channels:
            assert not channel.is_active
        assert np.all(output == 0)  # 全チャンネル無音
