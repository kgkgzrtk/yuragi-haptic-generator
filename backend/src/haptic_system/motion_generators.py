"""
Motion Generators - Compatibility Layer

This module serves as a compatibility layer/alias for the modulation module.
All actual implementations are located in modulation.py.

Purpose:
- Provides backward compatibility for code that imports from motion_generators
- Allows for a more intuitive module name for motion-related components
- Re-exports all motion generation components from the modulation module

Note: This is purely a re-export module. For actual implementations,
see haptic_system/modulation.py
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
