"""Test basic imports to ensure modules are discoverable."""

def test_modulation_imports():
    """Test that modulation components can be imported."""
    from haptic_system.modulation import (
        AmplitudeModulator,
        CircularMotionGenerator,
        DirectionalFluctuationGenerator,
        ModulatorBase,
        NoiseGenerator,
    )
    
    # Just verify imports succeed
    assert AmplitudeModulator is not None
    assert CircularMotionGenerator is not None
    assert DirectionalFluctuationGenerator is not None
    assert ModulatorBase is not None
    assert NoiseGenerator is not None


def test_motion_generators_imports():
    """Test that motion_generators module provides re-exports."""
    from haptic_system.motion_generators import (
        AmplitudeModulator,
        CircularMotionGenerator,
        DirectionalFluctuationGenerator,
        ModulatorBase,
        NoiseGenerator,
    )
    
    # Just verify imports succeed
    assert AmplitudeModulator is not None
    assert CircularMotionGenerator is not None
    assert DirectionalFluctuationGenerator is not None
    assert ModulatorBase is not None
    assert NoiseGenerator is not None


def test_core_module_imports():
    """Test core haptic system module imports."""
    from haptic_system.channel import HapticChannel
    from haptic_system.device import HapticDevice
    from haptic_system.waveform import SawtoothWaveform
    
    assert HapticChannel is not None
    assert HapticDevice is not None
    assert SawtoothWaveform is not None