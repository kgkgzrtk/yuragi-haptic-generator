"""
Production server startup script
"""

import uvicorn

from config.settings import get_settings


def main():
    """Start the server with production configuration"""
    settings = get_settings()

    # Configure uvicorn
    config = settings.uvicorn_config

    # Additional production optimizations
    if settings.is_production:
        config.update(
            {
                "loop": "uvloop",  # Use uvloop for better performance
                "http": "httptools",  # Use httptools for better HTTP parsing
                "interface": "asgi3",  # Use ASGI3 interface
            }
        )

    # Start server
    uvicorn.run("main:app", **config)


if __name__ == "__main__":
    main()
