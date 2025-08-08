"""
Production server startup script
"""

import platform
import uvicorn

from src.config.settings import get_settings


def main():
    """Start the server with production configuration"""
    settings = get_settings()

    # Configure uvicorn
    config = settings.uvicorn_config

    # Additional production optimizations
    if settings.is_production:
        updates = {
            "http": "httptools",  # Use httptools for better HTTP parsing
            "interface": "asgi3",  # Use ASGI3 interface
        }
        
        # Use uvloop on non-Windows platforms for better performance
        if platform.system() != "Windows":
            updates["loop"] = "uvloop"
        else:
            # Use asyncio on Windows
            updates["loop"] = "asyncio"
        
        config.update(updates)

    # Start server
    uvicorn.run("main:app", **config)


if __name__ == "__main__":
    main()
