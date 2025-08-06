"""
HapticChannelクラスのユニットテスト
TDDサイクル2: 単一チャンネル管理
"""
import pytest
import numpy as np
from haptic_system.channel import HapticChannel


class TestHapticChannelBasics:
    """チャンネルの基本機能テスト"""

    def test_channel_starts_inactive(self):
        """チャンネルは非アクティブ状態で初期化される"""
        # Arrange & Act
        channel = HapticChannel(channel_id=0, sample_rate=44100)

        # Assert
        assert channel.is_active == False
        assert channel.current_frequency == 0
        assert channel.current_amplitude == 0

    def test_can_activate_channel_with_parameters(self):
        """パラメータを設定してチャンネルを有効化できる"""
        # Arrange
        channel = HapticChannel(channel_id=0, sample_rate=44100)

        # Act
        channel.set_parameters(frequency=60, amplitude=0.5, phase=0, polarity=True)
        channel.activate()

        # Assert
        assert channel.is_active == True
        assert channel.current_frequency == 60
        assert channel.current_amplitude == 0.5

    def test_generates_continuous_waveform_stream(self):
        """連続した波形ストリームを生成できる"""
        # Arrange
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.set_parameters(frequency=100, amplitude=1.0)
        channel.activate()

        # Act
        chunk1 = channel.get_next_chunk(block_size=512)
        chunk2 = channel.get_next_chunk(block_size=512)

        # Assert
        assert len(chunk1) == 512
        assert len(chunk2) == 512
        # 連続性の確認（最後と最初のサンプルが繋がる）
        # サwtooth波の特性を考慮して許容誤差を設定
        assert abs(chunk1[-1] - chunk2[0]) < 0.2  # 許容誤差を調整


class TestHapticChannelParameterUpdate:
    """リアルタイムパラメータ更新のテスト"""

    def test_smooth_frequency_transition(self):
        """周波数変更時にスムーズに遷移する"""
        # Arrange
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.set_parameters(frequency=60, amplitude=1.0)
        channel.activate()

        # Act
        chunk1 = channel.get_next_chunk(256)
        channel.set_parameters(frequency=80)  # 周波数変更
        chunk2 = channel.get_next_chunk(256)

        # Assert
        # クリックノイズがないことを確認
        transition = np.concatenate([chunk1[-10:], chunk2[:10]])
        diff = np.diff(transition)
        assert max(abs(diff)) < 0.5  # 急激な変化がない

    def test_can_deactivate_channel(self):
        """チャンネルを非アクティブ化できる"""
        # Arrange
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.set_parameters(frequency=60, amplitude=0.5)
        channel.activate()

        # Act
        channel.deactivate()
        chunk = channel.get_next_chunk(512)

        # Assert
        assert channel.is_active == False
        assert np.all(chunk == 0)  # 無音を出力

    def test_validates_channel_id(self):
        """チャンネルIDが有効範囲内であることを検証"""
        # Arrange & Act & Assert
        # 有効なチャンネルID (0-3)
        for valid_id in range(4):
            channel = HapticChannel(channel_id=valid_id, sample_rate=44100)
            assert channel.channel_id == valid_id

        # 無効なチャンネルID
        with pytest.raises(ValueError, match="Channel ID must be between 0-3"):
            HapticChannel(channel_id=4, sample_rate=44100)

        with pytest.raises(ValueError, match="Channel ID must be between 0-3"):
            HapticChannel(channel_id=-1, sample_rate=44100)


class TestHapticChannelWaveformGeneration:
    """波形生成機能のテスト"""

    def test_uses_sawtooth_waveform_generator(self):
        """SawtoothWaveformジェネレータを使用する"""
        # Arrange
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.set_parameters(frequency=100, amplitude=1.0, polarity=True)
        channel.activate()

        # Act
        chunk = channel.get_next_chunk(441)  # 1周期分

        # Assert
        # サwtooth波の特性を確認
        assert chunk[0] == pytest.approx(-1.0, abs=0.01)  # 開始値
        assert max(chunk) == pytest.approx(1.0, abs=0.01)  # 最大値
        assert min(chunk) == pytest.approx(-1.0, abs=0.01)  # 最小値

    def test_maintains_phase_continuity(self):
        """位相の連続性を維持する"""
        # Arrange
        channel = HapticChannel(channel_id=0, sample_rate=44100)
        channel.set_parameters(frequency=100, amplitude=1.0)
        channel.activate()

        # Act - 小さなチャンクを複数回取得
        chunks = []
        for _ in range(10):
            chunks.append(channel.get_next_chunk(100))

        # Assert - 結合した波形が連続していること
        combined = np.concatenate(chunks)
        # 隣接サンプル間の差分が一定範囲内
        diffs = np.diff(combined)
        assert np.std(diffs) < 0.1  # 差分の標準偏差が小さい
