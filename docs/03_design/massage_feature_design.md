# YURAGI機能設計書（最小実装版）

## 1. 概要

本設計書では、既存のベクトル制御機能を活用して、ゆらぎ付き円運動系の力覚ベクトル（YURAGI機能）を最小限の変更で実現する方法を定義します。WebSocketは使用せず、シンプルなREST APIとフロントエンドでの独立した波形計算により実装します。

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

### 4.1 WebSocket API仕様

#### 4.1.1 WebSocketエンドポイント

```
ws://localhost:8000/ws/massage
```

#### 4.1.2 メッセージフォーマット（バージョニング対応）

```python
# WebSocket メッセージ基本構造
{
    "version": "1.0",
    "type": "parameter_update|status_update|error|heartbeat",
    "timestamp": 1640995200000,  # Unix timestamp
    "data": {
        # タイプ固有のデータ
    }
}
```

#### 4.1.3 イベントタイプ

**parameter_update**
```json
{
    "version": "1.0",
    "type": "parameter_update", 
    "timestamp": 1640995200000,
    "data": {
        "device_id": 1,
        "rotation_freq": 0.33,
        "fluctuation_amplitude": 10.0,
        "envelope_depth": 0.25,
        "base_amplitude": 1.0
    }
}
```

**status_update**
```json
{
    "version": "1.0",
    "type": "status_update",
    "timestamp": 1640995200000,
    "data": {
        "massage_mode": true,
        "current_preset": "default",
        "active_devices": [1, 2],
        "waveform_generation_latency": 8.5
    }
}
```

**error**
```json
{
    "version": "1.0",
    "type": "error",
    "timestamp": 1640995200000,
    "data": {
        "error_code": "FREQ_OUT_OF_RANGE",
        "message": "Frequency 150Hz is outside safe range 40-120Hz",
        "severity": "warning|error|critical"
    }
}
```

**heartbeat**
```json
{
    "version": "1.0",
    "type": "heartbeat",
    "timestamp": 1640995200000,
    "data": {
        "interval": 5000,
        "server_time": 1640995200000
    }
}
```

#### 4.1.4 ハートビート機構

```python
# backend/api/websocket_manager.py
class MassageWebSocketManager:
    def __init__(self):
        self.heartbeat_interval = 5000  # 5秒
        self.connection_timeout = 15000  # 15秒
        
    async def start_heartbeat(self, websocket: WebSocket):
        """ハートビート開始"""
        while True:
            try:
                await websocket.send_json({
                    "version": "1.0",
                    "type": "heartbeat",
                    "timestamp": int(time.time() * 1000),
                    "data": {
                        "interval": self.heartbeat_interval,
                        "server_time": int(time.time() * 1000)
                    }
                })
                await asyncio.sleep(self.heartbeat_interval / 1000)
            except WebSocketDisconnect:
                break
```

#### 4.1.5 再接続戦略

```typescript
// frontend/services/WebSocketService.ts
class MassageWebSocketService {
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000; // 初期1秒
    
    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(
                this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
                30000 // 最大30秒
            );
            
            setTimeout(() => {
                this.connect();
                this.reconnectAttempts++;
            }, delay);
        }
    }
}
```

### 4.2 REST API エンドポイント（拡張）

#### 4.2.1 円運動制御エンドポイント

```python
# backend/api/massage_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

router = APIRouter(prefix="/api", tags=["massage"])

class CircularMotionRequest(BaseModel):
    """円運動パラメータ設定リクエスト"""
    version: str = Field("1.0", description="APIバージョン")
    device_id: int = Field(..., ge=1, le=2, description="デバイスID")
    rotation_freq: float = Field(0.33, ge=0.1, le=1.0, description="回転周波数 (Hz)")
    fluctuation_amplitude: float = Field(10.0, ge=0, le=30, description="方位ゆらぎ振幅 (度)")
    enable_fm: bool = Field(True, description="FM変調の有効/無効")
    fm_depth: float = Field(0.05, ge=0, le=0.2, description="FM変調深度")

class MassagePatternRequest(BaseModel):
    """マッサージパターン適用リクエスト"""
    version: str = Field("1.0", description="APIバージョン")
    preset: str = Field(..., description="プリセット名")
    device_ids: List[int] = Field(default=[1, 2], description="適用対象デバイス")
    duration: Optional[float] = Field(None, description="適用時間（秒）")
    fade_in: float = Field(0.5, description="フェードイン時間（秒）")

class MassagePresetResponse(BaseModel):
    """マッサージプリセット情報"""
    version: str = Field("1.0", description="APIバージョン")
    name: str
    description: str
    category: str  # "gentle", "medium", "strong", "therapeutic"
    params: Dict[str, Any]
    preview_duration: float  # プレビュー再生時間

@router.post("/circular-motion")
async def set_circular_motion(request: CircularMotionRequest):
    """円運動パラメータの設定"""
    try:
        await massage_controller.set_circular_motion(
            device_id=request.device_id,
            rotation_freq=request.rotation_freq,
            fluctuation_amplitude=request.fluctuation_amplitude,
            enable_fm=request.enable_fm,
            fm_depth=request.fm_depth
        )
        
        return {
            "version": request.version,
            "status": "success", 
            "device_id": request.device_id,
            "applied_params": request.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/massage-pattern")
async def apply_massage_pattern(request: MassagePatternRequest):
    """マッサージプリセットの適用"""
    try:
        result = await massage_controller.apply_pattern(
            preset=request.preset,
            device_ids=request.device_ids,
            duration=request.duration,
            fade_in=request.fade_in
        )
        
        return {
            "version": request.version,
            "status": "applied",
            "preset": request.preset,
            "devices": request.device_ids,
            "estimated_duration": result.get("duration"),
            "pattern_id": result.get("pattern_id")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/massage/presets")
async def get_massage_presets() -> List[MassagePresetResponse]:
    """利用可能なマッサージプリセット一覧"""
    presets = [
        MassagePresetResponse(
            name="gentle_waves",
            description="優しい波のようなマッサージ",
            category="gentle",
            params={
                "rotation_freq": 0.2,
                "fluctuation_deg": 5.0,
                "envelope_depth": 0.15,
                "base_amplitude": 0.7
            },
            preview_duration=5.0
        ),
        MassagePresetResponse(
            name="deep_tissue",
            description="深層組織マッサージ",
            category="strong",
            params={
                "rotation_freq": 0.5,
                "fluctuation_deg": 15.0,
                "envelope_depth": 0.35,
                "base_amplitude": 1.2
            },
            preview_duration=3.0
        ),
        MassagePresetResponse(
            name="meditation_flow",
            description="瞑想に適したゆったりとした流れ",
            category="gentle",
            params={
                "rotation_freq": 0.15,
                "fluctuation_deg": 8.0,
                "envelope_depth": 0.2,
                "base_amplitude": 0.9
            },
            preview_duration=8.0
        ),
        MassagePresetResponse(
            name="sports_recovery",
            description="スポーツ後の回復に適したパターン",
            category="therapeutic",
            params={
                "rotation_freq": 0.4,
                "fluctuation_deg": 12.0,
                "envelope_depth": 0.3,
                "base_amplitude": 1.0,
                "additional_fm": True
            },
            preview_duration=4.0
        )
    ]
    
    return presets
```

### 4.3 旧APIエンドポイント（後方互換性）

```python
@router.post("/mode")
async def set_massage_mode(request: MassageModeRequest):
    """マッサージモードの設定（後方互換性）"""
    # 新しいAPIへの内部変換
    if request.enabled:
        pattern_request = MassagePatternRequest(
            preset=request.preset or "default",
            device_ids=[1, 2]
        )
        return await apply_massage_pattern(pattern_request)
    else:
        await massage_controller.stop_all_patterns()
        return {"status": "success", "mode": "basic"}

@router.put("/vector-rotation") 
async def update_vector_rotation(request: VectorRotationRequest):
    """ベクトル回転パラメータの更新（後方互換性）"""
    # 新しいAPIへの内部変換
    circular_request = CircularMotionRequest(
        device_id=request.device_id,
        rotation_freq=request.rotation_freq,
        fluctuation_amplitude=request.fluctuation_amplitude,
        enable_fm=request.enable_fm
    )
    return await set_circular_motion(circular_request)
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

## 8. フロントエンド設計仕様

### 8.1 CircularTrajectory コンポーネント

Canvas/WebGLベースの高性能円運動軌跡表示コンポーネント

```typescript
// frontend/components/Visualization/CircularTrajectory.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { useMassageParameters } from '../../hooks/useMassageParameters';

interface CircularTrajectoryProps {
    deviceId: number;
    width?: number;
    height?: number;
    showTrails?: boolean;
    trailLength?: number;
}

export const CircularTrajectory: React.FC<CircularTrajectoryProps> = ({
    deviceId,
    width = 400,
    height = 400,
    showTrails = true,
    trailLength = 200
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const { parameters } = useMassageParameters();
    
    // WebGLコンテキスト初期化
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
            console.warn('WebGL not supported, falling back to Canvas 2D');
            return;
        }
        
        glRef.current = gl;
        initializeShaders();
        setupBuffers();
    }, []);
    
    // リアルタイム描画
    const renderFrame = useCallback((timestamp: number) => {
        const gl = glRef.current;
        const canvas = canvasRef.current;
        if (!gl || !canvas) return;
        
        // 現在の円運動パラメータに基づく描画
        const deviceParams = parameters[`device_${deviceId}`];
        if (deviceParams) {
            renderCircularMotion(gl, deviceParams, timestamp);
        }
    }, [deviceId, parameters]);
    
    useAnimationFrame(renderFrame, 60); // 60fps
    
    const initializeShaders = () => {
        const gl = glRef.current!;
        
        const vertexShaderSource = `
            attribute vec2 position;
            attribute float alpha;
            uniform mat3 transform;
            uniform float time;
            varying float vAlpha;
            
            void main() {
                vec3 pos = transform * vec3(position, 1.0);
                gl_Position = vec4(pos.xy, 0.0, 1.0);
                vAlpha = alpha * (0.8 + 0.2 * sin(time * 0.01));
                gl_PointSize = 3.0;
            }
        `;
        
        const fragmentShaderSource = `
            precision mediump float;
            varying float vAlpha;
            
            void main() {
                float dist = distance(gl_PointCoord, vec2(0.5, 0.5));
                if (dist > 0.5) discard;
                
                vec3 color = vec3(0.3, 0.7, 1.0);
                gl_FragColor = vec4(color, vAlpha * (1.0 - 2.0 * dist));
            }
        `;
        
        // シェーダー作成・リンクのロジック
        // ...
    };
    
    const renderCircularMotion = (
        gl: WebGLRenderingContext, 
        params: any, 
        timestamp: number
    ) => {
        // 円運動の軌跡をWebGLで描画
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // 時間に基づく角度計算
        const t = timestamp * 0.001;
        const angle = 2 * Math.PI * params.rotation_freq * t;
        
        // ゆらぎの計算
        const fluctuation = params.fluctuation_amplitude * 
            Math.sin(2 * Math.PI * 0.3 * t) * Math.PI / 180;
            
        // 最終角度
        const finalAngle = angle + fluctuation;
        
        // 描画処理...
    };
    
    return (
        <div className="circular-trajectory">
            <canvas 
                ref={canvasRef}
                width={width}
                height={height}
                className="border rounded-lg bg-gray-900"
            />
            <div className="mt-2 text-sm text-gray-600 text-center">
                Device {deviceId} Circular Motion Trajectory
            </div>
        </div>
    );
};
```

### 8.2 MassagePatternSelector コンポーネント

プリセット管理と動的パラメータ調整UI

```typescript
// frontend/components/Control/MassagePatternSelector.tsx
import React, { useState, useEffect } from 'react';
import { useMassagePresets } from '../../hooks/useMassagePresets';
import { useMassageWebSocket } from '../../hooks/useMassageWebSocket';

interface MassagePatternSelectorProps {
    deviceIds: number[];
    onPatternChange?: (preset: string, params: any) => void;
}

export const MassagePatternSelector: React.FC<MassagePatternSelectorProps> = ({
    deviceIds,
    onPatternChange
}) => {
    const { presets, loading } = useMassagePresets();
    const { applyPattern, previewPattern, stopPreview } = useMassageWebSocket();
    const [selectedPreset, setSelectedPreset] = useState<string>('');
    const [previewActive, setPreviewActive] = useState<string>('');
    const [customParams, setCustomParams] = useState<any>({});
    
    const handlePresetSelect = async (presetName: string) => {
        setSelectedPreset(presetName);
        const preset = presets.find(p => p.name === presetName);
        if (preset) {
            setCustomParams(preset.params);
            onPatternChange?.(presetName, preset.params);
        }
    };
    
    const handlePreview = async (presetName: string) => {
        if (previewActive) {
            await stopPreview();
        }
        
        setPreviewActive(presetName);
        const preset = presets.find(p => p.name === presetName);
        if (preset) {
            await previewPattern(presetName, deviceIds, preset.preview_duration);
            
            // プレビュー終了後の処理
            setTimeout(() => {
                setPreviewActive('');
            }, preset.preview_duration * 1000);
        }
    };
    
    const handleApplyPattern = async () => {
        if (selectedPreset) {
            await applyPattern({
                preset: selectedPreset,
                device_ids: deviceIds,
                custom_params: customParams
            });
        }
    };
    
    return (
        <div className="massage-pattern-selector p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Massage Patterns</h3>
            
            {loading ? (
                <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* プリセット一覧 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {presets.map((preset) => (
                            <div 
                                key={preset.name}
                                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                    selectedPreset === preset.name
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => handlePresetSelect(preset.name)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-medium text-gray-800">
                                            {preset.name.replace(/_/g, ' ').toUpperCase()}
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {preset.description}
                                        </p>
                                        <div className="mt-2">
                                            <span className={`
                                                inline-block px-2 py-1 rounded-full text-xs font-medium
                                                ${preset.category === 'gentle' ? 'bg-green-100 text-green-800' :
                                                  preset.category === 'strong' ? 'bg-red-100 text-red-800' :
                                                  preset.category === 'therapeutic' ? 'bg-purple-100 text-purple-800' :
                                                  'bg-gray-100 text-gray-800'}
                                            `}>
                                                {preset.category}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePreview(preset.name);
                                        }}
                                        disabled={previewActive === preset.name}
                                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                                    >
                                        {previewActive === preset.name ? 'Playing...' : 'Preview'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* カスタムパラメータ調整 */}
                    {selectedPreset && (
                        <div className="border-t pt-4">
                            <h4 className="font-medium mb-3">Custom Parameters</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Rotation Frequency (Hz)
                                    </label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1.0"
                                        step="0.05"
                                        value={customParams.rotation_freq || 0.33}
                                        onChange={(e) => setCustomParams({
                                            ...customParams,
                                            rotation_freq: parseFloat(e.target.value)
                                        })}
                                        className="w-full"
                                    />
                                    <span className="text-xs text-gray-500">
                                        {(customParams.rotation_freq || 0.33).toFixed(2)} Hz
                                    </span>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Fluctuation (°)
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="30"
                                        step="1"
                                        value={customParams.fluctuation_deg || 10}
                                        onChange={(e) => setCustomParams({
                                            ...customParams,
                                            fluctuation_deg: parseInt(e.target.value)
                                        })}
                                        className="w-full"
                                    />
                                    <span className="text-xs text-gray-500">
                                        {customParams.fluctuation_deg || 10}°
                                    </span>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Envelope Depth
                                    </label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="0.5"
                                        step="0.05"
                                        value={customParams.envelope_depth || 0.25}
                                        onChange={(e) => setCustomParams({
                                            ...customParams,
                                            envelope_depth: parseFloat(e.target.value)
                                        })}
                                        className="w-full"
                                    />
                                    <span className="text-xs text-gray-500">
                                        {(customParams.envelope_depth || 0.25).toFixed(2)}
                                    </span>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Base Amplitude
                                    </label>
                                    <input
                                        type="range"
                                        min="0.3"
                                        max="1.5"
                                        step="0.05"
                                        value={customParams.base_amplitude || 1.0}
                                        onChange={(e) => setCustomParams({
                                            ...customParams,
                                            base_amplitude: parseFloat(e.target.value)
                                        })}
                                        className="w-full"
                                    />
                                    <span className="text-xs text-gray-500">
                                        {(customParams.base_amplitude || 1.0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* 適用ボタン */}
                    <div className="flex justify-center pt-4">
                        <button
                            onClick={handleApplyPattern}
                            disabled={!selectedPreset}
                            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
                        >
                            Apply Pattern to Devices {deviceIds.join(', ')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
```

### 8.3 WebSocketService

リアルタイム通信管理サービス

```typescript
// frontend/services/WebSocketService.ts
export class MassageWebSocketService {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private lastHeartbeat = 0;
    private connectionTimeout = 15000;
    
    private eventListeners: Map<string, Function[]> = new Map();
    
    constructor(url: string = 'ws://localhost:8000/ws/massage') {
        this.url = url;
    }
    
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                
                this.ws.onopen = () => {
                    console.log('WebSocket connected');
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Failed to parse WebSocket message:', error);
                    }
                };
                
                this.ws.onclose = () => {
                    console.log('WebSocket disconnected');
                    this.cleanup();
                    this.reconnect();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    private handleMessage(message: any) {
        // ハートビート処理
        if (message.type === 'heartbeat') {
            this.lastHeartbeat = Date.now();
            return;
        }
        
        // バージョンチェック
        if (message.version && message.version !== '1.0') {
            console.warn(`Unsupported message version: ${message.version}`);
        }
        
        // イベントリスナーに通知
        const listeners = this.eventListeners.get(message.type) || [];
        listeners.forEach(listener => {
            try {
                listener(message.data, message.timestamp);
            } catch (error) {
                console.error(`Error in event listener for ${message.type}:`, error);
            }
        });
    }
    
    private startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (Date.now() - this.lastHeartbeat > this.connectionTimeout) {
                console.warn('Heartbeat timeout, reconnecting...');
                this.reconnect();
            }
        }, 5000);
    }
    
    private cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    private reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(
                this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
                30000
            );
            
            setTimeout(() => {
                console.log(`Reconnecting... (attempt ${this.reconnectAttempts + 1})`);
                this.connect().catch(() => {
                    // 再接続が失敗した場合は自動的に次の試行がスケジュールされる
                });
                this.reconnectAttempts++;
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('max_reconnect_attempts');
        }
    }
    
    // イベントリスナー管理
    on(eventType: string, listener: Function) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType)!.push(listener);
    }
    
    off(eventType: string, listener: Function) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    private emit(eventType: string, data?: any) {
        const listeners = this.eventListeners.get(eventType) || [];
        listeners.forEach(listener => listener(data));
    }
    
    // メッセージ送信
    send(type: string, data: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                version: '1.0',
                type,
                timestamp: Date.now(),
                data
            };
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket is not connected');
        }
    }
    
    // 専用メソッド
    async applyPattern(request: any) {
        this.send('apply_pattern', request);
    }
    
    async previewPattern(preset: string, deviceIds: number[], duration: number) {
        this.send('preview_pattern', { preset, deviceIds, duration });
    }
    
    async updateCircularMotion(params: any) {
        this.send('update_circular_motion', params);
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.cleanup();
    }
}
```

### 8.4 状態管理拡張

Zustandベースのマッサージ機能状態管理

```typescript
// frontend/stores/massageStore.ts
import { create } from 'zustand';
import { MassageWebSocketService } from '../services/WebSocketService';

interface MassageState {
    // WebSocket接続
    wsService: MassageWebSocketService;
    connected: boolean;
    
    // マッサージパラメータ
    activePreset: string | null;
    deviceParameters: Map<number, any>;
    
    // UI状態
    previewActive: string | null;
    latencyMs: number;
    
    // アクション
    connect: () => Promise<void>;
    disconnect: () => void;
    applyPattern: (preset: string, deviceIds: number[]) => Promise<void>;
    updateParameters: (deviceId: number, params: any) => void;
    setLatency: (latency: number) => void;
}

export const useMassageStore = create<MassageState>((set, get) => ({
    wsService: new MassageWebSocketService(),
    connected: false,
    activePreset: null,
    deviceParameters: new Map(),
    previewActive: null,
    latencyMs: 0,
    
    connect: async () => {
        const { wsService } = get();
        
        try {
            await wsService.connect();
            set({ connected: true });
            
            // イベントリスナー設定
            wsService.on('parameter_update', (data) => {
                const { deviceParameters } = get();
                const newParams = new Map(deviceParameters);
                newParams.set(data.device_id, data);
                set({ deviceParameters: newParams });
            });
            
            wsService.on('status_update', (data) => {
                set({ 
                    activePreset: data.current_preset,
                    latencyMs: data.waveform_generation_latency 
                });
            });
            
            wsService.on('error', (data) => {
                console.error('WebSocket error:', data);
            });
            
        } catch (error) {
            console.error('Failed to connect:', error);
            set({ connected: false });
            throw error;
        }
    },
    
    disconnect: () => {
        const { wsService } = get();
        wsService.disconnect();
        set({ connected: false });
    },
    
    applyPattern: async (preset: string, deviceIds: number[]) => {
        const { wsService } = get();
        await wsService.applyPattern({ preset, device_ids: deviceIds });
        set({ activePreset: preset });
    },
    
    updateParameters: (deviceId: number, params: any) => {
        const { wsService, deviceParameters } = get();
        wsService.updateCircularMotion({ device_id: deviceId, ...params });
        
        const newParams = new Map(deviceParameters);
        newParams.set(deviceId, { ...newParams.get(deviceId), ...params });
        set({ deviceParameters: newParams });
    },
    
    setLatency: (latency: number) => {
        set({ latencyMs: latency });
    }
}));
```

## 9. パフォーマンス要件

### 9.1 レイテンシ要件

| 項目 | 目標値 | 許容値 | 測定方法 |
|------|--------|--------|----------|
| 波形生成 | <8ms (平均) | <10ms (99%ile) | timestamp比較 |
| WebSocket通信 | <3ms (平均) | <5ms (99%ile) | RTT測定 |
| UI レンダリング | >60fps (目標) | >30fps (最小) | requestAnimationFrame |
| CPU使用率 | <20% (平均) | <25% (最大) | システム監視 |

### 9.2 スループット要件

| 項目 | 要求値 | 備考 |
|------|--------|------|
| WebSocketメッセージ | >100 msg/sec | バーストトラフィック対応 |
| 同時接続数 | >10 connections | 複数クライアント対応 |
| パラメータ更新頻度 | >20 Hz | リアルタイム制御用 |

### 9.3 メモリ使用量

| コンポーネント | 制限値 | 備考 |
|---------------|--------|------|
| WebGL描画バッファ | <100MB | 軌跡表示用 |
| WebSocket送受信バッファ | <50MB | メッセージキュー |
| 波形生成バッファ | <200MB | リアルタイム処理用 |

### 9.4 パフォーマンス監視

```typescript
// frontend/utils/PerformanceMonitor.ts
export class PerformanceMonitor {
    private metrics = new Map<string, number[]>();
    private readonly maxSamples = 1000;
    
    recordLatency(operation: string, duration: number) {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        
        const samples = this.metrics.get(operation)!;
        samples.push(duration);
        
        // サンプル数制限
        if (samples.length > this.maxSamples) {
            samples.shift();
        }
    }
    
    getStats(operation: string) {
        const samples = this.metrics.get(operation) || [];
        if (samples.length === 0) return null;
        
        const sorted = [...samples].sort((a, b) => a - b);
        return {
            avg: samples.reduce((a, b) => a + b) / samples.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }
    
    checkThresholds() {
        const waveformStats = this.getStats('waveform_generation');
        const wsStats = this.getStats('websocket_rtt');
        
        const alerts = [];
        
        if (waveformStats && waveformStats.p99 > 10) {
            alerts.push('Waveform generation latency exceeding 10ms (99th percentile)');
        }
        
        if (wsStats && wsStats.avg > 5) {
            alerts.push('WebSocket RTT exceeding 5ms average');
        }
        
        return alerts;
    }
}
```

## 10. 参考文献

1. 振動触覚フィードバックの研究論文
2. 1/fゆらぎと人間の知覚に関する文献  
3. マッサージ機器の振動パターン分析資料
4. WebSocket仕様 (RFC 6455)
5. WebGL パフォーマンス最適化ガイドライン
6. リアルタイムWebアプリケーション設計パターン