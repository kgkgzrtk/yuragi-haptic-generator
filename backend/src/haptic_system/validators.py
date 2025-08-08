"""
Common validation functions for haptic system
"""


def validate_device_id(device_id: int) -> None:
    """
    Validate device ID is 1 or 2

    Args:
        device_id: Device ID to validate

    Raises:
        ValueError: If device ID is not 1 or 2
    """
    if device_id not in [1, 2]:
        raise ValueError("Device ID must be 1 or 2")


def validate_channel_id(channel_id: int) -> None:
    """
    Validate channel ID is between 0-3

    Args:
        channel_id: Channel ID to validate

    Raises:
        ValueError: If channel ID is not 0-3
    """
    if channel_id < 0 or channel_id > 3:
        raise ValueError("Channel ID must be 0-3")
