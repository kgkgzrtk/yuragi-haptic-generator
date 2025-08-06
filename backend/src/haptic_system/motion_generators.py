"""
Motion Generators - Compatibility Layer
Re-exports all motion generation components from the modulation module.

This module provides an alternative import path for motion generation components.
The actual implementations are in the modulation module.
"""

from .modulation import (
    AmplitudeModulator,
    CircularMotionGenerator,
    DirectionalFluctuationGenerator,
    ModulatorBase,
    NoiseGenerator,
)

__all__ = [
    "ModulatorBase",
    "CircularMotionGenerator",
    "AmplitudeModulator",
    "DirectionalFluctuationGenerator",
    "NoiseGenerator",
]
