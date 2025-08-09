"""
FastAPI メインアプリケーション
"""

import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field, field_validator

from src.config.settings import get_settings, setup_logging
from src.haptic_system.controller import HapticController
from src.haptic_system.validators import validate_device_id
from src.haptic_system.yuragi_animator import YURAGIAnimator

# 設定を取得
settings = get_settings()

# ロギング設定
setup_logging(settings)
logger = logging.getLogger(__name__)

# グローバルコントローラーインスタンス
# テストやスタンドアロン実行のため、ここで初期化
controller = None
yuragi_animator = None

try:
    controller = HapticController(
        sample_rate=settings.sample_rate, block_size=settings.block_size
    )
    logger.info(
        f"HapticController initialized with sample_rate={settings.sample_rate}, block_size={settings.block_size}"
    )

    # Initialize YURAGI animator with available channels
    yuragi_animator = YURAGIAnimator(
        controller.set_vector_force, controller.available_channels
    )
    logger.info(
        f"YURAGIAnimator initialized with {controller.available_channels} channels"
    )

except Exception as e:
    # sounddeviceがない環境では None のまま
    logger.warning(f"Failed to initialize HapticController: {e}")
    controller = None
    yuragi_animator = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    global controller, yuragi_animator

    logger.info("Starting application...")

    # 起動時
    if controller is None:
        try:
            controller = HapticController(
                sample_rate=settings.sample_rate, block_size=settings.block_size
            )
            logger.info("HapticController initialized successfully")

            # Initialize YURAGI animator if controller is available
            if yuragi_animator is None:
                yuragi_animator = YURAGIAnimator(
                    controller.set_vector_force, controller.available_channels
                )
                logger.info(
                    f"YURAGIAnimator initialized in lifespan with {controller.available_channels} channels"
                )

        except Exception as e:
            logger.error(f"Failed to initialize HapticController: {e}")

    # ストリーミングを自動開始
    if controller and not controller.is_streaming:
        try:
            controller.start_streaming()
            logger.info("Audio streaming started automatically")
        except Exception as e:
            logger.warning(f"Failed to auto-start streaming: {e}")

    yield

    # 終了時
    logger.info("Shutting down application...")

    # Stop all YURAGI animations
    if yuragi_animator:
        try:
            await yuragi_animator.stop_all()
            logger.info("All YURAGI animations stopped")
        except Exception as e:
            logger.warning(f"Failed to stop YURAGI animations: {e}")

    # ストリーミングを停止
    if controller and controller.is_streaming:
        try:
            controller.stop_streaming()
            logger.info("Audio streaming stopped")
        except Exception as e:
            logger.warning(f"Failed to stop streaming: {e}")

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
        validate_device_id(v)
        return v


class YURAGIPresetRequest(BaseModel):
    """YURAGIプリセットリクエスト"""

    preset: Literal[
        "default",
        "gentle",
        "moderate",
        "strong",
        "intense",
        "slow",
        "therapeutic",
        "therapeutic_fluctuation",
    ] = Field("default", description="Preset name")
    duration: float = Field(60.0, ge=30.0, le=300.0, description="Duration in seconds")
    enabled: bool = Field(True, description="Enable/disable the preset")


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

    try:
        controller.set_vector_force(
            {
                "device_id": request.device_id,
                "angle": request.angle,
                "magnitude": request.magnitude,
                "frequency": request.frequency,
            }
        )
        return {"status": "applied"}
    except ValueError as e:
        # Device2 not available
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        # Streaming not started
        raise HTTPException(status_code=400, detail=str(e))


# ストリーミング制御
@app.post("/api/streaming/start")
async def start_streaming():
    """ストリーミングを開始"""
    if controller is None:
        raise HTTPException(status_code=503, detail="Service not initialized")

    if not controller.is_streaming:
        try:
            controller.start_streaming()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return {"status": "started", "is_streaming": True}


@app.post("/api/streaming/stop")
async def stop_streaming():
    """ストリーミングを停止"""
    if controller is None:
        raise HTTPException(status_code=503, detail="Service not initialized")

    if controller.is_streaming:
        controller.stop_streaming()

    return {"status": "stopped", "is_streaming": False}


@app.get("/api/streaming/status")
async def get_streaming_status():
    """ストリーミング状態を取得"""
    if controller is None:
        return {
            "is_streaming": False,
            "sample_rate": 44100,
            "block_size": 512,
            "latency_ms": 0.0,
        }

    return {
        "is_streaming": controller.is_streaming,
        "sample_rate": controller.sample_rate,
        "block_size": controller.block_size,
        "latency_ms": controller.get_latency_ms(),
        "device_info": {
            "available": controller.device_info.get("available", False),
            "channels": controller.available_channels,
            "name": controller.device_info.get("name", "Unknown"),
            "device_mode": "dual" if controller.available_channels == 4 else "single",
        },
    }


@app.post("/api/yuragi/preset")
async def set_yuragi_preset(request: YURAGIPresetRequest):
    """YURAGIプリセットを適用"""
    if controller is None:
        raise HTTPException(status_code=503, detail="Service not initialized")

    if yuragi_animator is None:
        raise HTTPException(status_code=503, detail="YURAGI animator not initialized")

    # プリセットに基づいてパラメータをマッピング
    preset_params = _get_yuragi_preset_params(request.preset)

    try:
        if request.enabled:
            # Start YURAGI animation for both devices
            await yuragi_animator.start_animation(
                preset=request.preset,
                duration=request.duration,
            )

            return {
                "status": "applied",
                "preset": request.preset,
                "enabled": True,
                "duration": request.duration,
                "parameters": {
                    "angle": preset_params["initial_angle"],
                    "magnitude": preset_params["magnitude"],
                    "frequency": preset_params["frequency"],
                    "rotation_freq": preset_params["rotation_freq"],
                },
            }
        else:
            # Stop YURAGI animation for all devices
            await yuragi_animator.stop_all()

            return {
                "status": "disabled",
                "preset": request.preset,
                "enabled": False,
                "duration": request.duration,
                "parameters": {
                    "angle": 0.0,
                    "magnitude": 0.0,
                    "frequency": 60.0,
                    "rotation_freq": 0.0,
                },
            }
    except ValueError as e:
        # Device2 not available
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        # Streaming not started
        raise HTTPException(status_code=400, detail=str(e))


def _get_yuragi_preset_params(preset: str) -> dict:
    """YURAGIプリセットのパラメータを取得"""
    presets = {
        "default": {
            "initial_angle": 0.0,
            "magnitude": 0.7,
            "frequency": 60.0,
            "rotation_freq": 0.33,  # 約3秒/周
        },
        "gentle": {
            "initial_angle": 45.0,  # 45度方向
            "magnitude": 0.4,
            "frequency": 40.0,
            "rotation_freq": 0.2,  # 5秒/周
        },
        "moderate": {
            "initial_angle": 0.0,
            "magnitude": 0.6,
            "frequency": 60.0,
            "rotation_freq": 0.33,  # 約3秒/周
        },
        "strong": {
            "initial_angle": 90.0,  # 上方向
            "magnitude": 1.0,
            "frequency": 80.0,
            "rotation_freq": 0.5,  # 2秒/周
        },
        "intense": {
            "initial_angle": 90.0,  # 上方向
            "magnitude": 0.9,
            "frequency": 80.0,
            "rotation_freq": 0.5,  # 2秒/周
        },
        "slow": {
            "initial_angle": 180.0,  # 左方向
            "magnitude": 0.8,
            "frequency": 25.0,
            "rotation_freq": 0.15,  # 約6.7秒/周
        },
        "therapeutic": {
            "initial_angle": 180.0,  # 左方向
            "magnitude": 0.5,
            "frequency": 50.0,
            "rotation_freq": 0.25,  # 4秒/周
        },
        "therapeutic_fluctuation": {
            "initial_angle": 180.0,  # 左方向
            "magnitude": 0.5,
            "frequency": 50.0,
            "rotation_freq": 0.15,  # 約6.7秒/周 - より遅い回転
        },
    }
    return presets.get(preset, presets["default"]).copy()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
