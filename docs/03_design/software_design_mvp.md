# 二軸振動触覚システム ソフトウェア設計書（MVP版）

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
- **REST API + WebSocket**: HTTPとWebSocketによるハイブリッド通信
- **迅速な開発**: プロトタイプとしての検証に注力

### 1.4 技術スタック
- **バックエンド**: Python (uv管理), FastAPI, NumPy
- **フロントエンド**: React, react-chartjs-2
- **通信**: REST API (HTTP/JSON) + WebSocket (リアルタイム通信)
- **パッケージ管理**: uv (Python), npm (JavaScript)

## 2. システムアーキテクチャ

### 2.1 全体構成（MVP）
```
┌─────────────────────────────────────────────────┐
│           React UI (localhost:3000)              │
│  ├── ControlPanel: パラメータ制御                  │
│  ├── WaveformChart: リアルタイム4ch波形表示        │
│  └── XYTrajectory: XY軌跡表示（将来）             │
├─────────────────────────────────────────────────┤
│    REST API (HTTP/JSON) + WebSocket (/ws)       │
│  ├── HTTP: パラメータ設定・制御                   │
│  └── WebSocket: リアルタイム波形データ配信         │
├─────────────────────────────────────────────────┤
│         FastAPI Server (localhost:8000)          │
│  ├── 波形生成エンジン（サンプルコードベース）        │
│  ├── 共振シミュレーション                         │
│  ├── パラメータ管理                              │
│  └── WebSocket接続管理・ブロードキャスト           │
├──────────┬──────────┬──────────┬──────────────┤
│  Ch1(X1) │  Ch2(Y1) │  Ch3(X2) │   Ch4(Y2)   │
├──────────┴──────────┼──────────┴──────────────┤
│    デバイス1         │      デバイス2           │
│  (2軸アクチュエータ)  │   (2軸アクチュエータ)    │
└─────────────────────┴─────────────────────────┘
```

### 2.2 データフロー（MVP）

#### パラメータ制御フロー
```
Web UI (パラメータ設定)
    ↓
[REST API] PUT /api/parameters
    ↓
[FastAPI Server] パラメータ検証・保存
    ↓
[WebSocket Broadcast] PARAMETERS_UPDATE
    ↓
[Web UI] リアルタイムパラメータ更新
```

#### リアルタイム波形配信フロー
```
[Background Task] 100ms間隔で実行
    ↓
[Waveform Generator] サンプルコードベースの波形生成
    ↓
[WebSocket Broadcast] WAVEFORM_DATA
    ↓
[Web UI] react-chartjs-2でリアルタイム波形表示
```

#### ストリーミング制御フロー
```
Web UI (開始/停止)
    ↓
[REST API] POST /api/streaming/start|stop
    ↓
[FastAPI Server] ストリーミング状態変更
    ↓
[WebSocket Broadcast] STATUS_UPDATE
    ↓
[Web UI] ストリーミング状態表示更新
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
REST APIとWebSocketエンドポイントを提供するFastAPIサーバー。リアルタイム通信機能を含む。

```python
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any

from .api.routes import router
from .core.waveform import generate_multichannel_waveform
from .models.parameters import SystemParameters, WaveformRequest
from haptic_system.controller import HapticController

# WebSocket message types
class WSMessageType:
    PARAMETERS_UPDATE = "parameters_update"
    WAVEFORM_DATA = "waveform_data"
    STATUS_UPDATE = "status_update"
    ERROR = "error"

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.active_connections.append(websocket)
    
    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        
        async with self.lock:
            disconnected = []
            for connection in self.active_connections[:]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    disconnected.append(connection)
            
            for conn in disconnected:
                if conn in self.active_connections:
                    self.active_connections.remove(conn)

manager = ConnectionManager()

# Background task for waveform streaming
async def background_waveform_streamer():
    while True:
        try:
            if (controller and controller.is_streaming and 
                manager.active_connections):
                
                # Generate and broadcast waveform data
                # ... waveform generation logic ...
                await broadcast_waveform_data(waveform_data)
                
            await asyncio.sleep(0.1)  # 100ms interval
        except Exception as e:
            logger.error(f"Error in background streamer: {e}")
            await asyncio.sleep(0.1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background waveform streaming task
    waveform_task = asyncio.create_task(background_waveform_streamer())
    yield
    # Cleanup
    waveform_task.cancel()

app = FastAPI(
    title="Yuragi Haptic Generator API",
    version="0.1.0",
    description="Sawtooth wave-based haptic feedback system API",
    lifespan=lifespan
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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await manager.connect(websocket)
    
    try:
        # Send initial status to newly connected client
        if controller:
            initial_status = {
                "type": WSMessageType.STATUS_UPDATE,
                "data": {
                    "isStreaming": controller.is_streaming,
                    "sampleRate": controller.sample_rate,
                    "blockSize": controller.block_size,
                    "latencyMs": controller.get_latency_ms()
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            await manager.send_personal_message(initial_status, websocket)
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                message = await websocket.receive_text()
                # Handle client messages if needed
                pass
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        await manager.disconnect(websocket)

# Helper functions for WebSocket broadcasting
async def broadcast_parameters_update(channels_data):
    message = {
        "type": WSMessageType.PARAMETERS_UPDATE,
        "data": {"channels": channels_data},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await manager.broadcast(message)

async def broadcast_status_update(status_data):
    message = {
        "type": WSMessageType.STATUS_UPDATE,
        "data": status_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await manager.broadcast(message)

async def broadcast_waveform_data(waveform_data):
    message = {
        "type": WSMessageType.WAVEFORM_DATA,
        "data": waveform_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await manager.broadcast(message)

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

@router.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy"}

@router.put("/channels/{channel_id}")
async def update_channel(
    channel_id: int,
    params: ChannelParameters
):
    """
    個別チャンネルのパラメータ更新
    
    Args:
        channel_id: チャンネルID (0-3)
        params: チャンネルパラメータ
    """
    if channel_id < 0 or channel_id > 3:
        raise HTTPException(status_code=400, detail="Invalid channel ID")
    
    # パラメータ更新ロジックはmain.pyで処理
    return {"status": "updated", "channel_id": channel_id}

# OpenAPIスキーマ情報
router.tags = ["Sawtooth Haptic Device"]
router.responses = {
    400: {"description": "Bad request"},
    500: {"description": "Internal server error"}
}
```

## 4. フロントエンド設計

### 4.1 メインアプリケーション (frontend/src/App.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { WaveformChart } from './components/WaveformChart';
import { useApi } from './hooks/useApi';
import './App.css';

function App() {
  const { parameters, updateParameters, waveformData, fetchWaveform } = useApi();

  useEffect(() => {
    // 定期的に波形データを取得
    const interval = setInterval(() => {
      fetchWaveform();
    }, 100); // 100msごと

    return () => clearInterval(interval);
  }, [fetchWaveform]);

  return (
    <div className="App">
      <h1>Sawtooth Haptic Device Controller</h1>
      <div className="container">
        <div className="control-section">
          <ControlPanel 
            parameters={parameters} 
            onChange={updateParameters} 
          />
        </div>
        <div className="waveform-section">
          <WaveformChart data={waveformData} />
        </div>
      </div>
    </div>
  );
}

export default App;
```

### 4.2 コントロールパネル (frontend/src/components/ControlPanel.tsx)

```typescript
import React from 'react';

interface ChannelControlProps {
  channel: number;
  params: any;
  onChange: (channel: number, params: any) => void;
}

const ChannelControl: React.FC<ChannelControlProps> = ({ channel, params, onChange }) => {
  const handleChange = (field: string, value: any) => {
    onChange(channel, { ...params, [field]: value });
  };

  return (
    <div className="channel-control">
      <h3>Channel {channel + 1}</h3>
      <div>
        <label>
          Frequency (Hz):
          <input
            type="range"
            min="40"
            max="120"
            step="0.1"
            value={params.frequency}
            onChange={(e) => handleChange('frequency', parseFloat(e.target.value))}
          />
          <span>{params.frequency.toFixed(1)}</span>
        </label>
      </div>
      <div>
        <label>
          Amplitude:
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.amplitude}
            onChange={(e) => handleChange('amplitude', parseFloat(e.target.value))}
          />
          <span>{params.amplitude.toFixed(2)}</span>
        </label>
      </div>
      <div>
        <label>
          Phase (°):
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={params.phase}
            onChange={(e) => handleChange('phase', parseFloat(e.target.value))}
          />
          <span>{params.phase.toFixed(0)}</span>
        </label>
      </div>
      <div>
        <label>
          Polarity:
          <input
            type="checkbox"
            checked={params.polarity}
            onChange={(e) => handleChange('polarity', e.target.checked)}
          />
          {params.polarity ? 'Rising' : 'Falling'}
        </label>
      </div>
    </div>
  );
};

export const ControlPanel: React.FC<any> = ({ parameters, onChange }) => {
  return (
    <div className="control-panel">
      <h2>Channel Controls</h2>
      {parameters.channels.map((params: any, idx: number) => (
        <ChannelControl
          key={idx}
          channel={idx}
          params={params}
          onChange={onChange}
        />
      ))}
    </div>
  );
};
```

### 4.3 波形表示 (frontend/src/components/WaveformChart.tsx)

```typescript
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export const WaveformChart: React.FC<{ data: any }> = ({ data }) => {
  if (!data || !data.channels) {
    return <div>Loading...</div>;
  }

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F'];
  
  const chartData = {
    labels: Array.from({ length: data.channels[0].data.length }, (_, i) => i),
    datasets: data.channels.map((channel: any, idx: number) => ({
      label: `Channel ${idx + 1}`,
      data: channel.data,
      borderColor: colors[idx],
      backgroundColor: colors[idx] + '20',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1
    }))
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Waveform Display'
      }
    },
    scales: {
      y: {
        min: -1,
        max: 1
      }
    }
  };

  return <Line data={chartData} options={options} />;
};
```

### 4.4 API通信フック (frontend/src/hooks/useApi.ts)

```typescript
import { useState, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8000';

export const useApi = () => {
  const [parameters, setParameters] = useState({
    channels: [
      { channel_id: 0, frequency: 60, amplitude: 0, phase: 0, polarity: true },
      { channel_id: 1, frequency: 60, amplitude: 0, phase: 0, polarity: true },
      { channel_id: 2, frequency: 60, amplitude: 0, phase: 0, polarity: true },
      { channel_id: 3, frequency: 60, amplitude: 0, phase: 0, polarity: true }
    ]
  });
  
  const [waveformData, setWaveformData] = useState(null);

  const updateParameters = useCallback(async (channel: number, params: any) => {
    const newParams = { ...parameters };
    newParams.channels[channel] = { ...newParams.channels[channel], ...params };
    setParameters(newParams);
    
    // APIに送信
    await fetch(`${API_BASE_URL}/api/parameters`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newParams)
    });
  }, [parameters]);

  const fetchWaveform = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/waveform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: 0.1, sample_rate: 44100 })
      });
      const data = await response.json();
      setWaveformData(data);
    } catch (error) {
      console.error('Error fetching waveform:', error);
    }
  }, []);

  return { parameters, updateParameters, waveformData, fetchWaveform };
};
```

## 5. 設定ファイル

### 5.1 pyproject.toml

```toml
[project]
name = "sawtooth-haptic-mvp"
version = "0.1.0"
description = "MVP for sawtooth wave haptic device"
requires-python = ">=3.8"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.22.0",
    "numpy>=1.24.0",
    "pydantic>=2.0.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=7.0.0",
    "httpx>=0.24.0",
]
```

### 5.2 package.json

```json
{
  "name": "sawtooth-haptic-frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-chartjs-2": "^5.2.0",
    "chart.js": "^4.4.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  }
}
```

## 6. 起動手順

### バックエンド起動
```bash
cd backend
uv pip install -e .
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### フロントエンド起動
```bash
cd frontend
npm install
npm start
```

## 7. API仕様

### 7.1 REST API エンドポイント

- `GET /api/health` - ヘルスチェック
- `GET /api/parameters` - 現在のパラメータ取得
- `PUT /api/parameters` - パラメータ更新
- `POST /api/waveform` - 波形データ取得
- `PUT /api/channels/{channel_id}` - 個別チャンネル更新
- `POST /api/streaming/start` - ストリーミング開始
- `POST /api/streaming/stop` - ストリーミング停止
- `GET /api/streaming/status` - ストリーミング状態取得
- `POST /api/vector-force` - ベクトル力覚設定

### 7.2 WebSocket エンドポイント

#### WebSocket接続
- **エンドポイント**: `ws://localhost:8000/ws`
- **プロトコル**: JSON メッセージ形式

#### メッセージタイプ

##### PARAMETERS_UPDATE
パラメータが更新された際にブロードキャスト
```json
{
  "type": "parameters_update",
  "data": {
    "channels": [
      {
        "channelId": 0,
        "frequency": 60.0,
        "amplitude": 0.5,
        "phase": 0.0,
        "polarity": true
      }
    ]
  },
  "timestamp": "2024-08-04T12:00:00.000Z"
}
```

##### WAVEFORM_DATA
リアルタイム波形データ（100ms間隔）
```json
{
  "type": "waveform_data",
  "data": {
    "timestamp": "2024-08-04T12:00:00.000Z",
    "sampleRate": 44100,
    "channels": [
      {
        "channelId": 0,
        "data": [0.1, 0.2, 0.3, ...]
      }
    ]
  },
  "timestamp": "2024-08-04T12:00:00.000Z"
}
```

##### STATUS_UPDATE
ストリーミング状態変更時にブロードキャスト
```json
{
  "type": "status_update",
  "data": {
    "isStreaming": true,
    "sampleRate": 44100,
    "blockSize": 512,
    "latencyMs": 8.5
  },
  "timestamp": "2024-08-04T12:00:00.000Z"
}
```

##### ERROR
エラー発生時に送信
```json
{
  "type": "error",
  "data": {
    "message": "Error description"
  },
  "timestamp": "2024-08-04T12:00:00.000Z"
}
```

## 8. まとめ

本MVP設計では、リアルタイム通信機能を含む効果的な実装を行います：

1. **シンプルな波形生成**: サンプルコードベースの実装
2. **ハイブリッド通信**: REST API + WebSocketによる最適な通信方式
3. **リアルタイムUI**: WebSocketによる即座の波形表示更新
4. **バックグラウンドストリーミング**: 100ms間隔での連続的な波形データ配信
5. **マルチクライアント対応**: WebSocket接続管理による複数クライアント同時接続

### 主な改善点

- **レスポンシブUI**: パラメータ変更が即座に反映される
- **効率的な通信**: 必要な時だけHTTP、継続的な更新はWebSocket
- **スケーラブル設計**: 複数のクライアントへの同時ブロードキャスト対応
- **エラーハンドリング**: WebSocket接続の自動管理と復旧

この設計により、プロトタイプの迅速な検証とリアルタイム触覚制御の実現が可能となります。