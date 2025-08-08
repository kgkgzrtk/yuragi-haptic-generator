"""
YURAGI animation system for continuous haptic modulation.

This module implements the same animation logic as the frontend to ensure
consistent haptic output between frontend visualization and actual device output.
"""

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional
import numpy as np

try:
    from src.config.logging import get_logger
except ImportError:
    from config.logging import get_logger


@dataclass
class YURAGIPresetConfig:
    """YURAGI preset configuration"""

    initial_angle: float
    magnitude: float
    frequency: float
    rotation_freq: float

    # Additional parameters for fluctuation preset
    envelope_freq: float = 0.2
    envelope_depth: float = 0.3
    enable_speed_modulation: bool = False
    enable_amplitude_center_offset: bool = False


class YURAGIAnimator:
    """
    Manages YURAGI animation for haptic devices.

    This class implements continuous circular motion with optional
    speed and amplitude modulation for therapeutic effects.
    """

    def __init__(self, update_callback: Callable[[Dict[str, Any]], None]):
        """
        Initialize YURAGI animator.

        Args:
            update_callback: Callback function to update vector force
        """
        self.logger = get_logger(self.__class__.__name__)
        self.update_callback = update_callback

        # Animation state
        self._active_animations: Dict[int, asyncio.Task] = {}
        self._animation_configs: Dict[int, YURAGIPresetConfig] = {}

        # Preset configurations
        self._presets = self._initialize_presets()

    def _initialize_presets(self) -> Dict[str, YURAGIPresetConfig]:
        """Initialize preset configurations"""
        return {
            "default": YURAGIPresetConfig(
                initial_angle=0.0,
                magnitude=0.7,
                frequency=60.0,
                rotation_freq=0.33,
            ),
            "gentle": YURAGIPresetConfig(
                initial_angle=45.0,
                magnitude=0.4,
                frequency=40.0,
                rotation_freq=0.2,
            ),
            "moderate": YURAGIPresetConfig(
                initial_angle=0.0,
                magnitude=0.6,
                frequency=60.0,
                rotation_freq=0.33,
            ),
            "strong": YURAGIPresetConfig(
                initial_angle=90.0,
                magnitude=1.0,
                frequency=80.0,
                rotation_freq=0.5,
            ),
            "intense": YURAGIPresetConfig(
                initial_angle=90.0,
                magnitude=0.9,
                frequency=80.0,
                rotation_freq=0.5,
            ),
            "slow": YURAGIPresetConfig(
                initial_angle=180.0,
                magnitude=0.8,
                frequency=25.0,
                rotation_freq=0.15,
            ),
            "therapeutic": YURAGIPresetConfig(
                initial_angle=180.0,
                magnitude=0.5,
                frequency=50.0,
                rotation_freq=0.25,
            ),
            "therapeutic_fluctuation": YURAGIPresetConfig(
                initial_angle=180.0,
                magnitude=0.5,
                frequency=50.0,
                rotation_freq=0.15,
                envelope_freq=0.2,
                envelope_depth=0.3,
                enable_speed_modulation=True,
                enable_amplitude_center_offset=True,
            ),
        }

    async def start_animation(
        self, device_id: int, preset: str, duration: float
    ) -> None:
        """
        Start YURAGI animation for a device.

        Args:
            device_id: Device ID (1 or 2)
            preset: Preset name
            duration: Animation duration in seconds
        """
        # Stop existing animation if any
        await self.stop_animation(device_id)

        # Get preset configuration
        config = self._presets.get(preset, self._presets["default"])
        self._animation_configs[device_id] = config

        # Start animation task
        task = asyncio.create_task(self._animate_device(device_id, config, duration))
        self._active_animations[device_id] = task

        self.logger.info(
            f"Started YURAGI animation for device {device_id} "
            f"with preset '{preset}' for {duration}s"
        )

    async def stop_animation(self, device_id: int) -> None:
        """
        Stop YURAGI animation for a device.

        Args:
            device_id: Device ID (1 or 2)
        """
        if device_id in self._active_animations:
            task = self._active_animations[device_id]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            del self._active_animations[device_id]
            if device_id in self._animation_configs:
                del self._animation_configs[device_id]

            # Set zero force
            self.update_callback(
                {
                    "device_id": device_id,
                    "angle": 0.0,
                    "magnitude": 0.0,
                    "frequency": 60.0,
                }
            )

            self.logger.info(f"Stopped YURAGI animation for device {device_id}")

    async def _animate_device(
        self, device_id: int, config: YURAGIPresetConfig, duration: float
    ) -> None:
        """
        Animate a device with YURAGI pattern.

        Args:
            device_id: Device ID
            config: Animation configuration
            duration: Animation duration in seconds
        """
        start_time = time.time()
        phase = 0.0  # Accumulated phase for variable speed

        # Animation loop at 60 FPS
        frame_duration = 1.0 / 60.0

        try:
            while (time.time() - start_time) < duration:
                elapsed = time.time() - start_time

                # Calculate speed modulation for therapeutic_fluctuation
                speed_modulation = 1.0
                if config.enable_speed_modulation:
                    # Low-frequency modulation (0.1 Hz = 10 second period)
                    low_freq_mod = np.sin(2 * np.pi * 0.1 * elapsed)
                    # Second frequency (0.07 Hz = ~14 second period)
                    second_mod = np.sin(2 * np.pi * 0.07 * elapsed + np.pi / 3)
                    # Combine modulations with strong amplitude
                    speed_modulation = 1.0 + 0.8 * low_freq_mod + 0.5 * second_mod
                    # Clamp to reasonable range
                    speed_modulation = np.clip(speed_modulation, 0.1, 3.0)

                # Update phase with variable speed
                instantaneous_freq = config.rotation_freq * speed_modulation
                phase += 2 * np.pi * instantaneous_freq * frame_duration

                # Calculate circular motion position
                angle = phase + np.deg2rad(config.initial_angle)
                angle_degrees = np.rad2deg(angle) % 360

                # Calculate amplitude modulation
                magnitude = config.magnitude
                if config.enable_amplitude_center_offset:
                    # For therapeutic_fluctuation, use 0.8 as center offset
                    envelope_mod = (
                        np.sin(2 * np.pi * config.envelope_freq * elapsed)
                        * config.envelope_depth
                    )
                    magnitude = config.magnitude * (0.8 + envelope_mod * 0.8)
                else:
                    # Normal amplitude modulation
                    envelope_mod = (
                        np.sin(2 * np.pi * config.envelope_freq * elapsed)
                        * config.envelope_depth
                    )
                    magnitude = config.magnitude * (1.0 + envelope_mod)

                # Clamp magnitude
                magnitude = np.clip(magnitude, 0.0, 1.0)

                # Update vector force
                self.update_callback(
                    {
                        "device_id": device_id,
                        "angle": angle_degrees,
                        "magnitude": magnitude,
                        "frequency": config.frequency,
                    }
                )

                # Wait for next frame
                await asyncio.sleep(frame_duration)

        except asyncio.CancelledError:
            self.logger.debug(f"Animation cancelled for device {device_id}")
            raise

        # Animation completed
        self.logger.info(f"YURAGI animation completed for device {device_id}")

        # Clean up
        if device_id in self._active_animations:
            del self._active_animations[device_id]
        if device_id in self._animation_configs:
            del self._animation_configs[device_id]

    def is_active(self, device_id: int) -> bool:
        """Check if animation is active for a device"""
        return device_id in self._active_animations

    async def stop_all(self) -> None:
        """Stop all active animations"""
        tasks = list(self._active_animations.keys())
        for device_id in tasks:
            await self.stop_animation(device_id)
