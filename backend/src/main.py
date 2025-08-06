"""
FastAPI メインアプリケーション
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field, field_validator

from src.config.settings import get_settings, setup_logging
from src.haptic_system.controller import HapticController

# 設定を取得
settings = get_settings()

# ロギング設定
setup_logging(settings)
logger = logging.getLogger(__name__)

# グローバルコントローラーインスタンス
# テストやスタンドアロン実行のため、ここで初期化
try:
    controller = HapticController(
        sample_rate=settings.sample_rate, block_size=settings.block_size
    )
    logger.info(
        f"HapticController initialized with sample_rate={settings.sample_rate}, block_size={settings.block_size}"
    )
except Exception as e:
    # sounddeviceがない環境では None のまま
    logger.warning(f"Failed to initialize HapticController: {e}")
    controller = None


# WebSocket message types (matching frontend)
class WSMessageType:
    PARAMETERS_UPDATE = "parameters_update"
    STATUS_UPDATE = "status_update"
    ERROR = "error"


# WebSocket connection manager
class ConnectionManager:
    """WebSocket connection manager for handling multiple clients"""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        async with self.lock:
            self.active_connections.append(websocket)
        logger.info(
            f"WebSocket connected. Total connections: {len(self.active_connections)}"
        )

    async def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        async with self.lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(
            f"WebSocket disconnected. Total connections: {len(self.active_connections)}"
        )

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            await self.disconnect(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        if not self.active_connections:
            return

        async with self.lock:
            disconnected = []
            for connection in self.active_connections[
                :
            ]:  # Copy to avoid modification during iteration
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error broadcasting to connection: {e}")
                    disconnected.append(connection)

            # Remove disconnected connections
            for connection in disconnected:
                if connection in self.active_connections:
                    self.active_connections.remove(connection)
                    logger.info(
                        f"Removed disconnected WebSocket. Remaining connections: {len(self.active_connections)}"
                    )


# Global connection manager
manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    global controller

    logger.info("Starting application...")

    # 起動時
    if controller is None:
        try:
            controller = HapticController(
                sample_rate=settings.sample_rate, block_size=settings.block_size
            )
            logger.info("HapticController initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize HapticController: {e}")

    yield

    # 終了時
    logger.info("Shutting down application...")
    logger.info("Application shutdown complete")


# FastAPIアプリケーションインスタンス
app = FastAPI(
    title=settings.app_name,
    description=settings.app_description,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

# Middleware configuration
if settings.is_production:
    # Security middleware for production
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

logger.info(f"CORS configured with origins: {settings.cors_origins}")


# Pydanticモデル
class ChannelParameters(BaseModel):
    """単一チャンネルのパラメータ"""

    channel_id: int = Field(..., ge=0, le=3, description="Channel ID (0-3)")
    frequency: float = Field(
        0.0,
        ge=settings.min_frequency,
        le=settings.max_frequency,
        description=f"Frequency in Hz ({settings.min_frequency}-{settings.max_frequency})",
    )
    amplitude: float = Field(0.0, ge=0.0, le=1.0, description="Amplitude (0.0-1.0)")
    phase: float = Field(0.0, ge=0.0, le=360.0, description="Phase in degrees")
    polarity: bool = Field(True, description="Waveform polarity")


class ParametersUpdate(BaseModel):
    """パラメータ更新リクエスト"""

    channels: list[ChannelParameters]


class ChannelUpdate(BaseModel):
    """単一チャンネル更新リクエスト"""

    frequency: float | None = Field(
        None, ge=settings.min_frequency, le=settings.max_frequency
    )
    amplitude: float | None = Field(None, ge=0.0, le=1.0)
    phase: float | None = Field(None, ge=0.0, le=360.0)
    polarity: bool | None = None


class WaveformRequest(BaseModel):
    """波形データリクエスト"""

    duration: float = Field(0.1, gt=0.0, le=1.0, description="Duration in seconds")
    sample_rate: int = Field(44100, gt=0, description="Sample rate in Hz")


class VectorForceRequest(BaseModel):
    """ベクトル力覚リクエスト"""

    device_id: int = Field(..., description="Device ID (1 or 2)")
    angle: float = Field(..., ge=0.0, le=360.0, description="Angle in degrees")
    magnitude: float = Field(..., ge=0.0, le=1.0, description="Magnitude (0.0-1.0)")
    frequency: float = Field(
        ...,
        ge=settings.min_frequency,
        le=settings.max_frequency,
        description="Frequency in Hz",
    )

    @field_validator("device_id")
    @classmethod
    def validate_device_id(cls, v):
        if v not in [1, 2]:
            raise ValueError("Device ID must be 1 or 2")
        return v


# ルートエンドポイント
@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "message": "Yuragi Haptic Generator API",
        "version": "0.1.0",
        "docs": "/docs",
    }


# ヘルスチェック
@app.get("/api/health")
async def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy"}


@app.get("/api/device-info")
async def get_device_info():
    """オーディオデバイス情報を取得"""
    if controller is None:
        return {
            "available": False,
            "channels": 0,
            "name": "Controller not initialized",
            "device_mode": "none",
        }

    return controller.device_info | {
        "device_mode": (
            "dual"
            if controller.available_channels == 4
            else "single" if controller.available_channels == 2 else "none"
        )
    }


@app.get("/api/debug/devices")
async def debug_list_devices():
    """デバッグ用：利用可能なすべてのオーディオデバイスをリスト"""
    try:
        import sounddevice as sd

        devices = sd.query_devices()
        device_list = []

        for idx, dev in enumerate(devices):
            device_list.append(
                {
                    "id": idx,
                    "name": dev["name"],
                    "max_input_channels": dev["max_input_channels"],
                    "max_output_channels": dev["max_output_channels"],
                    "default_samplerate": dev["default_samplerate"],
                    "is_default_output": idx == sd.default.device[1],
                }
            )

        return {"default_output_id": sd.default.device[1], "devices": device_list}
    except Exception as e:
        return {"error": str(e)}


# パラメータ管理
@app.get("/api/parameters")
async def get_parameters():
    """現在のパラメータを取得"""
    if controller is None:
        # デフォルト値を返す
        return {
            "channels": [
                {
                    "channelId": i,  # Changed to camelCase to match frontend
                    "frequency": 0.0,
                    "amplitude": 0.0,
                    "phase": 0.0,
                    "polarity": True,
                }
                for i in range(4)
            ]
        }

    params = controller.get_current_parameters()
    return {
        "channels": [
            {
                "channelId": i,  # Changed to camelCase to match frontend
                "frequency": ch.get("frequency", 0.0),
                "amplitude": ch.get("amplitude", 0.0),
                "phase": ch.get("phase", 0.0),
                "polarity": bool(ch.get("polarity", True)),
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
                "polarity": ch.polarity,
            }
            for ch in params.channels
        ]
    }
    controller.update_parameters(update_dict)

    # Broadcast parameter updates to WebSocket clients
    channels_data = [
        {
            "channelId": ch.channel_id,
            "frequency": ch.frequency,
            "amplitude": ch.amplitude,
            "phase": ch.phase,
            "polarity": ch.polarity,
        }
        for ch in params.channels
    ]
    asyncio.create_task(broadcast_parameters_update(channels_data))

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

    # Broadcast updated parameters to WebSocket clients
    updated_params = controller.get_current_parameters()
    channels_data = [
        {
            "channelId": i,
            "frequency": ch.get("frequency", 0.0),
            "amplitude": ch.get("amplitude", 0.0),
            "phase": ch.get("phase", 0.0),
            "polarity": bool(ch.get("polarity", True)),
        }
        for i, ch in enumerate(updated_params.get("channels", [{}] * 4))
    ]
    asyncio.create_task(broadcast_parameters_update(channels_data))

    return {"channel_id": channel_id, "status": "updated"}


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
                {"channelId": i, "data": [0.0] * num_samples} for i in range(4)
            ],
        }

    # サンプル数を計算
    num_samples = int(request.duration * request.sample_rate)

    # 現在のパラメータで波形を生成
    channels_data = []
    num_channels = min(4, controller.available_channels)  # Use available channels

    for ch_id in range(num_channels):
        # 各チャンネルの波形を生成
        try:
            channel = controller.device.channels[ch_id]
            waveform_data = channel.get_next_chunk(num_samples).tolist()
            channels_data.append({"channelId": ch_id, "data": waveform_data})
        except Exception as e:
            logger.error(f"Error getting waveform for channel {ch_id}: {e}")
            # Provide zero data on error
            channels_data.append({"channelId": ch_id, "data": [0.0] * num_samples})

    # Add zero data for remaining channels if in single device mode
    for ch_id in range(num_channels, 4):
        channels_data.append({"channelId": ch_id, "data": [0.0] * num_samples})

    return {
        "timestamp": "2024-08-04T00:00:00Z",  # 実際にはdatetimeを使用
        "sample_rate": request.sample_rate,
        "channels": channels_data,
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
        frequency=request.frequency,
    )

    # Broadcast updated parameters to WebSocket clients after vector force application
    updated_params = controller.get_current_parameters()
    channels_data = [
        {
            "channelId": i,
            "frequency": ch.get("frequency", 0.0),
            "amplitude": ch.get("amplitude", 0.0),
            "phase": ch.get("phase", 0.0),
            "polarity": bool(ch.get("polarity", True)),
        }
        for i, ch in enumerate(updated_params.get("channels", [{}] * 4))
    ]
    asyncio.create_task(broadcast_parameters_update(channels_data))

    return {"status": "applied"}


# WebSocket endpoint
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
                    "sampleRate": controller.sample_rate,
                    "blockSize": controller.block_size,
                },
                "timestamp": datetime.now(UTC).isoformat(),
            }
            await manager.send_personal_message(initial_status, websocket)

            # Send current parameters
            params = controller.get_current_parameters()
            parameters_msg = {
                "type": WSMessageType.PARAMETERS_UPDATE,
                "data": [
                    {
                        "channelId": i,
                        "frequency": ch.get("frequency", 0.0),
                        "amplitude": ch.get("amplitude", 0.0),
                        "phase": ch.get("phase", 0.0),
                        "polarity": bool(ch.get("polarity", True)),
                    }
                    for i, ch in enumerate(params.get("channels", [{}] * 4))
                ],
                "timestamp": datetime.now(UTC).isoformat(),
            }
            await manager.send_personal_message(parameters_msg, websocket)

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for incoming messages (for future client->server communication)
                message = await websocket.receive_text()
                logger.info(f"Received WebSocket message: {message}")

                # Parse and handle incoming messages if needed
                try:
                    data = json.loads(message)
                    # Handle different message types from client
                    # This can be extended for client->server commands
                    logger.info(f"Parsed WebSocket data: {data}")
                except json.JSONDecodeError:
                    error_msg = {
                        "type": WSMessageType.ERROR,
                        "data": {"message": "Invalid JSON format"},
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                    await manager.send_personal_message(error_msg, websocket)

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in WebSocket loop: {e}")
                error_msg = {
                    "type": WSMessageType.ERROR,
                    "data": {"message": str(e)},
                    "timestamp": datetime.now(UTC).isoformat(),
                }
                await manager.send_personal_message(error_msg, websocket)
                break

    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        await manager.disconnect(websocket)


# Helper functions for WebSocket broadcasting
async def broadcast_parameters_update(channels_data: list[dict[str, Any]]):
    """Broadcast parameter updates to all connected clients"""
    message = {
        "type": WSMessageType.PARAMETERS_UPDATE,
        "data": channels_data,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    await manager.broadcast(message)


async def broadcast_status_update(status_data: dict[str, Any]):
    """Broadcast status updates to all connected clients"""
    message = {
        "type": WSMessageType.STATUS_UPDATE,
        "data": status_data,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    await manager.broadcast(message)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
