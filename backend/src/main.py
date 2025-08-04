"""
FastAPI メインアプリケーション
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import numpy as np
from haptic_system.controller import HapticController

# グローバルコントローラーインスタンス
# テストやスタンドアロン実行のため、ここで初期化
try:
    controller = HapticController(sample_rate=44100, block_size=512)
except Exception:
    # sounddeviceがない環境では None のまま
    controller = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    global controller
    # 起動時
    if controller is None:
        controller = HapticController(sample_rate=44100, block_size=512)
    yield
    # 終了時
    if controller and controller.is_streaming:
        controller.stop_streaming()


# FastAPIアプリケーションインスタンス
app = FastAPI(
    title="Yuragi Haptic Generator API",
    description="Sawtooth wave-based haptic feedback system API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切に設定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydanticモデル
class ChannelParameters(BaseModel):
    """単一チャンネルのパラメータ"""
    channel_id: int = Field(..., ge=0, le=3, description="Channel ID (0-3)")
    frequency: float = Field(0.0, ge=0.0, le=120.0, description="Frequency in Hz")
    amplitude: float = Field(0.0, ge=0.0, le=1.0, description="Amplitude (0.0-1.0)")
    phase: float = Field(0.0, ge=0.0, le=360.0, description="Phase in degrees")
    polarity: bool = Field(True, description="Waveform polarity")


class ParametersUpdate(BaseModel):
    """パラメータ更新リクエスト"""
    channels: List[ChannelParameters]


class ChannelUpdate(BaseModel):
    """単一チャンネル更新リクエスト"""
    frequency: Optional[float] = Field(None, ge=0.0, le=120.0)
    amplitude: Optional[float] = Field(None, ge=0.0, le=1.0)
    phase: Optional[float] = Field(None, ge=0.0, le=360.0)
    polarity: Optional[bool] = None


class WaveformRequest(BaseModel):
    """波形データリクエスト"""
    duration: float = Field(0.1, gt=0.0, le=1.0, description="Duration in seconds")
    sample_rate: int = Field(44100, gt=0, description="Sample rate in Hz")


class VectorForceRequest(BaseModel):
    """ベクトル力覚リクエスト"""
    device_id: int = Field(..., description="Device ID (1 or 2)")
    angle: float = Field(..., ge=0.0, le=360.0, description="Angle in degrees")
    magnitude: float = Field(..., ge=0.0, le=1.0, description="Magnitude (0.0-1.0)")
    frequency: float = Field(..., ge=40.0, le=120.0, description="Frequency in Hz")
    
    @field_validator('device_id')
    @classmethod
    def validate_device_id(cls, v):
        if v not in [1, 2]:
            raise ValueError('Device ID must be 1 or 2')
        return v


# ルートエンドポイント
@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "message": "Yuragi Haptic Generator API",
        "version": "0.1.0",
        "docs": "/docs"
    }


# ヘルスチェック
@app.get("/api/health")
async def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy"}


# パラメータ管理
@app.get("/api/parameters")
async def get_parameters():
    """現在のパラメータを取得"""
    if controller is None:
        # デフォルト値を返す
        return {
            "channels": [
                {
                    "channel_id": i,
                    "frequency": 0.0,
                    "amplitude": 0.0,
                    "phase": 0.0,
                    "polarity": True
                }
                for i in range(4)
            ]
        }
    
    params = controller.get_current_parameters()
    return {
        "channels": [
            {
                "channel_id": i,
                "frequency": ch.get("frequency", 0.0),
                "amplitude": ch.get("amplitude", 0.0),
                "phase": ch.get("phase", 0.0),
                "polarity": bool(ch.get("polarity", True))
            }
            for i, ch in enumerate(params.get("channels", [{}] * 4))
        ]
    }


@app.put("/api/parameters")
async def update_parameters(params: ParametersUpdate):
    """パラメータを更新"""
    if controller is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    update_dict = {
        "channels": [
            {
                "channel_id": ch.channel_id,
                "frequency": ch.frequency,
                "amplitude": ch.amplitude,
                "phase": ch.phase,
                "polarity": ch.polarity
            }
            for ch in params.channels
        ]
    }
    controller.update_parameters(update_dict)
    return {"status": "updated"}


# 個別チャンネル制御
@app.put("/api/channels/{channel_id}")
async def update_channel(channel_id: int, params: ChannelUpdate):
    """単一チャンネルを更新"""
    if channel_id < 0 or channel_id > 3:
        raise HTTPException(status_code=400, detail="Invalid channel ID")
    
    if controller is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    # 現在のパラメータを取得
    current = controller.get_current_parameters()
    channels = current.get("channels", [{}] * 4)
    
    # 指定チャンネルのパラメータを更新
    update_dict = params.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            channels[channel_id][key] = value
    
    # 更新を適用
    controller.update_parameters({"channels": channels})
    
    return {
        "channel_id": channel_id,
        "status": "updated"
    }


# 波形データ
@app.post("/api/waveform")
async def get_waveform_data(request: WaveformRequest):
    """波形データを取得"""
    if controller is None:
        # コントローラーが初期化されていない場合はゼロデータを返す
        num_samples = int(request.duration * request.sample_rate)
        return {
            "timestamp": "2024-08-04T00:00:00Z",
            "sample_rate": request.sample_rate,
            "channels": [
                {"channel_id": i, "data": [0.0] * num_samples}
                for i in range(4)
            ]
        }
    
    # サンプル数を計算
    num_samples = int(request.duration * request.sample_rate)
    
    # 現在のパラメータで波形を生成
    channels_data = []
    for ch_id in range(4):
        # 各チャンネルの波形を生成
        channel = controller.device.channels[ch_id]
        waveform_data = channel.get_next_chunk(num_samples).tolist()
        channels_data.append({
            "channel_id": ch_id,
            "data": waveform_data
        })
    
    return {
        "timestamp": "2024-08-04T00:00:00Z",  # 実際にはdatetimeを使用
        "sample_rate": request.sample_rate,
        "channels": channels_data
    }


# ストリーミング制御
@app.post("/api/streaming/start")
async def start_streaming():
    """ストリーミングを開始"""
    if controller is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    if not controller.is_streaming:
        controller.start_streaming()
    return {
        "status": "started",
        "is_streaming": True
    }


@app.post("/api/streaming/stop")
async def stop_streaming():
    """ストリーミングを停止"""
    if controller is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    if controller.is_streaming:
        controller.stop_streaming()
    return {
        "status": "stopped",
        "is_streaming": False
    }


@app.get("/api/streaming/status")
async def get_streaming_status():
    """ストリーミング状態を取得"""
    if controller is None:
        return {
            "is_streaming": False,
            "sample_rate": 44100,
            "block_size": 512,
            "latency_ms": 0.0
        }
    
    return {
        "is_streaming": controller.is_streaming,
        "sample_rate": controller.sample_rate,
        "block_size": controller.block_size,
        "latency_ms": controller.get_latency_ms()
    }


# ベクトル力覚
@app.post("/api/vector-force")
async def set_vector_force(request: VectorForceRequest):
    """ベクトル力覚を設定"""
    if request.device_id not in [1, 2]:
        raise HTTPException(status_code=400, detail="Device ID must be 1 or 2")
    
    if controller is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    controller.device.set_vector_force(
        device_id=request.device_id,
        angle=request.angle,
        magnitude=request.magnitude,
        frequency=request.frequency
    )
    
    return {"status": "applied"}


