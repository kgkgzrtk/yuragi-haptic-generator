# 高度な触覚フィードバック機能（ゆらぎ付き円運動系）設計書

## 1. 概要

本設計書では、基本的なノコギリ波生成に加えて、より自然で心地よい触覚フィードバックを実現する「ゆらぎ付き円運動系の力覚ベクトル」機能について詳細に定義します。この機能により、マッサージのような自然な振動パターンを生成できます。

## 2. 数学的モデル

### 2.1 円運動する力覚ベクトル

力覚ベクトルの方位角θ(t)は、低周波で回転しながらゆらぎを持ちます：

```
θ(t) = 2πf_rot·t + Δθ·n_θ(t) + Σα_k·sin(2πf_k·t + φ_k)

ここで：
- f_rot: 回転周波数 (0.2-0.6 Hz、1周 2-5秒)
- n_θ(t): ローパスフィルタされた白色ノイズ（1/f風ゆらぎ）
- Δθ: 方位ゆらぎの振幅 (±5-15°)
- α_k, f_k, φ_k: 追加の周期的変調成分
```

### 2.2 強度変調（マッサージ効果）

振幅A(t)は「揉み」のようなゆらぎで変化します：

```
A(t) = A_0[1 + m·sin(2πf_env·t) + Δ_A·n_A(t)]

ここで：
- A_0: 基準振幅
- m: エンベロープ深さ (0.2-0.3)
- f_env: エンベロープ周波数 (0.2-1.0 Hz)
- Δ_A: 振幅ゆらぎ係数 (0.1-0.15)
- n_A(t): ローパスフィルタされた白色ノイズ
```

### 2.3 電圧制御信号

各チャンネルの電圧信号は、同一のキャリア波形s(t)に方向成分を乗じて生成：

```
V_x(t) = A(t)·cos(θ(t))·s(t)
V_z(t) = -A(t)·sin(θ(t))·s(t)

ここで：
- s(t): キャリアとなるノコギリ波 (30 Hz)
```

### 2.4 機械共振応答

アクチュエータの機械共振（約180Hz、ζ≈0.08）を考慮した加速度応答：

```
A_x(t) = G(s) * V_x(t)
A_z(t) = G(s) * V_z(t)

ここで：
G(s) = ω_n²/(s² + 2ζω_n·s + ω_n²)
```

## 3. モジュール設計

### 3.1 Modulation Module (backend/haptic_system/modulation.py)

```python
import numpy as np
from typing import Optional, Tuple
from abc import ABC, abstractmethod

class ModulatorBase(ABC):
    """変調器の基底クラス"""
    
    @abstractmethod
    def modulate(self, t: np.ndarray) -> np.ndarray:
        """時間配列に対して変調を適用"""
        pass

class CircularMotionGenerator(ModulatorBase):
    """円運動生成器 - ゆっくり回転する力覚ベクトル"""
    
    def __init__(
        self,
        rotation_freq: float = 0.33,  # Hz (約3秒/周)
        fluctuation_amplitude: float = 10.0,  # 度
        fluctuation_bandwidth: float = 0.5,  # Hz
        fm_depth: float = 0.05,  # 角速度のFM変調深さ
        seed: Optional[int] = None
    ):
        self.f_rot = rotation_freq
        self.delta_theta = np.deg2rad(fluctuation_amplitude)
        self.f_theta_noise = fluctuation_bandwidth
        self.fm_depth = fm_depth
        self.rng = np.random.RandomState(seed)
        
    def modulate(self, t: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        時間配列に対して円運動の角度を生成
        
        Returns:
            (theta, omega): 角度と瞬時角速度のタプル
        """
        # 方位ゆらぎ（1/f風）
        n_theta = self._generate_1f_noise(len(t), self.f_theta_noise)
        d_theta = self.delta_theta * n_theta
        
        # 角速度のFM変調
        fm_noise = self._generate_1f_noise(len(t), 0.2)
        omega_inst = 2 * np.pi * self.f_rot * (1 + self.fm_depth * fm_noise)
        
        # 角度の積分計算
        dt = t[1] - t[0] if len(t) > 1 else 1.0
        theta = np.cumsum(omega_inst) * dt + d_theta
        
        return theta, omega_inst
    
    def _generate_1f_noise(self, n: int, f_c: float) -> np.ndarray:
        """1/f風ノイズ生成（一次ローパスフィルタ）"""
        white = self.rng.randn(n)
        # Simple exponential smoothing for 1/f-like noise
        alpha = 1 - np.exp(-2 * np.pi * f_c / n)
        filtered = np.zeros(n)
        filtered[0] = white[0]
        for i in range(1, n):
            filtered[i] = alpha * white[i] + (1 - alpha) * filtered[i-1]
        # Normalize
        filtered -= filtered.mean()
        std = filtered.std()
        if std > 0:
            filtered /= std
        return filtered

class AmplitudeModulator(ModulatorBase):
    """振幅変調器 - マッサージ風の強度変化"""
    
    def __init__(
        self,
        base_amplitude: float = 1.0,
        envelope_freq: float = 0.4,  # Hz
        envelope_depth: float = 0.25,
        noise_level: float = 0.1,
        noise_bandwidth: float = 0.7,  # Hz
        seed: Optional[int] = None
    ):
        self.A_0 = base_amplitude
        self.f_env = envelope_freq
        self.m = envelope_depth
        self.delta_A = noise_level
        self.f_A_noise = noise_bandwidth
        self.rng = np.random.RandomState(seed)
        
    def modulate(self, t: np.ndarray) -> np.ndarray:
        """時間配列に対して振幅変調を適用"""
        # 周期的エンベロープ
        envelope = self.m * np.sin(2 * np.pi * self.f_env * t + 2 * np.pi * 0.13)
        
        # 振幅ゆらぎ
        n_A = self._generate_1f_noise(len(t), self.f_A_noise)
        noise = self.delta_A * n_A
        
        # 合成振幅（クリップで過大防止）
        A = self.A_0 * (1.0 + envelope + noise)
        A = np.clip(A, 0.2 * self.A_0, 1.5 * self.A_0)
        
        return A
    
    def _generate_1f_noise(self, n: int, f_c: float) -> np.ndarray:
        """1/f風ノイズ生成"""
        white = self.rng.randn(n)
        alpha = 1 - np.exp(-2 * np.pi * f_c / n)
        filtered = np.zeros(n)
        filtered[0] = white[0]
        for i in range(1, n):
            filtered[i] = alpha * white[i] + (1 - alpha) * filtered[i-1]
        filtered -= filtered.mean()
        std = filtered.std()
        if std > 0:
            filtered /= std
        return filtered

class DirectionalFluctuationGenerator(ModulatorBase):
    """方向ゆらぎ生成器 - 複数の周期成分を持つ方向変調"""
    
    def __init__(
        self,
        fluctuation_components: list[dict] = None
    ):
        """
        Args:
            fluctuation_components: [{"freq": Hz, "amp": deg, "phase": rad}, ...]
        """
        if fluctuation_components is None:
            # デフォルト: 0.3Hz, 0.5Hz, 0.8Hzの成分
            self.components = [
                {"freq": 0.3, "amp": 5.0, "phase": 0.0},
                {"freq": 0.5, "amp": 3.0, "phase": np.pi/3},
                {"freq": 0.8, "amp": 2.0, "phase": 2*np.pi/3}
            ]
        else:
            self.components = fluctuation_components
            
    def modulate(self, t: np.ndarray) -> np.ndarray:
        """複数の正弦波成分による方向ゆらぎ"""
        fluctuation = np.zeros_like(t)
        for comp in self.components:
            fluctuation += np.deg2rad(comp["amp"]) * np.sin(
                2 * np.pi * comp["freq"] * t + comp["phase"]
            )
        return fluctuation

class NoiseGenerator:
    """各種ノイズ生成器"""
    
    @staticmethod
    def pink_noise(n: int, alpha: float = 1.0, seed: Optional[int] = None) -> np.ndarray:
        """
        1/f^alpha ノイズ生成
        
        Args:
            n: サンプル数
            alpha: スペクトル傾斜 (1.0 = ピンクノイズ)
            seed: 乱数シード
        """
        rng = np.random.RandomState(seed)
        white = rng.randn(n)
        
        # FFTによる1/fフィルタリング
        fft = np.fft.rfft(white)
        freqs = np.fft.rfftfreq(n)
        
        # DC成分を除いて1/f^alphaフィルタ適用
        fft[1:] = fft[1:] / (freqs[1:] ** (alpha / 2))
        
        # 逆FFT
        pink = np.fft.irfft(fft, n)
        
        # 正規化
        pink -= pink.mean()
        std = pink.std()
        if std > 0:
            pink /= std
            
        return pink
```

### 3.2 Massage Controller (backend/haptic_system/massage_controller.py)

```python
import numpy as np
from typing import Dict, Optional, Tuple
from .modulation import (
    CircularMotionGenerator,
    AmplitudeModulator,
    DirectionalFluctuationGenerator
)
from .waveform import SawtoothWaveform, resonator

class MassageWaveformController:
    """マッサージ風波形制御クラス"""
    
    def __init__(
        self,
        sample_rate: int = 20000,
        carrier_freq: float = 30.0,  # キャリア周波数
        resonance_freq: float = 180.0,  # 機械共振周波数
        damping_ratio: float = 0.08  # 減衰比
    ):
        self.fs = sample_rate
        self.f_carrier = carrier_freq
        self.f_res = resonance_freq
        self.zeta = damping_ratio
        
        # コンポーネント初期化
        self.sawtooth = SawtoothWaveform(sample_rate)
        self.circular_motion = CircularMotionGenerator()
        self.amplitude_mod = AmplitudeModulator()
        self.direction_fluct = DirectionalFluctuationGenerator()
        
    def generate_massage_waveforms(
        self,
        duration: float,
        preset: str = "default",
        custom_params: Optional[Dict] = None
    ) -> Dict[str, np.ndarray]:
        """
        マッサージ波形を生成
        
        Args:
            duration: 生成時間（秒）
            preset: プリセット名 ("default", "gentle", "strong", "slow")
            custom_params: カスタムパラメータ（オプション）
            
        Returns:
            {
                "voltage_x": X軸電圧信号,
                "voltage_z": Z軸電圧信号,
                "accel_x": X軸加速度応答,
                "accel_z": Z軸加速度応答,
                "theta": 力覚ベクトル角度,
                "amplitude": 力覚ベクトル振幅
            }
        """
        # プリセット適用
        params = self._get_preset_params(preset)
        if custom_params:
            params.update(custom_params)
            
        # 時間配列
        t = np.arange(0, duration, 1/self.fs)
        
        # キャリア生成（共通）
        carrier = self.sawtooth.generate(
            self.f_carrier,
            duration,
            amplitude=1.0,
            phase=0.0,
            polarity=True
        )
        
        # 円運動生成
        self.circular_motion.f_rot = params.get("rotation_freq", 0.33)
        self.circular_motion.delta_theta = np.deg2rad(params.get("fluctuation_deg", 10.0))
        theta, _ = self.circular_motion.modulate(t)
        
        # 方向ゆらぎ追加
        theta += self.direction_fluct.modulate(t)
        
        # 振幅変調
        self.amplitude_mod.A_0 = params.get("base_amplitude", 1.0)
        self.amplitude_mod.m = params.get("envelope_depth", 0.25)
        amplitude = self.amplitude_mod.modulate(t)
        
        # 電圧信号生成（同一キャリアで比率制御）
        V_x = amplitude * np.cos(theta) * carrier
        V_z = -amplitude * np.sin(theta) * carrier
        
        # 機械共振応答（電流=電圧としてR=1Ω想定）
        A_x = resonator(V_x, self.fs, self.f_res, self.zeta)
        A_z = resonator(V_z, self.fs, self.f_res, self.zeta)
        
        return {
            "voltage_x": V_x,
            "voltage_z": V_z,
            "accel_x": A_x,
            "accel_z": A_z,
            "theta": theta,
            "amplitude": amplitude
        }
    
    def _get_preset_params(self, preset: str) -> Dict:
        """プリセットパラメータを取得"""
        presets = {
            "default": {
                "rotation_freq": 0.33,  # 3秒/周
                "fluctuation_deg": 10.0,
                "base_amplitude": 1.0,
                "envelope_depth": 0.25,
                "envelope_freq": 0.4
            },
            "gentle": {
                "rotation_freq": 0.2,  # 5秒/周
                "fluctuation_deg": 5.0,
                "base_amplitude": 0.7,
                "envelope_depth": 0.15,
                "envelope_freq": 0.3
            },
            "strong": {
                "rotation_freq": 0.5,  # 2秒/周
                "fluctuation_deg": 15.0,
                "base_amplitude": 1.2,
                "envelope_depth": 0.35,
                "envelope_freq": 0.6
            },
            "slow": {
                "rotation_freq": 0.15,  # 6.7秒/周
                "fluctuation_deg": 8.0,
                "base_amplitude": 0.9,
                "envelope_depth": 0.2,
                "envelope_freq": 0.25
            }
        }
        return presets.get(preset, presets["default"]).copy()
    
    def create_multi_device_massage(
        self,
        duration: float,
        device1_preset: str = "default",
        device2_preset: str = "default",
        phase_offset: float = 90.0  # 度
    ) -> Dict[str, np.ndarray]:
        """
        2デバイス連携マッサージパターン生成
        
        Args:
            duration: 生成時間（秒）
            device1_preset: デバイス1のプリセット
            device2_preset: デバイス2のプリセット
            phase_offset: デバイス間の位相差（度）
            
        Returns:
            4チャンネル分の波形データ
        """
        # デバイス1
        dev1 = self.generate_massage_waveforms(duration, device1_preset)
        
        # デバイス2（位相オフセット付き）
        params2 = self._get_preset_params(device2_preset)
        params2["phase_offset"] = np.deg2rad(phase_offset)
        dev2 = self.generate_massage_waveforms(duration, device2_preset, params2)
        
        return {
            "channel_0": dev1["voltage_x"],  # Device1 X
            "channel_1": dev1["voltage_z"],  # Device1 Z
            "channel_2": dev2["voltage_x"],  # Device2 X
            "channel_3": dev2["voltage_z"],  # Device2 Z
            "trajectory_1": np.column_stack((dev1["accel_x"], dev1["accel_z"])),
            "trajectory_2": np.column_stack((dev2["accel_x"], dev2["accel_z"]))
        }
```

### 3.3 Force Generator Interface (backend/haptic_system/force_generator.py)

```python
from abc import ABC, abstractmethod
import numpy as np
from typing import Dict, Any, Optional

class ForceGeneratorInterface(ABC):
    """力覚生成器のインターフェース"""
    
    @abstractmethod
    def generate(self, duration: float, params: Dict[str, Any]) -> np.ndarray:
        """波形を生成"""
        pass
    
    @abstractmethod
    def get_parameters(self) -> Dict[str, Any]:
        """現在のパラメータを取得"""
        pass
    
    @abstractmethod
    def set_parameters(self, params: Dict[str, Any]) -> None:
        """パラメータを設定"""
        pass

class BasicSawtoothGenerator(ForceGeneratorInterface):
    """基本的なノコギリ波生成器（後方互換性用）"""
    
    def __init__(self, sample_rate: int = 44100):
        from .waveform import SawtoothWaveform
        self.waveform_gen = SawtoothWaveform(sample_rate)
        self.params = {
            "frequency": 60.0,
            "amplitude": 1.0,
            "phase": 0.0,
            "polarity": True
        }
        
    def generate(self, duration: float, params: Optional[Dict[str, Any]] = None) -> np.ndarray:
        """基本的なノコギリ波を生成"""
        if params:
            self.set_parameters(params)
            
        return self.waveform_gen.generate(
            frequency=self.params["frequency"],
            duration=duration,
            amplitude=self.params["amplitude"],
            phase=self.params["phase"],
            polarity=self.params["polarity"]
        )
    
    def get_parameters(self) -> Dict[str, Any]:
        return self.params.copy()
    
    def set_parameters(self, params: Dict[str, Any]) -> None:
        self.params.update(params)

class AdvancedMassageGenerator(ForceGeneratorInterface):
    """高度なマッサージ波形生成器"""
    
    def __init__(self, sample_rate: int = 20000):
        from .massage_controller import MassageWaveformController
        self.controller = MassageWaveformController(sample_rate)
        self.params = {
            "preset": "default",
            "rotation_freq": 0.33,
            "fluctuation_deg": 10.0,
            "base_amplitude": 1.0,
            "envelope_depth": 0.25
        }
        
    def generate(self, duration: float, params: Optional[Dict[str, Any]] = None) -> np.ndarray:
        """マッサージ波形を生成（4チャンネル）"""
        if params:
            self.set_parameters(params)
            
        result = self.controller.generate_massage_waveforms(
            duration=duration,
            preset=self.params["preset"],
            custom_params=self.params
        )
        
        # 4チャンネル形式で返す
        return np.column_stack([
            result["voltage_x"],
            result["voltage_z"],
            np.zeros_like(result["voltage_x"]),  # Ch3 (未使用)
            np.zeros_like(result["voltage_x"])   # Ch4 (未使用)
        ])
    
    def get_parameters(self) -> Dict[str, Any]:
        return self.params.copy()
    
    def set_parameters(self, params: Dict[str, Any]) -> None:
        self.params.update(params)

class ForceGeneratorFactory:
    """力覚生成器のファクトリークラス"""
    
    @staticmethod
    def create(
        generator_type: str = "basic",
        sample_rate: int = 44100
    ) -> ForceGeneratorInterface:
        """
        指定されたタイプの生成器を作成
        
        Args:
            generator_type: "basic" or "massage"
            sample_rate: サンプリングレート
            
        Returns:
            ForceGeneratorInterface実装
        """
        generators = {
            "basic": BasicSawtoothGenerator,
            "massage": AdvancedMassageGenerator
        }
        
        if generator_type not in generators:
            raise ValueError(f"Unknown generator type: {generator_type}")
            
        return generators[generator_type](sample_rate)
```

## 4. API設計

### 4.1 新規APIエンドポイント

```python
# backend/api/massage_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

router = APIRouter(prefix="/api/massage", tags=["massage"])

class MassageModeRequest(BaseModel):
    """マッサージモード設定リクエスト"""
    enabled: bool = Field(..., description="マッサージモードの有効/無効")
    preset: str = Field("default", description="プリセット名")
    custom_params: Optional[Dict[str, Any]] = Field(None, description="カスタムパラメータ")

class VectorRotationRequest(BaseModel):
    """ベクトル回転パラメータ"""
    device_id: int = Field(..., ge=1, le=2, description="デバイスID")
    rotation_freq: float = Field(0.33, ge=0.1, le=1.0, description="回転周波数 (Hz)")
    fluctuation_amplitude: float = Field(10.0, ge=0, le=30, description="方位ゆらぎ振幅 (度)")
    enable_fm: bool = Field(True, description="FM変調の有効/無効")

class ModulationParametersResponse(BaseModel):
    """変調パラメータレスポンス"""
    rotation: Dict[str, float]
    amplitude: Dict[str, float]
    fluctuation: Dict[str, Any]

@router.post("/mode")
async def set_massage_mode(request: MassageModeRequest):
    """マッサージモードの設定"""
    try:
        if request.enabled:
            # マッサージモードに切り替え
            controller.switch_to_massage_mode(
                preset=request.preset,
                custom_params=request.custom_params
            )
        else:
            # 基本モードに戻す
            controller.switch_to_basic_mode()
            
        return {"status": "success", "mode": "massage" if request.enabled else "basic"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/vector-rotation")
async def update_vector_rotation(request: VectorRotationRequest):
    """ベクトル回転パラメータの更新"""
    try:
        controller.update_rotation_params(
            device_id=request.device_id,
            rotation_freq=request.rotation_freq,
            fluctuation_amplitude=request.fluctuation_amplitude,
            enable_fm=request.enable_fm
        )
        return {"status": "updated", "device_id": request.device_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/modulation-parameters")
async def get_modulation_parameters() -> ModulationParametersResponse:
    """現在の変調パラメータを取得"""
    params = controller.get_modulation_parameters()
    return ModulationParametersResponse(**params)

@router.get("/presets")
async def get_available_presets():
    """利用可能なプリセット一覧"""
    return {
        "presets": [
            {
                "name": "default",
                "description": "標準的なマッサージパターン",
                "params": {
                    "rotation_freq": 0.33,
                    "fluctuation_deg": 10.0,
                    "envelope_depth": 0.25
                }
            },
            {
                "name": "gentle",
                "description": "優しいマッサージ",
                "params": {
                    "rotation_freq": 0.2,
                    "fluctuation_deg": 5.0,
                    "envelope_depth": 0.15
                }
            },
            {
                "name": "strong",
                "description": "強めのマッサージ",
                "params": {
                    "rotation_freq": 0.5,
                    "fluctuation_deg": 15.0,
                    "envelope_depth": 0.35
                }
            },
            {
                "name": "slow",
                "description": "ゆっくりとしたマッサージ",
                "params": {
                    "rotation_freq": 0.15,
                    "fluctuation_deg": 8.0,
                    "envelope_depth": 0.2
                }
            }
        ]
    }
```

## 5. 実装例

### 5.1 基本的なマッサージパターン生成

```python
# examples/basic_massage.py
from yuragi_haptic_generator.haptic_system import MassageWaveformController
import numpy as np
import matplotlib.pyplot as plt

# コントローラー初期化
controller = MassageWaveformController(
    sample_rate=20000,
    carrier_freq=30.0,
    resonance_freq=180.0,
    damping_ratio=0.08
)

# 10秒間のマッサージ波形生成
result = controller.generate_massage_waveforms(
    duration=10.0,
    preset="default"
)

# 最初の1秒を可視化
t = np.arange(0, 1.0, 1/20000)
plt.figure(figsize=(12, 8))

# 電圧信号
plt.subplot(3, 1, 1)
plt.plot(t[:20000], result["voltage_x"][:20000], 'b-', label='V_x', alpha=0.7)
plt.plot(t[:20000], result["voltage_z"][:20000], 'r-', label='V_z', alpha=0.7)
plt.ylabel('Voltage [V]')
plt.legend()
plt.grid(True)

# 加速度応答
plt.subplot(3, 1, 2)
plt.plot(t[:20000], result["accel_x"][:20000], 'b-', label='A_x', alpha=0.7)
plt.plot(t[:20000], result["accel_z"][:20000], 'r-', label='A_z', alpha=0.7)
plt.ylabel('Acceleration')
plt.legend()
plt.grid(True)

# XZ平面軌跡
plt.subplot(3, 1, 3)
plt.plot(result["accel_x"][:20000], result["accel_z"][:20000], 'g-', linewidth=0.5)
plt.xlabel('X Acceleration')
plt.ylabel('Z Acceleration')
plt.axis('equal')
plt.grid(True)

plt.tight_layout()
plt.show()
```

### 5.2 リアルタイムパラメータ更新

```python
# examples/realtime_massage_control.py
import asyncio
import aiohttp
import numpy as np

async def control_massage_pattern():
    """リアルタイムでマッサージパターンを制御"""
    
    async with aiohttp.ClientSession() as session:
        # マッサージモードを有効化
        async with session.post(
            'http://localhost:8000/api/massage/mode',
            json={"enabled": True, "preset": "gentle"}
        ) as resp:
            print(f"Mode set: {await resp.json()}")
        
        # 回転速度を徐々に変更
        for i in range(10):
            rotation_freq = 0.2 + i * 0.05  # 0.2 → 0.65 Hz
            
            async with session.put(
                'http://localhost:8000/api/massage/vector-rotation',
                json={
                    "device_id": 1,
                    "rotation_freq": rotation_freq,
                    "fluctuation_amplitude": 10.0,
                    "enable_fm": True
                }
            ) as resp:
                print(f"Updated rotation: {rotation_freq:.2f} Hz")
            
            await asyncio.sleep(2.0)  # 2秒待機
        
        # デフォルトに戻す
        async with session.post(
            'http://localhost:8000/api/massage/mode',
            json={"enabled": True, "preset": "default"}
        ) as resp:
            print("Reset to default pattern")

# 実行
asyncio.run(control_massage_pattern())
```

### 5.3 カスタムパターンの作成

```python
# examples/custom_massage_pattern.py
from yuragi_haptic_generator.haptic_system import (
    MassageWaveformController,
    DirectionalFluctuationGenerator
)

# カスタム方向ゆらぎパターン
custom_fluctuation = DirectionalFluctuationGenerator(
    fluctuation_components=[
        {"freq": 0.2, "amp": 8.0, "phase": 0},
        {"freq": 0.4, "amp": 5.0, "phase": np.pi/4},
        {"freq": 0.7, "amp": 3.0, "phase": np.pi/2},
        {"freq": 1.0, "amp": 2.0, "phase": 3*np.pi/4}
    ]
)

# コントローラーにカスタムゆらぎを設定
controller = MassageWaveformController()
controller.direction_fluct = custom_fluctuation

# カスタムパラメータで生成
custom_params = {
    "rotation_freq": 0.25,      # ゆっくり回転
    "fluctuation_deg": 12.0,    # 中程度のゆらぎ
    "base_amplitude": 0.9,      # やや弱め
    "envelope_depth": 0.3,      # 深めの振幅変調
    "envelope_freq": 0.35       # ゆっくりとした揉み
}

result = controller.generate_massage_waveforms(
    duration=30.0,
    preset="default",
    custom_params=custom_params
)

print("カスタムマッサージパターンを生成しました")
print(f"生成時間: 30秒")
print(f"データポイント数: {len(result['voltage_x'])}")
```

## 6. 統合と移行戦略

### 6.1 既存システムとの統合

既存の`HapticDevice`クラスを拡張して、新機能をシームレスに統合：

```python
# backend/haptic_system/device.py への追加
class HapticDevice:
    # ... 既存のコード ...
    
    def __init__(self, sample_rate: int = 44100):
        # ... 既存の初期化 ...
        
        # 新機能用の生成器
        from .force_generator import ForceGeneratorFactory
        self.force_generator = ForceGeneratorFactory.create("basic", sample_rate)
        self.massage_mode = False
        
    def set_massage_mode(
        self,
        enabled: bool,
        preset: str = "default",
        device_id: Optional[int] = None
    ) -> None:
        """
        マッサージモードの設定
        
        Args:
            enabled: 有効/無効
            preset: プリセット名
            device_id: 特定デバイスのみ適用する場合のID
        """
        self.massage_mode = enabled
        
        if enabled:
            # マッサージ生成器に切り替え
            from .force_generator import ForceGeneratorFactory
            self.force_generator = ForceGeneratorFactory.create("massage", self.sample_rate)
            self.force_generator.set_parameters({"preset": preset})
        else:
            # 基本生成器に戻す
            from .force_generator import ForceGeneratorFactory
            self.force_generator = ForceGeneratorFactory.create("basic", self.sample_rate)
            
    def get_output_block(self, block_size: int) -> np.ndarray:
        """
        4チャンネル出力ブロックを取得（拡張版）
        """
        if self.massage_mode:
            # マッサージモードの場合
            duration = block_size / self.sample_rate
            waveforms = self.force_generator.generate(duration)
            return waveforms[:block_size, :]
        else:
            # 従来の処理
            return super().get_output_block(block_size)
```

### 6.2 後方互換性の維持

1. **既存APIの維持**: 従来のエンドポイントはそのまま動作
2. **オプトイン方式**: 新機能は明示的な有効化が必要
3. **デフォルト動作**: 初期状態では従来のノコギリ波生成を使用
4. **段階的移行**: アプリケーションレベルで徐々に新機能を採用

## 7. パフォーマンス考慮事項

### 7.1 最適化戦略

1. **事前計算**: 変調パターンを事前に計算してキャッシュ
2. **SIMD活用**: NumPyのベクトル演算を最大限活用
3. **並列処理**: 複数デバイスの波形生成を並列化
4. **メモリプール**: 大規模配列の再利用

### 7.2 レイテンシ管理

```python
# リアルタイム性を保つための工夫
class OptimizedMassageGenerator:
    def __init__(self, buffer_size: int = 256, lookahead: int = 4):
        self.buffer_size = buffer_size
        self.lookahead = lookahead
        self.precomputed_buffers = []
        
    def precompute_next_buffers(self):
        """次のバッファを事前計算"""
        # バックグラウンドスレッドで実行
        pass
```

## 8. 参考文献

1. 振動触覚フィードバックの研究論文
2. 1/fゆらぎと人間の知覚に関する文献
3. マッサージ機器の振動パターン分析資料