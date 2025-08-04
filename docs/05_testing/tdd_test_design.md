# TDDテスト設計書

## 目次
- [1. 概要](#1-概要)
- [2. テスト戦略](#2-テスト戦略)
- [3. クラス設計](#3-クラス設計)
- [4. Unit Testケース設計](#4-unit-testケース設計)
- [5. Integration Testケース設計](#5-integration-testケース設計)
- [6. TDD実装手順](#6-tdd実装手順)
- [7. CI/CD統合](#7-cicd統合)
- [8. ベストプラクティス](#8-ベストプラクティス)

## 更新履歴
| 日付 | バージョン | 更新者 | 更新内容 |
|------|----------|--------|----------|
| 2024-08-04 | 1.0 | - | 初版作成 |

---

## 1. 概要

本書は、二軸振動触覚システムMVPのTDD（Test-Driven Development）によるテスト設計を定義します。
t_wadaスタイルのTDDアプローチに基づき、テストファーストで品質の高いコードを実装します。

## 2. テスト戦略

### 2.1 TDDアプローチ（t_wadaスタイル）
- **Red-Green-Refactor**: 失敗するテストを書く → 通るコードを書く → リファクタリング
- **Small Steps**: 最小単位の機能から実装
- **Test as Documentation**: テストコードが仕様書となる
- **FIRST原則**: Fast, Independent, Repeatable, Self-validating, Timely

### 2.2 テストピラミッド
```
        E2E Tests (5%)
      /              \
    Integration (20%)
   /                  \
  Unit Tests (75%)
```

### 2.3 テストフレームワーク
- **Python**: pytest + pytest-mock
- **カバレッジ**: pytest-cov (目標: 90%以上)
- **音声テスト**: numpy.testing

## 3. クラス設計

### 3.1 コアクラス構造
```python
# 新規設計（DualVibrationActuatorは参考のみ）
- SawtoothWaveform       # 波形生成
- HapticChannel         # 単一チャンネル管理  
- HapticDevice          # 4チャンネル統合
- HapticController      # API統合
- WaveformParameters    # パラメータ管理
```

## 4. Unit Testケース設計

### 4.1 SawtoothWaveform クラス

#### テストケース: test_sawtooth_waveform.py

```python
"""
SawtoothWaveformクラスのユニットテスト
TDDサイクル1: 基本的な波形生成
"""

class TestSawtoothWaveformGeneration:
    """サwtooth波生成の基本機能テスト"""
    
    def test_creates_ascending_sawtooth_at_100hz(self):
        """100Hzの上昇サwtooth波を生成できる"""
        # Arrange
        frequency = 100.0
        sample_rate = 44100
        duration = 0.01  # 10ms = 1周期
        
        # Act
        waveform = SawtoothWaveform(sample_rate)
        samples = waveform.generate(frequency, duration)
        
        # Assert
        assert len(samples) == 441  # 44100 * 0.01
        assert samples[0] == pytest.approx(-1.0, abs=0.01)
        assert samples[220] == pytest.approx(0.0, abs=0.01)
        assert samples[440] == pytest.approx(1.0, abs=0.01)
    
    def test_creates_descending_sawtooth_with_negative_polarity(self):
        """極性を反転させると下降サwtooth波を生成できる"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act
        ascending = waveform.generate(100, 0.01, polarity=True)
        descending = waveform.generate(100, 0.01, polarity=False)
        
        # Assert
        assert ascending[100] == pytest.approx(-descending[100])
    
    def test_applies_amplitude_scaling(self):
        """振幅スケーリングが正しく適用される"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act
        full_amp = waveform.generate(100, 0.01, amplitude=1.0)
        half_amp = waveform.generate(100, 0.01, amplitude=0.5)
        
        # Assert
        assert max(full_amp) == pytest.approx(1.0)
        assert max(half_amp) == pytest.approx(0.5)
    
    def test_phase_offset_shifts_waveform(self):
        """位相オフセットで波形がシフトする"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act
        no_phase = waveform.generate(100, 0.01, phase=0)
        quarter_phase = waveform.generate(100, 0.01, phase=90)
        
        # Assert
        # 90度位相 = 1/4周期シフト
        shift_samples = int(441 / 4)
        assert no_phase[0] == pytest.approx(quarter_phase[shift_samples], abs=0.05)

class TestSawtoothWaveformValidation:
    """パラメータ検証のテスト"""
    
    def test_rejects_frequency_below_40hz(self):
        """40Hz未満の周波数を拒否する"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Frequency must be between 40-120Hz"):
            waveform.generate(30, 0.01)
    
    def test_rejects_frequency_above_120hz(self):
        """120Hz超の周波数を拒否する"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Frequency must be between 40-120Hz"):
            waveform.generate(150, 0.01)
    
    def test_rejects_invalid_amplitude(self):
        """0-1範囲外の振幅を拒否する"""
        # Arrange
        waveform = SawtoothWaveform(sample_rate=44100)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Amplitude must be between 0-1"):
            waveform.generate(60, 0.01, amplitude=1.5)
```

### 4.2 HapticChannel クラス

#### テストケース: test_haptic_channel.py

```python
"""
HapticChannelクラスのユニットテスト
TDDサイクル2: 単一チャンネル管理
"""

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
        assert abs(chunk1[-1] - chunk2[0]) < 0.1

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
```

### 4.3 HapticDevice クラス

#### テストケース: test_haptic_device.py

```python
"""
HapticDeviceクラスのユニットテスト
TDDサイクル3: 4チャンネル統合管理
"""

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
            assert channel.is_active == False

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
        
        # Act
        output = device.get_output_block(block_size=512)
        
        # Assert
        assert output.shape == (512, 4)
        assert np.max(np.abs(output[:, 0])) == pytest.approx(1.0, abs=0.01)
        assert np.max(np.abs(output[:, 1])) == pytest.approx(0.8, abs=0.01)
    
    def test_xy_axis_coordination(self):
        """X/Y軸の協調動作（デバイス1: ch0,1、デバイス2: ch2,3）"""
        # Arrange
        device = HapticDevice(sample_rate=44100)
        
        # Act - 45度方向の力覚生成
        device.set_vector_force(
            device_id=1,  # デバイス1
            angle=45,     # 45度
            magnitude=1.0,
            frequency=60
        )
        
        # Assert
        output = device.get_output_block(512)
        # Ch0(X)とCh1(Y)が同じ振幅
        assert np.max(output[:, 0]) == pytest.approx(np.max(output[:, 1]))
        # Ch2,3は無音
        assert np.max(np.abs(output[:, 2])) == 0
        assert np.max(np.abs(output[:, 3])) == 0
```

### 4.4 HapticController クラス

#### テストケース: test_haptic_controller.py

```python
"""
HapticControllerクラスのユニットテスト
TDDサイクル4: API統合とストリーミング
"""

class TestHapticControllerBasics:
    """コントローラー基本機能のテスト"""
    
    def test_initializes_with_device(self):
        """デバイスと共に初期化される"""
        # Arrange & Act
        controller = HapticController(sample_rate=44100, block_size=512)
        
        # Assert
        assert controller.device is not None
        assert controller.is_streaming == False
    
    def test_can_start_and_stop_streaming(self):
        """ストリーミングの開始・停止ができる"""
        # Arrange
        controller = HapticController(sample_rate=44100)
        
        # Act & Assert
        controller.start_streaming()
        assert controller.is_streaming == True
        
        controller.stop_streaming()
        assert controller.is_streaming == False

class TestHapticControllerAPI:
    """API統合のテスト"""
    
    def test_updates_parameters_thread_safely(self):
        """スレッドセーフにパラメータ更新できる"""
        # Arrange
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
    
    def test_measures_latency(self):
        """レイテンシを測定できる"""
        # Arrange
        controller = HapticController()
        
        # Act
        controller.start_streaming()
        time.sleep(0.1)
        latency = controller.get_latency_ms()
        
        # Assert
        assert latency < 10  # 10ms以下
```

### 4.5 WaveformParameters クラス

#### テストケース: test_waveform_parameters.py

```python
"""
WaveformParametersクラスのユニットテスト
TDDサイクル5: パラメータ管理と検証
"""

class TestWaveformParameterValidation:
    """パラメータ検証のテスト"""
    
    def test_validates_frequency_range(self):
        """周波数範囲を検証する"""
        # Arrange
        params = WaveformParameters()
        
        # Act & Assert
        assert params.validate_frequency(60) == True
        assert params.validate_frequency(39) == False
        assert params.validate_frequency(121) == False
    
    def test_validates_complete_channel_config(self):
        """完全なチャンネル設定を検証する"""
        # Arrange
        params = WaveformParameters()
        
        # Act
        valid_config = {
            "channel_id": 0,
            "frequency": 60,
            "amplitude": 0.5,
            "phase": 45,
            "polarity": True
        }
        
        invalid_config = {
            "channel_id": 0,
            "frequency": 200,  # 範囲外
            "amplitude": 0.5
        }
        
        # Assert
        assert params.validate_channel_config(valid_config) == True
        assert params.validate_channel_config(invalid_config) == False
```

## 5. Integration Testケース設計

### 5.1 音声出力統合テスト

```python
"""
test_audio_integration.py
音声出力システムの統合テスト
"""

class TestAudioOutputIntegration:
    """実際の音声出力統合テスト"""
    
    @pytest.mark.integration
    def test_produces_audible_output(self, mock_sounddevice):
        """音声デバイスに出力できる"""
        # Arrange
        controller = HapticController()
        controller.set_channel_parameters(0, frequency=60, amplitude=0.5)
        
        # Act
        controller.start_streaming()
        time.sleep(0.5)
        controller.stop_streaming()
        
        # Assert
        assert mock_sounddevice.OutputStream.called
        assert mock_sounddevice.OutputStream.call_args[1]['channels'] == 4
```

### 5.2 パフォーマンステスト

```python
"""
test_performance.py
パフォーマンステスト
"""

class TestPerformanceRequirements:
    """性能要件のテスト"""
    
    @pytest.mark.performance
    def test_latency_under_10ms(self):
        """レイテンシが10ms以下"""
        # Arrange
        controller = HapticController(sample_rate=44100, block_size=256)
        
        # Act
        controller.start_streaming()
        latencies = []
        for _ in range(100):
            latencies.append(controller.get_latency_ms())
            time.sleep(0.01)
        
        # Assert
        avg_latency = np.mean(latencies)
        max_latency = np.max(latencies)
        assert avg_latency < 8  # 平均8ms以下
        assert max_latency < 10  # 最大10ms以下
    
    @pytest.mark.performance  
    def test_cpu_usage_under_threshold(self):
        """CPU使用率が閾値以下"""
        # テスト実装...
```

## 6. TDD実装手順

### 6.1 Red-Green-Refactorサイクル

1. **Cycle 1: SawtoothWaveform**
   ```
   Red: test_creates_ascending_sawtooth_at_100hz 失敗
   Green: 最小限の実装で通す
   Refactor: コードの整理
   ```

2. **Cycle 2: HapticChannel**
   ```
   Red: test_channel_starts_inactive 失敗
   Green: 初期化メソッド実装
   Refactor: 状態管理の改善
   ```

3. **Cycle 3: HapticDevice**
   ```
   Red: test_creates_four_channels 失敗
   Green: チャンネル管理実装
   Refactor: 配列→辞書への変更検討
   ```

### 6.2 テスト実行コマンド

```bash
# 単体テストのみ
pytest tests/unit -v

# カバレッジレポート付き
pytest tests/unit --cov=haptic_system --cov-report=html

# 特定のテストのみ
pytest tests/unit/test_sawtooth_waveform.py::TestSawtoothWaveformGeneration::test_creates_ascending_sawtooth_at_100hz -v

# 統合テストを含む全テスト
pytest tests/ -v -m "not performance"

# パフォーマンステスト
pytest tests/ -v -m "performance"
```

## 7. CI/CD統合

### 7.1 GitHub Actions設定

```yaml
name: TDD Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: 3.9
    - name: Install dependencies
      run: |
        pip install -r requirements-test.txt
    - name: Run tests with coverage
      run: |
        pytest tests/unit --cov=haptic_system --cov-fail-under=90
```

## 8. ベストプラクティス

### 8.1 AAA (Arrange-Act-Assert) パターン
すべてのテストでAAA構造を維持

### 8.2 テスト名の規則
`test_[何を]_[どんな条件で]_[どうなる]`

### 8.3 モックの使用
- 外部依存（sounddevice）はモック化
- 内部ロジックは実装をテスト

### 8.4 テストの独立性
各テストは他のテストに依存しない

## 9. 次のステップ

1. **環境構築**: pytest, pytest-mock, pytest-covのインストール
2. **最初のテスト作成**: `test_sawtooth_waveform.py`の最初のテストケース
3. **Red確認**: テストが失敗することを確認
4. **最小実装**: テストを通す最小限のコード
5. **リファクタリング**: コードの改善