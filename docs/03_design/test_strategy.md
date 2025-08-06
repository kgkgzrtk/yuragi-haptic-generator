# テスト戦略設計書

## 1. 概要

本設計書では、ノコギリ波触覚デバイスシステムの品質保証のための包括的なテスト戦略を定義します。単体テスト、統合テスト、パフォーマンステスト、およびマッサージ機能の専用テストを含みます。

## 2. テストカテゴリ

### 2.1 テスト分類

1. **単体テスト (Unit Tests)**
   - 個々のコンポーネントの機能検証
   - エッジケースとエラー処理
   - カバレッジ目標: 80%以上

2. **統合テスト (Integration Tests)**
   - コンポーネント間の連携確認
   - API通信の検証
   - データフローの確認

3. **パフォーマンステスト (Performance Tests)**
   - レイテンシ測定
   - スループット評価
   - リソース使用率監視

4. **E2Eテスト (End-to-End Tests)**
   - ユーザーシナリオの検証
   - UI操作の自動テスト
   - システム全体の動作確認

## 3. 基本機能テスト

### 3.1 単体テスト

```python
# tests/unit/test_sawtooth_generator.py
import pytest
import numpy as np
from sawtooth_haptic.core import SawtoothGenerator

class TestSawtoothGenerator:
    def test_frequency_accuracy(self):
        """周波数精度テスト（±0.1%以内）"""
        generator = SawtoothGenerator(44100)
        
        for freq in [40, 60, 80, 100, 120]:
            waveform, _ = generator.generate(
                frames=44100,  # 1秒
                frequency=freq,
                amplitude=1.0,
                phase=0.0,
                polarity=True
            )
            
            # FFT解析
            fft = np.fft.rfft(waveform)
            freqs = np.fft.rfftfreq(len(waveform), 1/44100)
            peak_freq = freqs[np.argmax(np.abs(fft))]
            
            # 精度検証
            assert abs(peak_freq - freq) / freq < 0.001
            
    def test_anti_aliasing(self):
        """アンチエイリアシングテスト"""
        generator = SawtoothGenerator(44100)
        
        # 高周波数でのエイリアシング確認
        waveform, _ = generator.generate(
            frames=4410,
            frequency=120,
            amplitude=1.0,
            phase=0.0,
            polarity=True
        )
        
        # スペクトラム解析
        fft = np.fft.rfft(waveform)
        freqs = np.fft.rfftfreq(len(waveform), 1/44100)
        
        # ナイキスト周波数以上の成分が十分小さいこと
        nyquist_idx = len(freqs) // 2
        aliasing_power = np.sum(np.abs(fft[nyquist_idx:])**2)
        total_power = np.sum(np.abs(fft)**2)
        
        assert aliasing_power / total_power < 0.01  # 1%以下
```

### 3.2 統合テスト

```python
# tests/integration/test_vector_control.py
class TestVectorControl:
    def test_360_degree_sweep(self):
        """360度ベクトル制御テスト"""
        actuator = SawtoothActuator()
        
        for angle in range(0, 360, 15):
            actuator.set_vector_force(
                device=0,
                angle=angle,
                magnitude=0.8,
                frequency=10
            )
            
            # 1秒間動作確認
            actuator.start()
            time.sleep(1.0)
            actuator.stop()
            
            # ベクトル方向の検証
            # （実機でのセンサー測定が必要）
```

### 3.3 パフォーマンステスト

```python
# benchmarks/latency_test.py
import time
import numpy as np
from sawtooth_haptic import SawtoothActuator

def benchmark_callback_latency():
    """コールバックレイテンシ測定"""
    actuator = SawtoothActuator(buffer_size=256)
    
    latencies = []
    
    def timed_callback(frames):
        start = time.perf_counter_ns()
        output = actuator._process_audio(frames)
        end = time.perf_counter_ns()
        latencies.append((end - start) / 1e6)  # ms
        return output
    
    actuator.engine.set_process_callback(timed_callback)
    actuator.start()
    time.sleep(10)  # 10秒間測定
    actuator.stop()
    
    # 統計
    latencies_array = np.array(latencies[10:])  # 最初の数回を除外
    print(f"Average latency: {np.mean(latencies_array):.2f}ms")
    print(f"Max latency: {np.max(latencies_array):.2f}ms")
    print(f"99th percentile: {np.percentile(latencies_array, 99):.2f}ms")
    
    # 要件確認
    assert np.percentile(latencies_array, 99) < 10.0  # 99%が10ms以下
```

## 4. マッサージ機能テスト

### 4.1 変調器単体テスト

```python
# tests/unit/test_modulation.py
import pytest
import numpy as np
from yuragi_haptic_generator.haptic_system.modulation import (
    CircularMotionGenerator,
    AmplitudeModulator,
    DirectionalFluctuationGenerator,
    NoiseGenerator
)

class TestCircularMotionGenerator:
    def test_rotation_frequency(self):
        """回転周波数の精度テスト"""
        generator = CircularMotionGenerator(
            rotation_freq=0.5,  # 0.5Hz = 2秒/周
            fluctuation_amplitude=0.0,  # ゆらぎなし
            fm_depth=0.0  # FM変調なし
        )
        
        t = np.linspace(0, 10, 10000)  # 10秒間
        theta, omega = generator.modulate(t)
        
        # 5周期分の回転を確認
        expected_rotations = 5.0
        actual_rotations = (theta[-1] - theta[0]) / (2 * np.pi)
        
        assert abs(actual_rotations - expected_rotations) < 0.01
        
    def test_fluctuation_amplitude(self):
        """方位ゆらぎの振幅テスト"""
        generator = CircularMotionGenerator(
            rotation_freq=0.0,  # 回転なし
            fluctuation_amplitude=15.0,  # ±15度
            seed=42
        )
        
        t = np.linspace(0, 10, 10000)
        theta, _ = generator.modulate(t)
        
        # ゆらぎの範囲を確認
        fluctuation_deg = np.rad2deg(theta)
        assert -20 < fluctuation_deg.min() < -10
        assert 10 < fluctuation_deg.max() < 20

class TestAmplitudeModulator:
    def test_envelope_frequency(self):
        """エンベロープ周波数テスト"""
        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_freq=0.4,
            envelope_depth=0.25,
            noise_level=0.0  # ノイズなし
        )
        
        t = np.linspace(0, 10, 10000)
        amplitude = modulator.modulate(t)
        
        # FFT解析でエンベロープ周波数を確認
        fft = np.fft.rfft(amplitude - amplitude.mean())
        freqs = np.fft.rfftfreq(len(amplitude), t[1] - t[0])
        peak_idx = np.argmax(np.abs(fft[1:100])) + 1  # DC成分を除外
        peak_freq = freqs[peak_idx]
        
        assert abs(peak_freq - 0.4) < 0.01
        
    def test_amplitude_clipping(self):
        """振幅クリッピングテスト"""
        modulator = AmplitudeModulator(
            base_amplitude=1.0,
            envelope_depth=0.5,
            noise_level=0.3
        )
        
        t = np.linspace(0, 10, 10000)
        amplitude = modulator.modulate(t)
        
        # クリッピング範囲の確認
        assert amplitude.min() >= 0.2
        assert amplitude.max() <= 1.5

class TestNoiseGenerator:
    def test_pink_noise_spectrum(self):
        """1/fノイズのスペクトル特性テスト"""
        n = 10000
        pink = NoiseGenerator.pink_noise(n, alpha=1.0, seed=42)
        
        # スペクトル解析
        fft = np.fft.rfft(pink)
        freqs = np.fft.rfftfreq(n)
        power = np.abs(fft) ** 2
        
        # 低周波と高周波のパワー比を確認
        low_power = power[10:20].mean()
        high_power = power[100:110].mean()
        
        # 1/f特性：周波数が10倍になるとパワーが約1/10
        assert 8 < low_power / high_power < 12
```

### 4.2 マッサージコントローラー統合テスト

```python
# tests/integration/test_massage_controller.py
import pytest
import numpy as np
from yuragi_haptic_generator.haptic_system import MassageWaveformController

class TestMassageWaveformController:
    def test_preset_generation(self):
        """プリセット波形生成テスト"""
        controller = MassageWaveformController(
            sample_rate=20000,
            carrier_freq=30.0
        )
        
        presets = ["default", "gentle", "strong", "slow"]
        
        for preset in presets:
            result = controller.generate_massage_waveforms(
                duration=1.0,
                preset=preset
            )
            
            # 必要なキーが存在することを確認
            assert "voltage_x" in result
            assert "voltage_z" in result
            assert "accel_x" in result
            assert "accel_z" in result
            assert "theta" in result
            assert "amplitude" in result
            
            # データサイズの確認
            assert len(result["voltage_x"]) == 20000
            assert len(result["voltage_z"]) == 20000
            
    def test_circular_motion_trajectory(self):
        """円運動軌跡の検証"""
        controller = MassageWaveformController()
        
        result = controller.generate_massage_waveforms(
            duration=3.0,  # 1周期分
            preset="default",
            custom_params={
                "rotation_freq": 0.333,  # 3秒/周
                "fluctuation_deg": 0.0,  # ゆらぎなし
                "envelope_depth": 0.0    # 振幅変調なし
            }
        )
        
        # XZ平面での円軌跡を確認
        x = result["accel_x"]
        z = result["accel_z"]
        
        # 重心からの距離の標準偏差が小さいこと
        radius = np.sqrt(x**2 + z**2)
        radius_std = radius.std() / radius.mean()
        assert radius_std < 0.1  # 10%以内の変動
        
    def test_resonance_response(self):
        """機械共振応答テスト"""
        controller = MassageWaveformController(
            resonance_freq=180.0,
            damping_ratio=0.08
        )
        
        result = controller.generate_massage_waveforms(
            duration=0.1,
            preset="default"
        )
        
        # 共振による増幅を確認
        voltage_rms = np.sqrt(np.mean(result["voltage_x"]**2))
        accel_rms = np.sqrt(np.mean(result["accel_x"]**2))
        
        # Q値から期待される増幅率
        Q = 1 / (2 * 0.08)  # ≈ 6.25
        expected_gain = Q * (30.0 / 180.0)  # キャリア周波数での応答
        
        actual_gain = accel_rms / voltage_rms
        assert 0.5 * expected_gain < actual_gain < 2.0 * expected_gain
```

### 4.3 API統合テスト

```python
# tests/integration/test_massage_api.py
import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from backend.main import app

class TestMassageAPI:
    @pytest.mark.asyncio
    async def test_massage_mode_endpoint(self):
        """マッサージモードAPIテスト"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # マッサージモード有効化
            response = await client.post(
                "/api/massage/mode",
                json={
                    "enabled": True,
                    "preset": "gentle"
                }
            )
            assert response.status_code == 200
            assert response.json()["mode"] == "massage"
            
            # マッサージモード無効化
            response = await client.post(
                "/api/massage/mode",
                json={"enabled": False}
            )
            assert response.status_code == 200
            assert response.json()["mode"] == "basic"
            
    @pytest.mark.asyncio
    async def test_vector_rotation_update(self):
        """ベクトル回転パラメータ更新テスト"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.put(
                "/api/massage/vector-rotation",
                json={
                    "device_id": 1,
                    "rotation_freq": 0.4,
                    "fluctuation_amplitude": 12.0,
                    "enable_fm": True
                }
            )
            assert response.status_code == 200
            assert response.json()["status"] == "updated"
            
            # 無効なデバイスID
            response = await client.put(
                "/api/massage/vector-rotation",
                json={
                    "device_id": 3,  # 無効
                    "rotation_freq": 0.4
                }
            )
            assert response.status_code == 422
            
    @pytest.mark.asyncio
    async def test_presets_endpoint(self):
        """プリセット一覧取得テスト"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/massage/presets")
            assert response.status_code == 200
            
            presets = response.json()["presets"]
            assert len(presets) >= 4
            
            # 各プリセットの構造を確認
            for preset in presets:
                assert "name" in preset
                assert "description" in preset
                assert "params" in preset
                assert "rotation_freq" in preset["params"]
```

### 4.4 パフォーマンステスト（マッサージ機能）

```python
# tests/performance/test_massage_performance.py
import time
import numpy as np
from yuragi_haptic_generator.haptic_system import (
    MassageWaveformController,
    ForceGeneratorFactory
)

def test_massage_generation_performance():
    """マッサージ波形生成のパフォーマンステスト"""
    controller = MassageWaveformController(sample_rate=20000)
    
    durations = []
    for _ in range(100):
        start = time.perf_counter()
        result = controller.generate_massage_waveforms(
            duration=0.1,  # 100ms
            preset="default"
        )
        end = time.perf_counter()
        durations.append((end - start) * 1000)  # ms
    
    durations = np.array(durations[10:])  # ウォームアップを除外
    
    print(f"Average generation time: {np.mean(durations):.2f}ms")
    print(f"99th percentile: {np.percentile(durations, 99):.2f}ms")
    
    # 100msの波形を10ms以内で生成できること
    assert np.percentile(durations, 99) < 10.0
    
def test_realtime_switching_performance():
    """リアルタイム切り替えパフォーマンステスト"""
    basic_gen = ForceGeneratorFactory.create("basic")
    massage_gen = ForceGeneratorFactory.create("massage")
    
    switch_times = []
    
    for _ in range(50):
        # Basic → Massage
        start = time.perf_counter()
        massage_gen.set_parameters({"preset": "default"})
        end = time.perf_counter()
        switch_times.append((end - start) * 1000)
        
        # Massage → Basic
        start = time.perf_counter()
        basic_gen.set_parameters({"frequency": 60.0})
        end = time.perf_counter()
        switch_times.append((end - start) * 1000)
    
    switch_times = np.array(switch_times)
    
    # パラメータ切り替えが1ms以内
    assert np.max(switch_times) < 1.0
```

### 4.5 エンドツーエンドテスト

```python
# tests/e2e/test_massage_e2e.py
import pytest
import numpy as np
from playwright.sync_api import Page, expect

@pytest.mark.e2e
def test_massage_mode_ui_control(page: Page):
    """UIからのマッサージモード制御E2Eテスト"""
    page.goto("http://localhost:5173")
    
    # マッサージモードパネルを開く
    page.click("text=Massage Mode")
    
    # プリセット選択
    page.select_option("#preset-select", "gentle")
    
    # マッサージモード有効化
    page.click("#massage-enable-toggle")
    
    # 波形表示が更新されることを確認
    expect(page.locator("#waveform-display")).to_be_visible()
    
    # XY軌跡が円運動パターンを示すことを確認
    expect(page.locator("#xy-trajectory")).to_contain_text("Massage Pattern Active")
    
    # パラメータスライダーの操作
    rotation_slider = page.locator("#rotation-freq-slider")
    rotation_slider.fill("0.5")
    
    # リアルタイム更新の確認（デバウンス後）
    page.wait_for_timeout(500)
    expect(page.locator("#rotation-freq-display")).to_have_text("0.50 Hz")

@pytest.mark.e2e
def test_preset_switching(page: Page):
    """プリセット切り替えE2Eテスト"""
    page.goto("http://localhost:5173")
    
    presets = ["default", "gentle", "strong", "slow"]
    
    for preset in presets:
        # プリセット選択
        page.select_option("#preset-select", preset)
        page.click("#apply-preset")
        
        # 適用確認
        expect(page.locator("#current-preset")).to_have_text(preset)
        
        # 波形パターンが変化することを確認
        page.wait_for_timeout(1000)
        
        # スクリーンショット取得（視覚的確認用）
        page.screenshot(path=f"test-results/massage-{preset}.png")
```

## 5. テスト環境設定

### 5.1 pytest設定

```ini
# pytest.ini
[pytest]
minversion = 8.0
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# マーカー定義
markers =
    unit: Unit tests
    integration: Integration tests
    performance: Performance tests
    e2e: End-to-end tests
    slow: Slow running tests
    hardware: Tests requiring hardware

# テストカバレッジ設定
addopts = 
    -ra
    --strict-markers
    --cov=src/haptic_system
    --cov-report=html
    --cov-report=term-missing
    --cov-branch
```

### 5.2 テスト実行コマンド

```bash
# 全テスト実行
pytest

# カテゴリ別実行
pytest -m unit              # 単体テストのみ
pytest -m integration       # 統合テストのみ
pytest -m "not hardware"    # ハードウェア不要のテスト
pytest -m performance       # パフォーマンステスト

# カバレッジレポート生成
pytest --cov-report=html

# 並列実行（高速化）
pytest -n auto

# 詳細出力
pytest -vv --tb=short
```

## 6. CI/CD統合

### 6.1 GitHub Actions設定

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.11', '3.12']
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        pip install uv
        uv pip install -e ".[test]"
    
    - name: Run unit tests
      run: pytest -m unit --cov
    
    - name: Run integration tests
      run: pytest -m integration
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## 7. テスト品質指標

### 7.1 カバレッジ目標

- 全体カバレッジ: 80%以上
- コアモジュール: 90%以上
- API層: 85%以上
- UI統合: 70%以上

### 7.2 パフォーマンス基準

- 波形生成レイテンシ: < 10ms (99パーセンタイル)
- API応答時間: < 100ms (95パーセンタイル)
- メモリ使用量: < 500MB (ピーク時)
- CPU使用率: < 50% (平均)

## 8. テストのベストプラクティス

1. **AAA原則**: Arrange, Act, Assert
2. **テストの独立性**: 各テストは独立して実行可能
3. **明確な命名**: テスト名は何をテストしているか明確に
4. **適切なモック**: 外部依存は適切にモック化
5. **定期的な実行**: CIで自動実行、ローカルでも頻繁に実行