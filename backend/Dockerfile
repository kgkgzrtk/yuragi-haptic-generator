# Multi-stage Dockerfile for Yuragi Haptic Generator Backend
# Optimized for production deployment with minimal image size

# Build stage
FROM python:3.11-slim as builder

# Set environment variables for build
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies required for building
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    libasound2-dev \
    portaudio19-dev \
    python3-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Copy dependency files
COPY pyproject.toml ./

# Install uv for faster dependency resolution
RUN pip install uv

# Install Python dependencies
RUN uv pip install .[api,production]

# Production stage
FROM python:3.11-slim as production

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/venv/bin:$PATH" \
    ENVIRONMENT=production

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y \
    libasound2 \
    portaudio19-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -r haptic && useradd -r -g haptic haptic

# Copy virtual environment from builder stage
COPY --from=builder /venv /venv

# Create application directory
WORKDIR /app

# Copy source code
COPY src/ ./src/
COPY .env.production ./.env

# Create logs directory
RUN mkdir -p /var/log && \
    chown haptic:haptic /var/log

# Change ownership of application files
RUN chown -R haptic:haptic /app

# Switch to non-root user
USER haptic

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Production command using uvicorn with optimizations
CMD ["python", "src/server.py"]

# Development stage (for development builds)
FROM production as development

# Switch back to root for development setup
USER root

# Install development dependencies
RUN uv pip install .[dev]

# Copy development environment
COPY .env.development ./.env

# Set development environment
ENV ENVIRONMENT=development \
    DEBUG=true \
    RELOAD=true

# Switch back to haptic user
USER haptic

# Development command with auto-reload
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]