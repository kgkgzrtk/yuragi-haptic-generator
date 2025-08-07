# 二軸振動触覚システム ソフトウェア設計書

## 1. エグゼクティブサマリー

### 1.1 プロジェクト概要
本設計書は、4チャンネル独立制御可能なノコギリ波出力デバイスのMVP（Minimum Viable Product）ソフトウェア実装について定義します。本システムは、2つの2軸振動アクチュエータを用いて、基本的な触覚フィードバックを実現し、REST APIとWeb UIによる制御を提供します。

### 1.2 主要機能
- **周波数制御**: 40-120Hzの可変周波数設定
- **波形生成**: サンプルコードベースのノコギリ波生成
- **REST API**: HTTPによるパラメータ制御と状態取得
- **Web UI**: React + react-chartjs-2による波形表示

### 1.3 設計方針（MVP）
- **シンプルな実装**: 最小限の機能に絞った開発
- **サンプルコードベース**: 提供されたノコギリ波生成ロジックを活用
- **REST API**: WebSocketを使わずHTTPのみで実装
- **迅速な開発**: プロトタイプとしての検証に注力

### 1.4 技術スタック
- **バックエンド**: Python (uv管理), FastAPI, NumPy
- **フロントエンド**: React, react-chartjs-2
- **通信**: REST API (HTTP/JSON)
- **パッケージ管理**: uv (Python), npm (JavaScript)

## 2. システムアーキテクチャ

### 2.1 全体構成（MVP）
```
┌─────────────────────────────────────────────────┐
│           React UI (localhost:3000)              │
│  ├── ControlPanel: パラメータ制御                  │
│  ├── WaveformChart: 4ch波形表示                  │
│  └── XYTrajectory: XY軌跡表示（将来）             │
├─────────────────────────────────────────────────┤
│           REST API (HTTP/JSON)                   │
├─────────────────────────────────────────────────┤
│         FastAPI Server (localhost:8000)          │
│  ├── 波形生成エンジン（サンプルコードベース）        │
│  ├── 共振シミュレーション                         │
│  └── パラメータ管理                              │
├──────────┬──────────┬──────────┬──────────────┤
│  Ch1(X1) │  Ch2(Y1) │  Ch3(X2) │   Ch4(Y2)   │
├──────────┴──────────┼──────────┴──────────────┤
│    デバイス1         │      デバイス2           │
│  (2軸アクチュエータ)  │   (2軸アクチュエータ)    │
└─────────────────────┴─────────────────────────┘
```

### 2.2 データフロー（MVP）
```
Web UI (パラメータ設定)
    ↓
[REST API] PUT /api/parameters
    ↓
[FastAPI Server] パラメータ検証・保存
    ↓
[Waveform Generator] サンプルコードベースの波形生成
    ↓
[REST API] GET /api/waveform
    ↓
[Web UI] react-chartjs-2で波形表示
```

### 2.3 プロジェクト構造（MVP）
```
sawtooth-haptic-mvp/
├── pyproject.toml              # uv設定ファイル
├── package.json                # フロントエンド依存関係
├── backend/
│   ├── __init__.py
│   ├── main.py                 # FastAPIエントリポイント
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py           # REST APIルート定義
│   ├── core/
│   │   ├── __init__.py
│   │   └── waveform.py         # サンプルコードベースの波形生成
│   ├── models/
│   │   ├── __init__.py
│   │   └── parameters.py       # Pydanticモデル定義
│   └── simulation/
│       ├── __init__.py
│       └── resonance.py        # 共振シミュレーション
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.tsx             # メインアプリケーション
│   │   ├── components/
│   │   │   ├── ControlPanel.tsx        # パラメータ制御UI
│   │   │   └── WaveformChart.tsx       # react-chartjs-2波形表示
│   │   ├── hooks/
│   │   │   └── useApi.ts               # API通信フック
│   │   └── types/
│   │       └── index.ts                # TypeScript型定義
│   └── package.json
├── tests/                      # 手動テスト用スクリプト
│   └── test_api.py
└── README.md                   # セットアップ・使用方法
```

## 3. コンポーネント設計（MVP）

### 3.1 波形生成モジュール (backend/core/waveform.py)

#### 設計概要
サンプルコードをベースにしたシンプルなノコギリ波生成関数。

```python
import numpy as np
from typing import Optional

def sawtooth_wave(t: np.ndarray, freq: float, amp: float = 1.0, phase: float = 0.0) -> np.ndarray:
    """
    サンプルコードと同じ上昇ノコギリ波生成
    
    Args:
        t: 時間配列
        freq: 周波数 (Hz)
        amp: 振幅 (0.0-1.0)
        phase: 位相オフセット
        
    Returns:
        波形データ配列
    """
    return amp * (2 * ((freq * t + phase) % 1.0) - 1)

def generate_multichannel_waveform(
    duration: float,
    sample_rate: int,
    channel_params: list
) -> np.ndarray:
    """
    マルチチャンネル波形生成
    
    Args:
        duration: 生成時間（秒）
        sample_rate: サンプリングレート
        channel_params: 各チャンネルのパラメータリスト
        
    Returns:
        4チャンネル波形データ
    """
    t = np.arange(0, duration, 1/sample_rate)
    waveforms = np.zeros((len(t), 4))
    
    for ch_idx, params in enumerate(channel_params):
        if params['amplitude'] > 0:
            wave = sawtooth_wave(
                t,
                params['frequency'],
                params['amplitude'],
                params['phase']
            )
            if not params['polarity']:
                wave = -wave
            waveforms[:, ch_idx] = wave
    
    return waveforms
```


### 3.2 パラメータモデル (backend/models/parameters.py)

#### 設計概要
REST APIで受け取るパラメータのPydanticモデル定義。

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class ChannelParameters(BaseModel):
    """単一チャンネルのパラメータ"""
    channel_id: int = Field(..., ge=0, le=3, description="チャンネルID (0-3)")
    frequency: float = Field(60.0, ge=40, le=120, description="周波数 (Hz)")
    amplitude: float = Field(0.5, ge=0, le=1, description="振幅 (0-1)")
    phase: float = Field(0.0, ge=0, lt=360, description="位相 (度)")
    polarity: bool = Field(True, description="True: 上昇波形, False: 下降波形")

class SystemParameters(BaseModel):
    """システム全体のパラメータ"""
    channels: List[ChannelParameters] = Field(
        ..., 
        min_items=4, 
        max_items=4,
        description="4チャンネル分のパラメータ"
    )

class WaveformRequest(BaseModel):
    """波形データリクエスト"""
    duration: float = Field(0.1, gt=0, le=1.0, description="波形の長さ（秒）")
    sample_rate: int = Field(44100, description="サンプリングレート")

class WaveformResponse(BaseModel):
    """波形データレスポンス"""
    timestamp: float = Field(..., description="Unixタイムスタンプ")
    sample_rate: int = Field(..., description="サンプリングレート")
    channels: List[dict] = Field(..., description="各チャンネルの波形データ")
```

### 3.3 共振シミュレーション (backend/simulation/resonance.py)

#### 設計概要
サンプルコードの共振シミュレーション機能を実装。

```python
import numpy as np
from typing import Tuple

def resonator(u: np.ndarray, fs: float, f_n: float, zeta: float) -> np.ndarray:
    """
    2次共振系のシミュレーション（サンプルコードより）
    G(s)=ωn²/(s²+2ζωn s+ωn²) を Tustin 変換
    
    Args:
        u: 入力信号
        fs: サンプリング周波数
        f_n: 共振周波数
        zeta: 減衰比
    
    Returns:
        共振応答
    """
    w_n, dt = 2 * np.pi * f_n, 1 / fs
    a0 = 4 + 4 * zeta * w_n * dt + (w_n * dt) ** 2
    b0 = (w_n * dt) ** 2
    b1 = 2 * b0
    b2 = b0
    a1 = 2 * ((w_n * dt) ** 2 - 4)
    a2 = 4 - 4 * zeta * w_n * dt + (w_n * dt) ** 2

    y = np.zeros_like(u)
    for n in range(2, len(u)):
        y[n] = (b0 * u[n] + b1 * u[n - 1] + b2 * u[n - 2]
                - a1 * y[n - 1] - a2 * y[n - 2]) / a0
    return y

def simulate_resonance(
    waveform: np.ndarray,
    sample_rate: int = 44100,
    resonance_freq: float = 180.0,
    damping_ratio: float = 0.08
) -> np.ndarray:
    """
    波形に共振特性を適用
    
    Args:
        waveform: 入力波形
        sample_rate: サンプリングレート
        resonance_freq: 共振周波数
        damping_ratio: 減衰比
    
    Returns:
        共振応答波形
    """
    return resonator(waveform, sample_rate, resonance_freq, damping_ratio)
```

### 3.4 FastAPI Server (backend/main.py)

#### 設計概要
REST APIエンドポイントを提供するFastAPIサーバー。

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import time
import numpy as np

from .api.routes import router
from .core.waveform import generate_multichannel_waveform
from .models.parameters import SystemParameters, WaveformRequest

app = FastAPI(
    title="Sawtooth Haptic Device API",
    version="1.0.0",
    description="ノコギリ波触覚デバイス制御API (MVP)"
)

# CORS設定（開発用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React開発サーバー
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# グローバル状態管理
current_parameters = {
    "channels": [
        {"channel_id": 0, "frequency": 60.0, "amplitude": 0.0, "phase": 0.0, "polarity": True},
        {"channel_id": 1, "frequency": 60.0, "amplitude": 0.0, "phase": 0.0, "polarity": True},
        {"channel_id": 2, "frequency": 60.0, "amplitude": 0.0, "phase": 0.0, "polarity": True},
        {"channel_id": 3, "frequency": 60.0, "amplitude": 0.0, "phase": 0.0, "polarity": True}
    ]
}

# APIルートを登録
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Sawtooth Haptic Device API"}

@app.put("/api/parameters")
async def update_parameters(params: SystemParameters):
    """パラメータ更新"""
    global current_parameters
    current_parameters = params.dict()
    return {"status": "updated"}

@app.get("/api/parameters")
async def get_parameters():
    """現在のパラメータ取得"""
    return current_parameters

@app.post("/api/waveform")
async def get_waveform(request: WaveformRequest):
    """波形データ生成"""
    try:
        waveform = generate_multichannel_waveform(
            request.duration,
            request.sample_rate,
            current_parameters["channels"]
        )
        
        # 表示用に間引き
        decimation = max(1, len(waveform) // 1000)
        decimated = waveform[::decimation]
        
        return {
            "timestamp": time.time(),
            "sample_rate": request.sample_rate,
            "channels": [
                {
                    "channel_id": i,
                    "data": decimated[:, i].tolist()
                }
                for i in range(4)
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

### 3.5 API Routes (backend/api/routes.py)

#### 設計概要
REST APIのルーティング定義。

```python
from fastapi import APIRouter, HTTPException
from ..models.parameters import (
    ChannelParameters,
    SystemParameters,
    WaveformRequest,
    WaveformResponse
)

router = APIRouter()
    """共振検出・保護システム"""
    
    def __init__(self):
        self.resonance_frequencies: List[float] = []
        self.protection_bandwidth = 10.0  # ±10Hz保護帯域
        self.detection_threshold = 3.0  # 共振検出閾値（振幅比）
        
    def detect_resonances(
        self,
        frequency_range: Tuple[float, float] = (40, 120),
        resolution: float = 0.5
    ) -> List[float]:
        """
        周波数スイープによる共振検出
        
        Args:
            frequency_range: 検出範囲 (Hz)
            resolution: 周波数分解能 (Hz)
            
        Returns:
            検出された共振周波数リスト
        """
        resonances = []
        test_amplitude = 0.1  # テスト振幅（低レベル）
        
        frequencies = np.arange(
            frequency_range[0],
            frequency_range[1],
            resolution
        )
        
        for freq in frequencies:
            # テスト信号生成・測定
            response_amplitude = self._measure_frequency_response(
                freq, test_amplitude
            )
            
            # 共振判定
            if response_amplitude > test_amplitude * self.detection_threshold:
                resonances.append(freq)
                
        self.resonance_frequencies = self._merge_nearby_resonances(resonances)
        return self.resonance_frequencies
    
    def is_frequency_safe(self, frequency: float) -> Tuple[bool, Optional[str]]:
        """
        周波数の安全性チェック
        
        Args:
            frequency: チェック対象周波数 (Hz)
            
        Returns:
            (安全フラグ, エラーメッセージ)
        """
        for resonance in self.resonance_frequencies:
            if abs(frequency - resonance) < self.protection_bandwidth:
                return False, f"Too close to resonance at {resonance:.1f}Hz"
        return True, None
```

### 3.6 RealTimeEngine (processing/real_time_engine.py)

#### 設計概要
PyAudioを使用した低レイテンシリアルタイム処理エンジン。

```python
import pyaudio
import numpy as np
import numba
from typing import Callable, Optional
import queue
import threading

class RealTimeEngine:
    """リアルタイムオーディオ処理エンジン"""
    
    def __init__(
        self,
        sample_rate: int = 44100,
        channels: int = 4,
        buffer_size: int = 256  # ~5.8ms @ 44.1kHz
    ):
        self.sample_rate = sample_rate
        self.channels = channels
        self.buffer_size = buffer_size
        
        # PyAudioインスタンス
        self.pyaudio = pyaudio.PyAudio()
        self.stream: Optional[pyaudio.Stream] = None
        
        # ロックフリーキュー
        self.command_queue = queue.Queue(maxsize=100)
        self.status_queue = queue.Queue(maxsize=100)
        
        # コールバック関数
        self.process_callback: Optional[Callable] = None
        
        # パフォーマンスカウンタ
        self.callback_count = 0
        self.underrun_count = 0
        
    def set_process_callback(self, callback: Callable):
        """処理コールバックを設定"""
        self.process_callback = callback
        
    def start(self):
        """リアルタイム処理を開始"""
        self.stream = self.pyaudio.open(
            format=pyaudio.paFloat32,
            channels=self.channels,
            rate=self.sample_rate,
            output=True,
            frames_per_buffer=self.buffer_size,
            stream_callback=self._audio_callback,
            start=False
        )
        self.stream.start_stream()
        
    def _audio_callback(
        self,
        in_data,
        frame_count: int,
        time_info: dict,
        status_flags: int
    ) -> Tuple[bytes, int]:
        """PyAudioコールバック（リアルタイムコンテキスト）"""
        self.callback_count += 1
        
        if status_flags:
            self.underrun_count += 1
            
        # コマンド処理（ノンブロッキング）
        self._process_commands_nonblocking()
        
        # 音声処理
        if self.process_callback:
            output_array = self.process_callback(frame_count)
        else:
            output_array = np.zeros((frame_count, self.channels), dtype=np.float32)
            
        # バイト列に変換
        output_bytes = output_array.tobytes()
        
        return output_bytes, pyaudio.paContinue
    
    @staticmethod
    @numba.jit(nopython=True, cache=True)
    def mix_channels(
        channel_data: np.ndarray,
        gains: np.ndarray
    ) -> np.ndarray:
        """チャンネルミキシング（Numba最適化）"""
        return channel_data * gains
```

### 3.7 SawtoothActuator (sawtooth_actuator.py)

#### 設計概要
ユーザー向けメインAPIクラス。

```python
import numpy as np
from typing import Dict, List, Optional, Tuple
from .core import (
    SawtoothGenerator,
    VectorController,
    PhaseSynchronizer,
    FeedbackController
)
from .devices import ResonanceDetector, CalibrationManager
from .processing import RealTimeEngine

class SawtoothActuator:
    """ノコギリ波触覚アクチュエータ制御クラス"""
    
    def __init__(
        self,
        sample_rate: int = 44100,
        buffer_size: int = 256,
        enable_feedback: bool = True
    ):
        # コンポーネント初期化
        self.generator = SawtoothGenerator(sample_rate)
        self.vector_controller = VectorController()
        self.phase_sync = PhaseSynchronizer(num_channels=4)
        self.feedback = FeedbackController(sample_rate) if enable_feedback else None
        self.resonance_detector = ResonanceDetector()
        self.calibration = CalibrationManager()
        
        # リアルタイムエンジン
        self.engine = RealTimeEngine(
            sample_rate=sample_rate,
            channels=4,
            buffer_size=buffer_size
        )
        self.engine.set_process_callback(self._process_audio)
        
        # チャンネル状態
        self.channel_params = [
            {'frequency': 0, 'amplitude': 0, 'phase': 0, 'polarity': True}
            for _ in range(4)
        ]
        
        # 初期化処理
        self._initialize()
        
    def _initialize(self):
        """初期化処理"""
        # 共振検出
        print("Detecting resonances...")
        resonances = self.resonance_detector.detect_resonances()
        if resonances:
            print(f"Found resonances at: {resonances} Hz")
            
        # キャリブレーション
        print("Loading calibration data...")
        self.calibration.load_or_create_calibration()
        
    def set_channel_sawtooth(
        self,
        channel: int,
        frequency: float,
        amplitude: float = 1.0,
        phase: float = 0.0,
        polarity: bool = True
    ):
        """
        チャンネルにノコギリ波を設定
        
        Args:
            channel: チャンネル番号 (0-3)
            frequency: 周波数 (40-120Hz)
            amplitude: 振幅 (0.0-1.0)
            phase: 位相 (度)
            polarity: True=上昇, False=下降
        """
        # パラメータ検証
        if not 0 <= channel < 4:
            raise ValueError(f"Invalid channel: {channel}")
        if not 40 <= frequency <= 120:
            raise ValueError(f"Frequency out of range: {frequency}Hz")
            
        # 共振チェック
        is_safe, error_msg = self.resonance_detector.is_frequency_safe(frequency)
        if not is_safe:
            raise ValueError(f"Unsafe frequency: {error_msg}")
            
        # パラメータ設定
        self.channel_params[channel] = {
            'frequency': frequency,
            'amplitude': amplitude,
            'phase': np.deg2rad(phase),
            'polarity': polarity
        }
        
    def set_vector_force(
        self,
        device: int,
        angle: float,
        magnitude: float,
        frequency: float = 10.0
    ):
        """
        デバイスにベクトル力覚を設定
        
        Args:
            device: デバイス番号 (0 or 1)
            angle: ベクトル角度 (度)
            magnitude: ベクトル大きさ (0.0-1.0)
            frequency: 基準周波数 (Hz)
        """
        if device not in [0, 1]:
            raise ValueError(f"Invalid device: {device}")
            
        # ベクトルパラメータ計算
        params = self.vector_controller.calculate_vector_parameters(
            angle, magnitude, frequency
        )
        
        # チャンネル設定
        base_channel = device * 2
        self.set_channel_sawtooth(
            base_channel,
            params['x_axis']['frequency'],
            params['x_axis']['amplitude'],
            np.rad2deg(params['x_axis']['phase']),
            params['x_axis']['polarity']
        )
        self.set_channel_sawtooth(
            base_channel + 1,
            params['y_axis']['frequency'],
            params['y_axis']['amplitude'],
            np.rad2deg(params['y_axis']['phase']),
            params['y_axis']['polarity']
        )
        
    def start(self):
        """再生開始"""
        self.engine.start()
        
    def stop(self):
        """再生停止"""
        self.engine.stop()
        
    def _process_audio(self, frames: int) -> np.ndarray:
        """オーディオ処理コールバック"""
        output = np.zeros((frames, 4), dtype=np.float32)
        
        # 位相同期
        synced_phases = self.phase_sync.sync_channels(
            self.channel_params, frames, self.engine.sample_rate
        )
        
        # 各チャンネル生成
        for ch in range(4):
            params = self.channel_params[ch]
            if params['amplitude'] > 0:
                # ノコギリ波生成
                waveform, _ = self.generator.generate(
                    frames,
                    params['frequency'],
                    params['amplitude'],
                    synced_phases[ch],
                    params['polarity']
                )
                
                # フィードバック制御
                if self.feedback:
                    waveform = self.feedback.process_feedback(waveform)
                    
                # キャリブレーション適用
                waveform = self.calibration.apply_compensation(
                    waveform, params['frequency']
                )
                
                output[:, ch] = waveform
                
        return output
```

### 3.8 FastAPI Server (backend/main.py)

#### 設計概要
Web UIとの通信を担当するFastAPIサーバー。

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
from typing import Dict, Any
import struct
import numpy as np

from .sawtooth_actuator import SawtoothActuator
from .api.api_handler import APIManager
from .processing.waveform_decimator import WaveformDecimator

app = FastAPI(title="Sawtooth Haptic Device")

# CORS設定（開発用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite開発サーバー
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静的ファイル配信
app.mount("/static", StaticFiles(directory="dist"), name="static")

# グローバル状態
actuator = SawtoothActuator()
api_manager = APIManager()
decimator = WaveformDecimator()

@app.post("/api/control")
async def control_endpoint(data: Dict[str, Any]):
    """制御パラメータ更新エンドポイント"""
    return await handle_control_message(data)

async def handle_control_message(data: Dict[str, Any]):
    """制御メッセージ処理"""
    msg_type = data.get("type")
    
    if msg_type == "update_parameters":
        # パラメータ更新
        params = data.get("parameters", {})
        for ch_id, ch_params in params.items():
            if ch_id.startswith("channel_"):
                ch_num = int(ch_id.split("_")[1])
                actuator.set_channel_sawtooth(
                    channel=ch_num,
                    frequency=ch_params.get("frequency", 60),
                    amplitude=ch_params.get("amplitude", 0),
                    phase=ch_params.get("phase", 0),
                    polarity=ch_params.get("polarity", True)
                )
    
    elif msg_type == "get_waveform_data":
        # 波形データ送信
        return await get_waveform_data()

async def get_waveform_data():
    """波形データとXY軌跡を送信"""
    # 5周期分のデータを生成
    sample_rate = actuator.sample_rate
    max_freq = max([p['frequency'] for p in actuator.channel_params if p['amplitude'] > 0] or [60])
    frames_5_periods = int(5 * sample_rate / max_freq)
    
    # 波形データ生成
    waveform_data = actuator._process_audio(frames_5_periods)
    
    # 表示用に間引き
    decimated_data = {
        f"channel_{i}": decimator.decimate_for_display(
            waveform_data[:, i], sample_rate
        ).tolist()
        for i in range(4)
    }
    
    # XY加速度軌跡計算
    xy_trajectory = calculate_xy_acceleration_trajectory(
        actuator.channel_params[0],  # Device 1 X
        actuator.channel_params[1],  # Device 1 Y
        frames_5_periods
    )
    
    # データ返却
    return {
        "type": "waveform_update",
        "data": {
            "waveforms": decimated_data,
            "xy_trajectory": xy_trajectory.tolist(),
            "timestamp": asyncio.get_event_loop().time()
        }
    }

@app.on_event("startup")
async def startup_event():
    """起動時処理"""
    actuator.start()
    # 定期的な波形データ送信
    asyncio.create_task(periodic_waveform_broadcast())

async def periodic_waveform_broadcast():
    """定期的に全クライアントに波形データを送信"""
    while True:
        if ws_manager.active_connections:
            for connection in ws_manager.active_connections:
                try:
                    await send_waveform_update(connection)
                except:
                    pass
        await asyncio.sleep(1/30)  # 30fps

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

### 3.9 Web UI Components

#### 3.9.1 Control Panel (frontend/components/ControlPanel.tsx)

```typescript
import React from 'react';
import { useParameterStore } from '../stores/parameterStore';
import { Slider } from './ui/Slider';
import { Toggle } from './ui/Toggle';
import { NumberInput } from './ui/NumberInput';

interface ChannelControlProps {
  channelId: number;
  label: string;
  color: string;
}

const ChannelControl: React.FC<ChannelControlProps> = ({ channelId, label, color }) => {
  const { parameters, updateParameter } = useParameterStore();
  const channelKey = `channel_${channelId}`;
  const params = parameters[channelKey];

  return (
    <div className="p-4 border rounded-lg space-y-3" style={{ borderColor: color }}>
      <h3 className="font-semibold flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </h3>
      
      <div className="space-y-2">
        <div>
          <label className="text-sm text-gray-600">Frequency (Hz)</label>
          <Slider
            value={params.frequency}
            onChange={(value) => updateParameter(channelKey, 'frequency', value)}
            min={40}
            max={120}
            step={0.1}
          />
          <NumberInput
            value={params.frequency}
            onChange={(value) => updateParameter(channelKey, 'frequency', value)}
            min={40}
            max={120}
            className="mt-1"
          />
        </div>
        
        <div>
          <label className="text-sm text-gray-600">Amplitude</label>
          <Slider
            value={params.amplitude}
            onChange={(value) => updateParameter(channelKey, 'amplitude', value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>
        
        <div>
          <label className="text-sm text-gray-600">Phase (°)</label>
          <Slider
            value={params.phase}
            onChange={(value) => updateParameter(channelKey, 'phase', value)}
            min={0}
            max={360}
            step={1}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Polarity</label>
          <Toggle
            checked={params.polarity}
            onChange={(value) => updateParameter(channelKey, 'polarity', value)}
            labels={{ on: "Rising", off: "Falling" }}
          />
        </div>
      </div>
    </div>
  );
};

export const ControlPanel: React.FC = () => {
  const channelColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F'];
  
  return (
    <div className="p-6 bg-gray-50 rounded-lg overflow-y-auto max-h-screen">
      <h2 className="text-xl font-bold mb-4">Channel Controls</h2>
      
      <div className="space-y-4">
        <div className="grid gap-4">
          <h3 className="font-semibold text-gray-700">Device 1 (Ch 1-2)</h3>
          <ChannelControl channelId={0} label="Channel 1 (X-axis)" color={channelColors[0]} />
          <ChannelControl channelId={1} label="Channel 2 (Y-axis)" color={channelColors[1]} />
        </div>
        
        <div className="grid gap-4">
          <h3 className="font-semibold text-gray-700">Device 2 (Ch 3-4)</h3>
          <ChannelControl channelId={2} label="Channel 3 (X-axis)" color={channelColors[2]} />
          <ChannelControl channelId={3} label="Channel 4 (Y-axis)" color={channelColors[3]} />
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-white rounded-lg">
        <h3 className="font-semibold mb-2">Vector Control</h3>
        <VectorControlPanel />
      </div>
    </div>
  );
};
```

#### 3.9.2 Waveform Display (frontend/components/WaveformDisplay.tsx)

```typescript
import React, { useEffect, useRef } from 'react';
import * as Plot from '@observablehq/plot';
import { useWaveformData } from '../hooks/useWaveformData';

export const WaveformDisplay: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { waveformData } = useWaveformData();
  const channelColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F'];

  useEffect(() => {
    if (!containerRef.current || !waveformData) return;

    // データ準備
    const plotData = [];
    Object.entries(waveformData).forEach(([channel, data], idx) => {
      data.forEach((value, i) => {
        plotData.push({
          x: i / data.length * 5,  // 5周期分に正規化
          y: value,
          channel: channel,
          color: channelColors[idx]
        });
      });
    });

    // Observable Plotで描画
    const plot = Plot.plot({
      width: containerRef.current.clientWidth,
      height: 400,
      x: {
        label: "Time (periods)",
        domain: [0, 5]
      },
      y: {
        label: "Amplitude",
        domain: [-1.2, 1.2]
      },
      marks: [
        Plot.line(plotData, {
          x: "x",
          y: "y",
          stroke: "color",
          strokeWidth: 2,
          opacity: 0.8
        }),
        Plot.ruleY([0])
      ],
      style: {
        backgroundColor: "white",
        padding: "20px"
      }
    });

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(plot);

    return () => plot.remove();
  }, [waveformData]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold mb-2">Waveform Display (5 Periods)</h2>
      <div ref={containerRef} className="w-full" />
      <div className="flex justify-center mt-2 gap-4">
        {channelColors.map((color, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm">Ch {idx + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### 3.9.3 XY Trajectory Display (frontend/components/XYTrajectory.tsx)

```typescript
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useWaveformData } from '../hooks/useWaveformData';

export const XYTrajectory: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { xyTrajectory } = useWaveformData();

  useEffect(() => {
    if (!svgRef.current || !xyTrajectory) return;

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // クリア
    svg.selectAll('*').remove();

    // スケール設定
    const xScale = d3.scaleLinear()
      .domain([-2, 2])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([-2, 2])
      .range([innerHeight, 0]);

    // メイングループ
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 背景とグリッド
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#f8f9fa');

    // 軸
    g.append('g')
      .attr('transform', `translate(0,${innerHeight/2})`)
      .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(() => ''));

    g.append('g')
      .attr('transform', `translate(${innerWidth/2},0)`)
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => ''));

    // 軌跡データ
    const line = d3.line<[number, number]>()
      .x(d => xScale(d[0]))
      .y(d => yScale(d[1]))
      .curve(d3.curveCatmullRom);

    // 軌跡描画（グラデーション付き）
    const gradient = g.append('defs')
      .append('linearGradient')
      .attr('id', 'trajectory-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');

    gradient.selectAll('stop')
      .data([
        { offset: '0%', color: '#FF6B6B', opacity: 0.2 },
        { offset: '50%', color: '#4ECDC4', opacity: 0.6 },
        { offset: '100%', color: '#45B7D1', opacity: 1 }
      ])
      .enter().append('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color)
      .attr('stop-opacity', d => d.opacity);

    // 軌跡パス
    g.append('path')
      .datum(xyTrajectory)
      .attr('fill', 'none')
      .attr('stroke', 'url(#trajectory-gradient)')
      .attr('stroke-width', 2)
      .attr('d', line);

    // 現在位置マーカー
    const lastPoint = xyTrajectory[xyTrajectory.length - 1];
    g.append('circle')
      .attr('cx', xScale(lastPoint[0]))
      .attr('cy', yScale(lastPoint[1]))
      .attr('r', 6)
      .attr('fill', '#45B7D1')
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // ラベル
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 35)
      .attr('text-anchor', 'middle')
      .text('X Acceleration');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -25)
      .attr('text-anchor', 'middle')
      .text('Y Acceleration');

  }, [xyTrajectory]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold mb-2">XY Acceleration Trajectory</h2>
      <svg ref={svgRef} />
      <div className="text-sm text-gray-600 mt-2 text-center">
        Device 1 (Ch 1-2) Force Vector Visualization
      </div>
    </div>
  );
};
```

## 4. 高度な触覚フィードバック機能（ゆらぎ付き円運動系）

詳細な設計については、[マッサージ機能設計書](massage_feature_design.md)を参照してください。

### 4.1 概要

基本的なノコギリ波生成に加えて、より自然で心地よい触覚フィードバックを実現する「ゆらぎ付き円運動系の力覚ベクトル」機能を提供します。

### 4.2 主要機能

- **円運動生成**: 0.2-0.6Hzの低周波回転で自然な力覚ベクトル
- **1/f風ゆらぎ**: ローパスフィルタによる自然なノイズパターン
- **マッサージモード**: 振幅変調と方向ゆらぎによる心地よい触感
- **複数プリセット**: gentle, strong, slowなど用途別の振動パターン

### 4.3 実装モジュール

- `modulation.py`: 各種変調器（CircularMotionGenerator, AmplitudeModulator等）
- `massage_controller.py`: マッサージ波形制御
- `force_generator.py`: 力覚生成インターフェース

### 4.4 WebSocket API 統合

#### 4.4.1 WebSocketエンドポイント拡張

```python
# backend/main.py への追加
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json
import time

@app.websocket("/ws/massage")
async def websocket_massage_endpoint(websocket: WebSocket):
    """マッサージ機能専用WebSocketエンドポイント"""
    await websocket.accept()
    
    # クライアント管理に追加
    massage_ws_manager.add_connection(websocket)
    
    try:
        # ハートビート開始
        asyncio.create_task(start_massage_heartbeat(websocket))
        
        # メッセージループ
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # バージョンチェック
            if message.get("version") != "1.0":
                await websocket.send_json({
                    "version": "1.0",
                    "type": "error",
                    "timestamp": int(time.time() * 1000),
                    "data": {
                        "error_code": "VERSION_MISMATCH",
                        "message": f"Unsupported version: {message.get('version')}"
                    }
                })
                continue
                
            # メッセージ処理
            await handle_massage_websocket_message(websocket, message)
            
    except WebSocketDisconnect:
        massage_ws_manager.remove_connection(websocket)

async def handle_massage_websocket_message(websocket: WebSocket, message: dict):
    """マッサージWebSocketメッセージの処理"""
    msg_type = message.get("type")
    data = message.get("data", {})
    
    try:
        if msg_type == "apply_pattern":
            # パターン適用
            result = await massage_controller.apply_pattern(
                preset=data.get("preset"),
                device_ids=data.get("device_ids", [1, 2]),
                duration=data.get("duration"),
                fade_in=data.get("fade_in", 0.5)
            )
            
            # 全クライアントに通知
            await massage_ws_manager.broadcast({
                "version": "1.0",
                "type": "status_update",
                "timestamp": int(time.time() * 1000),
                "data": {
                    "massage_mode": True,
                    "current_preset": data.get("preset"),
                    "active_devices": data.get("device_ids", [1, 2])
                }
            })
            
        elif msg_type == "update_circular_motion":
            # 円運動パラメータ更新
            await massage_controller.update_circular_motion(data)
            
            # パラメータ更新を通知
            await massage_ws_manager.broadcast({
                "version": "1.0",
                "type": "parameter_update",
                "timestamp": int(time.time() * 1000),
                "data": data
            })
            
        elif msg_type == "preview_pattern":
            # パターンプレビュー
            await massage_controller.preview_pattern(
                preset=data.get("preset"),
                device_ids=data.get("deviceIds", [1]),
                duration=data.get("duration", 3.0)
            )
            
    except Exception as e:
        await websocket.send_json({
            "version": "1.0",
            "type": "error",
            "timestamp": int(time.time() * 1000),
            "data": {
                "error_code": "PROCESSING_ERROR",
                "message": str(e)
            }
        })

async def start_massage_heartbeat(websocket: WebSocket):
    """マッサージWebSocketハートビート"""
    while True:
        try:
            await websocket.send_json({
                "version": "1.0",
                "type": "heartbeat",
                "timestamp": int(time.time() * 1000),
                "data": {
                    "interval": 5000,
                    "server_time": int(time.time() * 1000)
                }
            })
            await asyncio.sleep(5)
        except:
            break
```

#### 4.4.2 WebSocket接続管理

```python
# backend/api/websocket_manager.py
class MassageWebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        
    def add_connection(self, websocket: WebSocket):
        self.active_connections.append(websocket)
        
    def remove_connection(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
    async def broadcast(self, message: dict):
        """全接続クライアントにメッセージブロードキャスト"""
        if self.active_connections:
            await asyncio.gather(
                *[conn.send_json(message) for conn in self.active_connections],
                return_exceptions=True
            )

# グローバルインスタンス
massage_ws_manager = MassageWebSocketManager()
```

### 4.5 REST API エンドポイント拡張

#### 4.5.1 新規エンドポイント

```python
# backend/api/routes.py への追加
from .massage_routes import router as massage_router

# マッサージ関連APIルート追加
app.include_router(massage_router)

@app.post("/api/circular-motion")
async def set_circular_motion_legacy(
    device_id: int,
    rotation_freq: float = 0.33,
    fluctuation_amplitude: float = 10.0,
    enable_fm: bool = True
):
    """円運動パラメータ設定（簡易版）"""
    try:
        await massage_controller.set_circular_motion(
            device_id=device_id,
            rotation_freq=rotation_freq,
            fluctuation_amplitude=fluctuation_amplitude,
            enable_fm=enable_fm
        )
        
        # WebSocketで通知
        await massage_ws_manager.broadcast({
            "version": "1.0",
            "type": "parameter_update",
            "timestamp": int(time.time() * 1000),
            "data": {
                "device_id": device_id,
                "rotation_freq": rotation_freq,
                "fluctuation_amplitude": fluctuation_amplitude,
                "enable_fm": enable_fm
            }
        })
        
        return {
            "status": "success",
            "device_id": device_id,
            "parameters": {
                "rotation_freq": rotation_freq,
                "fluctuation_amplitude": fluctuation_amplitude,
                "enable_fm": enable_fm
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## 5. フロントエンド拡張設計

### 5.1 CircularTrajectory コンポーネント統合

```typescript
// frontend/components/Visualization/CircularTrajectory.tsx への統合
import { CircularTrajectory } from './CircularTrajectory';
import { MassagePatternSelector } from '../Control/MassagePatternSelector';

// メインアプリケーションに統合
const App: React.FC = () => {
    const { massageEnabled } = useMassageStore();
    
    return (
        <div className="app-container">
            {/* 既存のUI */}
            <div className="left-panel">
                <ControlPanel />
                
                {/* マッサージ機能追加 */}
                {massageEnabled && (
                    <MassagePatternSelector 
                        deviceIds={[1, 2]}
                        onPatternChange={(preset, params) => {
                            console.log(`Applied pattern: ${preset}`, params);
                        }}
                    />
                )}
            </div>
            
            <div className="right-panel">
                <WaveformDisplay />
                
                {/* 円運動軌跡表示追加 */}
                {massageEnabled ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CircularTrajectory deviceId={1} />
                        <CircularTrajectory deviceId={2} />
                    </div>
                ) : (
                    <XYTrajectory />
                )}
            </div>
        </div>
    );
};
```

### 5.2 WebSocketService統合

```typescript
// frontend/hooks/useMassageWebSocket.ts
import { useEffect, useRef } from 'react';
import { useMassageStore } from '../stores/massageStore';
import { MassageWebSocketService } from '../services/WebSocketService';

export const useMassageWebSocket = () => {
    const { connect, disconnect, connected, wsService } = useMassageStore();
    const connectionAttempted = useRef(false);
    
    useEffect(() => {
        if (!connectionAttempted.current) {
            connectionAttempted.current = true;
            connect().catch(error => {
                console.error('Failed to establish WebSocket connection:', error);
            });
        }
        
        return () => {
            if (connected) {
                disconnect();
            }
        };
    }, []);
    
    const applyPattern = async (request: any) => {
        await wsService.applyPattern(request);
    };
    
    const previewPattern = async (preset: string, deviceIds: number[], duration: number) => {
        await wsService.previewPattern(preset, deviceIds, duration);
    };
    
    const stopPreview = async () => {
        await wsService.send('stop_preview', {});
    };
    
    return {
        connected,
        applyPattern,
        previewPattern,
        stopPreview
    };
};
```

### 5.3 状態管理拡張

```typescript
// frontend/stores/hapticStore.ts への拡張
interface HapticState {
    // 既存の状態...
    
    // マッサージ機能追加
    massageEnabled: boolean;
    massageParameters: {
        device1: MassageParams;
        device2: MassageParams;
    };
    
    // アクション追加
    toggleMassageMode: (enabled: boolean) => void;
    updateMassageParameters: (deviceId: number, params: MassageParams) => void;
}

// Zustand store拡張
export const useHapticStore = create<HapticState>((set, get) => ({
    // 既存の状態...
    
    massageEnabled: false,
    massageParameters: {
        device1: {
            rotation_freq: 0.33,
            fluctuation_amplitude: 10.0,
            envelope_depth: 0.25,
            base_amplitude: 1.0
        },
        device2: {
            rotation_freq: 0.33,
            fluctuation_amplitude: 10.0,
            envelope_depth: 0.25,
            base_amplitude: 1.0
        }
    },
    
    toggleMassageMode: (enabled: boolean) => {
        set({ massageEnabled: enabled });
        
        // WebSocket経由で通知
        if (enabled) {
            // マッサージモードに切り替え
        } else {
            // 基本モードに戻す
        }
    },
    
    updateMassageParameters: (deviceId: number, params: MassageParams) => {
        set(state => ({
            massageParameters: {
                ...state.massageParameters,
                [`device${deviceId}`]: { ...state.massageParameters[`device${deviceId}` as keyof typeof state.massageParameters], ...params }
            }
        }));
    }
}));
```

### 5.4 パフォーマンス最適化コンポーネント

```typescript
// frontend/components/Performance/PerformanceIndicator.tsx
import React from 'react';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';

export const PerformanceIndicator: React.FC = () => {
    const { metrics, alerts } = usePerformanceMonitor();
    
    const getLatencyColor = (latency: number) => {
        if (latency < 5) return 'text-green-500';
        if (latency < 10) return 'text-yellow-500';
        return 'text-red-500';
    };
    
    return (
        <div className="performance-indicator p-3 bg-gray-800 text-white rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Performance</h4>
            
            <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                    <span>WebSocket RTT:</span>
                    <span className={getLatencyColor(metrics.websocket_rtt)}>
                        {metrics.websocket_rtt?.toFixed(1)}ms
                    </span>
                </div>
                
                <div className="flex justify-between">
                    <span>Waveform Gen:</span>
                    <span className={getLatencyColor(metrics.waveform_generation)}>
                        {metrics.waveform_generation?.toFixed(1)}ms
                    </span>
                </div>
                
                <div className="flex justify-between">
                    <span>UI FPS:</span>
                    <span className={metrics.ui_fps > 50 ? 'text-green-500' : 'text-yellow-500'}>
                        {Math.round(metrics.ui_fps)}
                    </span>
                </div>
            </div>
            
            {alerts.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="text-red-400 text-xs">
                        {alerts.map((alert, idx) => (
                            <div key={idx}>⚠️ {alert}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
```

## 6. システムパフォーマンス要件

### 6.1 レイテンシ仕様

| コンポーネント | 目標値 | 許容値 | 測定方法 |
|---------------|--------|--------|----------|
| **WebSocket通信** | <3ms平均 | <5ms (99%ile) | クライアント-サーバーRTT |
| **波形生成処理** | <8ms平均 | <10ms (99%ile) | 生成開始-完了時間 |
| **UI描画更新** | >60fps目標 | >30fps最小 | requestAnimationFrame |
| **パラメータ変更反映** | <50ms | <100ms | 操作-反映時間 |

### 6.2 スループット仕様

| 項目 | 要求値 | 備考 |
|------|--------|------|
| WebSocketメッセージ処理 | >100 msg/sec | バーストトラフィック対応 |
| 同時WebSocket接続 | >10 connections | マルチクライアント対応 |
| パラメータ更新頻度 | >20 Hz | リアルタイム制御 |
| 波形データポイント | >20K samples/sec | 高品質音声出力 |

### 6.3 リソース使用量制限

| リソース | 制限値 | モニタリング方法 |
|----------|--------|-----------------|
| CPU使用率 | <25%平均 | システムプロファイラ |
| メモリ使用量 | <500MB | プロセスメモリ監視 |
| WebGLメモリ | <100MB | WebGL context情報 |
| ネットワーク帯域 | <10Mbps | パケット統計 |

### 6.4 パフォーマンス監視実装

```python
# backend/monitoring/performance_monitor.py
import time
import psutil
from typing import Dict, Any
import asyncio
from collections import deque

class PerformanceMonitor:
    def __init__(self, window_size: int = 1000):
        self.metrics = {
            'waveform_generation': deque(maxlen=window_size),
            'websocket_rtt': deque(maxlen=window_size),
            'cpu_usage': deque(maxlen=window_size),
            'memory_usage': deque(maxlen=window_size)
        }
        self.thresholds = {
            'waveform_generation': 10.0,  # ms
            'websocket_rtt': 5.0,  # ms
            'cpu_usage': 25.0,  # %
            'memory_usage': 500.0  # MB
        }
    
    def record_waveform_generation(self, duration_ms: float):
        self.metrics['waveform_generation'].append(duration_ms)
    
    def record_websocket_rtt(self, rtt_ms: float):
        self.metrics['websocket_rtt'].append(rtt_ms)
    
    def update_system_metrics(self):
        """システムメトリクスを更新"""
        cpu_percent = psutil.cpu_percent(interval=None)
        memory_info = psutil.virtual_memory()
        memory_mb = memory_info.used / (1024 * 1024)
        
        self.metrics['cpu_usage'].append(cpu_percent)
        self.metrics['memory_usage'].append(memory_mb)
    
    def get_statistics(self) -> Dict[str, Any]:
        """パフォーマンス統計を取得"""
        stats = {}
        for metric_name, values in self.metrics.items():
            if values:
                values_list = list(values)
                sorted_values = sorted(values_list)
                stats[metric_name] = {
                    'avg': sum(values_list) / len(values_list),
                    'min': sorted_values[0],
                    'max': sorted_values[-1],
                    'p95': sorted_values[int(len(sorted_values) * 0.95)],
                    'p99': sorted_values[int(len(sorted_values) * 0.99)],
                    'current': values_list[-1]
                }
        return stats
    
    def check_thresholds(self) -> list[str]:
        """閾値チェックとアラート生成"""
        alerts = []
        stats = self.get_statistics()
        
        for metric, threshold in self.thresholds.items():
            if metric in stats:
                current = stats[metric]['current']
                if current > threshold:
                    alerts.append(f"{metric} exceeds threshold: {current:.2f} > {threshold}")
        
        return alerts

# グローバルモニターインスタンス
perf_monitor = PerformanceMonitor()

# 定期的なシステムメトリクス更新
async def update_system_metrics_periodically():
    while True:
        perf_monitor.update_system_metrics()
        await asyncio.sleep(1)

# FastAPIアプリケーション起動時に開始
@app.on_event("startup")
async def start_performance_monitoring():
    asyncio.create_task(update_system_metrics_periodically())

# パフォーマンス統計API
@app.get("/api/performance")
async def get_performance_stats():
    stats = perf_monitor.get_statistics()
    alerts = perf_monitor.check_thresholds()
    return {
        "statistics": stats,
        "alerts": alerts,
        "timestamp": time.time()
    }
```

### 6.5 パフォーマンステスト自動化

```python
# tests/performance/test_performance.py
import pytest
import asyncio
import time
from ..massage_controller import MassageWaveformController

class TestPerformanceRequirements:
    
    @pytest.mark.asyncio
    async def test_waveform_generation_latency(self):
        """波形生成レイテンシテスト"""
        controller = MassageWaveformController()
        
        # 100回の生成時間を測定
        latencies = []
        for _ in range(100):
            start = time.perf_counter()
            await controller.generate_massage_waveforms(
                duration=0.1,
                preset="default"
            )
            end = time.perf_counter()
            latencies.append((end - start) * 1000)
        
        # 統計計算
        avg_latency = sum(latencies) / len(latencies)
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]
        
        # 要件チェック
        assert avg_latency < 8.0, f"Average latency {avg_latency:.2f}ms exceeds 8ms"
        assert p99_latency < 10.0, f"99th percentile {p99_latency:.2f}ms exceeds 10ms"
    
    @pytest.mark.asyncio  
    async def test_websocket_throughput(self):
        """WebSocketスループットテスト"""
        # 100 msg/secの送信テスト
        message_count = 100
        start_time = time.time()
        
        # メッセージ送信シミュレーション
        for i in range(message_count):
            # WebSocketメッセージ送信
            await massage_ws_manager.broadcast({
                "type": "parameter_update",
                "data": {"test": i}
            })
        
        end_time = time.time()
        duration = end_time - start_time
        throughput = message_count / duration
        
        assert throughput >= 100, f"Throughput {throughput:.1f} msg/sec below requirement"
    
    def test_memory_usage(self):
        """メモリ使用量テスト"""
        initial_memory = psutil.Process().memory_info().rss / (1024 * 1024)
        
        # 大量の波形生成
        controller = MassageWaveformController()
        for _ in range(10):
            controller.generate_massage_waveforms(duration=1.0)
        
        final_memory = psutil.Process().memory_info().rss / (1024 * 1024)
        memory_increase = final_memory - initial_memory
        
        assert memory_increase < 100, f"Memory increase {memory_increase:.1f}MB too high"
```

## 7. Web UI 統合設計

### 7.1 メインアプリケーション (frontend/App.tsx)

```typescript
import React, { useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { WaveformDisplay } from './components/WaveformDisplay';
import { XYTrajectory } from './components/XYTrajectory';
import { useAPIClient } from './hooks/useAPIClient';

function App() {
  const { sendParameters, fetchWaveform } = useAPIClient();

  useEffect(() => {
    connect('ws://localhost:8000/ws');
    return () => disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Sawtooth Haptic Device Controller
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：コントロールパネル */}
          <div className="lg:col-span-1">
            <ControlPanel />
          </div>
          
          {/* 右側：可視化 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 右上：波形表示 */}
            <WaveformDisplay />
            
            {/* 右下：XY軌跡 */}
            <XYTrajectory />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
```

### 5.2 API Client Hook (frontend/hooks/useAPIClient.ts)

```typescript
import { useCallback, useRef, useEffect } from 'react';
import { useParameterStore } from '../stores/parameterStore';
import { useWaveformStore } from '../stores/waveformStore';

export const useAPIClient = () => {
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const reconnectTimer = useRef<NodeJS.Timeout>();
  const { parameters } = useParameterStore();
  const { setWaveformData, setXYTrajectory } = useWaveformStore();

  const sendParameters = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update_parameters',
          parameters
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'waveform_update') {
        setWaveformData(data.data.waveforms);
        setXYTrajectory(data.data.xy_trajectory);
      }
    };

      });
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
        connect(url);
      }, 3000);
    };

    }
  }, [parameters]);

  return { sendParameters, fetchWaveform };
        parameters
      }));
    }
  }, [parameters]);

  // パラメータ変更時に自動送信
  useEffect(() => {
    sendParameters();
  }, [parameters, sendParameters]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    ws.current?.close();
  }, []);

  return { connect, disconnect, sendMessage: sendParameters };
};
```

## 6. パフォーマンス最適化

### 6.1 Numba JIT最適化

重要な処理ループはNumbaでコンパイル：

```python
@numba.jit(nopython=True, cache=True, parallel=True)
def process_multichannel_sawtooth(
    frames: int,
    channels: int,
    frequencies: np.ndarray,
    amplitudes: np.ndarray,
    phases: np.ndarray,
    polarities: np.ndarray,
    sample_rate: float
) -> np.ndarray:
    """マルチチャンネルノコギリ波処理（並列化）"""
    output = np.zeros((frames, channels), dtype=np.float32)
    
    for ch in numba.prange(channels):  # 並列ループ
        if amplitudes[ch] > 0:
            # BLIT処理
            output[:, ch] = generate_blit_sawtooth_optimized(
                frames,
                frequencies[ch],
                phases[ch],
                polarities[ch],
                sample_rate
            ) * amplitudes[ch]
            
    return output
```

### 6.2 メモリ管理

```python
class BufferPool:
    """事前割り当てバッファプール"""
    
    def __init__(self, buffer_size: int, num_buffers: int = 10):
        self.buffers = [
            np.zeros(buffer_size, dtype=np.float32)
            for _ in range(num_buffers)
        ]
        self.available = list(range(num_buffers))
        self.lock = threading.Lock()
        
    def acquire(self) -> np.ndarray:
        """バッファ取得"""
        with self.lock:
            if self.available:
                idx = self.available.pop()
                return self.buffers[idx]
        # フォールバック
        return np.zeros(self.buffer_size, dtype=np.float32)
```

### 6.3 ロックフリーリングバッファ

```python
class LockFreeRingBuffer:
    """ロックフリーリングバッファ実装"""
    
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.buffer = np.zeros(capacity, dtype=np.float32)
        self.write_pos = 0
        self.read_pos = 0
        
    def write(self, data: np.ndarray) -> bool:
        """ノンブロッキング書き込み"""
        # Compare-and-swap実装
        pass
        
    def read(self, size: int) -> Optional[np.ndarray]:
        """ノンブロッキング読み込み"""
        # Atomic read実装
        pass
```

## 7. テスト戦略

### 7.1 単体テスト

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

### 7.2 統合テスト

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

### 7.3 パフォーマンステスト

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

### 7.4 マッサージ機能テスト

マッサージ機能の詳細なテスト戦略については、[テスト戦略設計書](test_strategy.md#4-マッサージ機能テスト)を参照してください。

## 8. 設定ファイル

### 8.1 pyproject.toml

```toml
[project]
name = "sawtooth-haptic-device"
version = "1.0.0"
description = "High-quality sawtooth wave generator for haptic actuators"
authors = [{name = "Your Name", email = "your.email@example.com"}]
requires-python = ">=3.11"
readme = "README.md"
license = {text = "MIT"}
keywords = ["haptics", "audio", "signal-processing", "real-time"]

dependencies = [
    "numpy>=2.1",
    "scipy>=1.16",
    "pyaudio>=0.2.15",
    "numba>=0.61",
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
]

[project.optional-dependencies]
test = [
    "pytest>=8.3",
    "pytest-benchmark>=4.0",
    "pytest-cov>=5.0",
    "pytest-asyncio>=0.24",
]
dev = [
    "ruff>=0.9",
    "mypy>=1.14",
    "pre-commit>=4.0",
]
docs = [
    "sphinx>=8.0",
    "sphinx-rtd-theme>=3.0",
    "sphinx-autodoc-typehints>=2.5",
]

[tool.ruff]
target-version = "py311"
line-length = 100
indent-width = 4

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "C90", "PL"]
ignore = ["E501"]  # line too long (handled by formatter)

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
no_implicit_optional = true

[tool.pytest.ini_options]
minversion = "8.0"
addopts = [
    "-ra",
    "--strict-markers",
    "--strict-config",
    "--cov=src/sawtooth_haptic",
]
testpaths = ["tests"]
markers = [
    "slow: marks tests as slow",
    "realtime: real-time performance tests",
    "hardware: requires actual hardware",
]

[tool.coverage.run]
branch = true
source = ["src/sawtooth_haptic"]

[tool.coverage.report]
precision = 2
show_missing = true
skip_covered = false

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.sdist]
include = [
    "src/",
    "tests/",
    "README.md",
    "LICENSE",
]

[tool.hatch.build.targets.wheel]
packages = ["src/sawtooth_haptic"]
```

### 8.2 package.json

```json
{
  "name": "sawtooth-haptic-ui",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@observablehq/plot": "^0.6.16",
    "d3": "^7.9.0",
    "zustand": "^5.0.0",
    "@headlessui/react": "^2.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/d3": "^7.4.3",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "tailwindcss": "^3.4.15",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49"
  }
}
```

### 8.3 開発サーバー起動スクリプト

```python
# scripts/start_dev.py
import subprocess
import os
import sys
import time
import signal

def start_backend():
    """FastAPIサーバー起動"""
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "src.backend.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )

def start_frontend():
    """Vite開発サーバー起動"""
    return subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )

def main():
    print("🚀 Starting Sawtooth Haptic Device Development Server...")
    
    # バックエンド起動
    backend = start_backend()
    print("✅ Backend server started at http://localhost:8000")
    
    # 少し待ってからフロントエンド起動
    time.sleep(2)
    frontend = start_frontend()
    print("✅ Frontend server started at http://localhost:5173")
    
    print("\n🎆 Development servers are running!")
    print("   Backend API: http://localhost:8000")
    print("   Frontend UI: http://localhost:5173")
    print("\nPress Ctrl+C to stop...")
    
    # Ctrl+Cで両方を終了
    def signal_handler(sig, frame):
        print("\n🛑 Stopping servers...")
        backend.terminate()
        frontend.terminate()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    # プロセスが終了するまで待機
    backend.wait()
    frontend.wait()

if __name__ == "__main__":
    main()
```

## 9. 使用例

### 9.1 基本的な使用例

```python
# examples/basic_sawtooth.py
from sawtooth_haptic import SawtoothActuator

# アクチュエータ初期化
actuator = SawtoothActuator(
    sample_rate=44100,
    buffer_size=256,
    enable_feedback=True
)

# チャンネル1に60Hzのノコギリ波を設定
actuator.set_channel_sawtooth(
    channel=0,
    frequency=60,
    amplitude=0.8,
    phase=0,
    polarity=True  # 上昇波形
)

# チャンネル2に反転したノコギリ波
actuator.set_channel_sawtooth(
    channel=1,
    frequency=60,
    amplitude=0.8,
    phase=0,
    polarity=False  # 下降波形（反転）
)

# 再生開始
actuator.start()
input("Press Enter to stop...")
actuator.stop()
```

### 9.2 ベクトル力覚の例

```python
# examples/vector_force_demo.py
import time
import math
from sawtooth_haptic import SawtoothActuator

actuator = SawtoothActuator()

# 円運動する力覚
for t in range(360):
    angle = t  # 度
    magnitude = 0.8
    
    actuator.set_vector_force(
        device=0,
        angle=angle,
        magnitude=magnitude,
        frequency=10  # 10Hz基準
    )
    
    time.sleep(0.1)  # 100ms毎に更新
    
actuator.stop()
```

### 9.3 Web UIの使用例

```bash
# 開発環境の起動
python scripts/start_dev.py

# ブラウザで http://localhost:5173 を開く
```

Web UIの操作:
1. **左側パネル**: 各チャンネルのパラメータ調整
   - 周波数スライダー: 40-120Hz
   - 振幅スライダー: 0-100%
   - 位相スライダー: 0-360°
   - 極性トグル: 上昇/下降波形

2. **右上グラフ**: 4チャンネルの波形をリアルタイム表示
   - 5周期分の波形を色別で重ね合わせ表示
   - 60fpsでスムーズに更新

3. **右下XY軌跡**: デバイス1のXY加速度軌跡
   - ベクトル力覚の方向を可視化
   - グラデーション付き軌跡表示

## 10. まとめ

本設計書では、ノコギリ波出力デバイスのソフトウェア実装について、以下の要素を定義しました：

### 10.1 主要機能の実現
1. **周波数可変制御**: 40-120Hzの範囲で各チャンネル独立制御
2. **360度ベクトル力覚**: 位相差と極性反転による全方向力覚提示
3. **Web UI統合**: リアルタイム波形表示とパラメータ制御
4. **ローカル実行**: localhost完結型のシステム設計

### 10.2 技術的特徴
1. **低レイテンシアーキテクチャ**: PyAudio + Numbaによる10ms以下の応答
2. **高品質波形生成**: BLITアルゴリズムによるアンチエイリアス
3. **リアルタイム可視化**: Observable Plot + D3.jsによる60fps描画
4. **HTTP API通信**: RESTful APIによるデータ転送
5. **適応制御システム**: 2kHzフィードバックループ
6. **安全機能**: 自動共振検出と保護

### 10.3 使用技術スタック
- **バックエンド**: Python 3.11+, FastAPI, PyAudio, Numba, uv
- **フロントエンド**: React 18+, Vite, TypeScript, TailwindCSS
- **可視化**: Observable Plot, D3.js
- **通信**: HTTP/REST API

### 10.4 高度な触覚フィードバック機能（新規追加）
1. **ゆらぎ付き円運動**: 0.2-0.6Hzの低周波回転で自然な力覚ベクトル生成
2. **1/f風ゆらぎ**: ローパスフィルタによる自然なノイズパターン
3. **マッサージモード**: 振幅変調と方向ゆらぎによる心地よい触感
4. **複数プリセット**: gentle, strong, slowなど用途別の振動パターン
5. **リアルタイム制御**: WebSocket経由での動的パラメータ更新
6. **機械共振活用**: 180Hz共振特性を考慮した加速度応答

これらの設計により、要件定義書で定められた全ての機能要件と性能要件を満たし、さらに高度なマッサージ機能を備えた直感的な操作性のシステムの実装が可能となります。