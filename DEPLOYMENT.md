# Yuragi Haptic Generator - Production Deployment Guide

This guide covers the production deployment of the Yuragi Haptic Generator full-stack application.

> **Note**: This guide uses `docker compose` (V2) commands. If you have an older Docker installation, you may need to use `docker compose` instead.

## Overview

The application consists of:
- **Frontend**: React + TypeScript + Vite (served via Nginx)
- **Backend**: FastAPI + Python (with haptic system integration)
- **Logging**: Centralized logging with Fluentd (optional ELK stack)

## Prerequisites

- Docker & Docker Compose installed
- Minimum 2GB available disk space
- Ports 80, 443, 8000 available
- Audio device access for haptic functionality

## Quick Start

### 1. Production Deployment

```bash
# Clone and navigate to project
git clone <repository-url>
cd yuragi-haptic-generator

# Deploy to production
./scripts/deploy.sh deploy
```

### 2. Development Environment

```bash
# Start development environment
./scripts/deploy.sh dev

# Or manually:
docker compose -f docker compose.dev.yml up -d --build
```

## Configuration

### Environment Variables

#### Frontend (.env.production)
```env
VITE_API_BASE_URL=https://api.yuragi-haptic.com
VITE_WS_BASE_URL=wss://api.yuragi-haptic.com
VITE_ENABLE_LOGGING=false
VITE_LOG_LEVEL=error
```

#### Backend (.env.production)
```env
ENVIRONMENT=production
DEBUG=false
WORKERS=4
CORS_ORIGINS=https://yuragi-haptic.com,https://www.yuragi-haptic.com
LOG_LEVEL=INFO
LOG_FILE=/var/log/haptic-api.log
```

### Docker Configuration

The application uses multi-stage Docker builds:
- **Production**: Optimized images with minimal dependencies
- **Development**: Full development environment with hot reloading

## Deployment Scripts

### Main Deployment Script (`scripts/deploy.sh`)

```bash
# Available commands
./scripts/deploy.sh build     # Build Docker images
./scripts/deploy.sh deploy    # Full production deployment
./scripts/deploy.sh rollback  # Rollback to previous version
./scripts/deploy.sh dev       # Start development environment
./scripts/deploy.sh stop      # Stop all services
./scripts/deploy.sh logs      # Show service logs
./scripts/deploy.sh status    # Show service status
./scripts/deploy.sh cleanup   # Clean up Docker resources
```

### Monitoring Script (`scripts/monitor.sh`)

```bash
# Monitor services
./scripts/monitor.sh monitor  # Continuous monitoring
./scripts/monitor.sh status   # Current status
./scripts/monitor.sh check    # One-time health check
./scripts/monitor.sh logs     # Recent logs
```

### Backup Script (`scripts/backup.sh`)

```bash
# Backup management
./scripts/backup.sh create           # Create backup
./scripts/backup.sh create pre_update  # Named backup
./scripts/backup.sh list             # List backups
./scripts/backup.sh restore <name>   # Restore backup
./scripts/backup.sh cleanup          # Remove old backups
./scripts/backup.sh verify <name>    # Verify backup integrity
```

## Logging

### Architecture

- **Structured Logging**: JSON format in production
- **Log Aggregation**: Fluentd collects from all services
- **Storage**: File-based with optional Elasticsearch
- **Visualization**: Optional Kibana dashboard

### Log Levels

- **DEBUG**: Development debugging information
- **INFO**: General application events
- **WARN**: Potential issues or important events
- **ERROR**: Error conditions requiring attention

### Centralized Logging (Optional)

```bash
# Start with ELK stack
docker compose -f docker compose.yml -f docker compose.logging.yml --profile elk up -d

# Access Kibana dashboard
open http://localhost:5601
```

## Health Checks

All services include health checks:
- **Backend**: `GET /api/health`
- **Frontend**: `GET /health`
- **Automatic**: Docker health checks every 30s

## Security Features

### Production Security

- Non-root users in containers
- Security headers (HSTS, CSP, etc.)
- CORS configuration
- Rate limiting
- Trusted host validation

### Development Security

- Relaxed CORS for development
- Debug logging enabled
- Hot reloading

## Performance Optimizations

### Frontend

- Code splitting by route and vendor
- Tree shaking and minification
- Gzip/Brotli compression
- Static asset caching
- Bundle analysis available

### Backend

- Multi-worker deployment
- Connection pooling
- Request/response compression
- Health check filtering
- Structured logging

## Monitoring & Alerting

### Built-in Monitoring

- Container health checks
- Resource usage monitoring
- Application-level health endpoints
- Log-based monitoring

### Metrics Collected

- Request/response times
- Error rates
- Resource utilization
- WebSocket connections
- Haptic system performance

## Troubleshooting

### Common Issues

1. **Port conflicts**: Check if ports 80, 443, 8000 are available
2. **Audio device access**: Ensure `/dev/snd` permissions are correct
3. **Memory issues**: Monitor container memory usage
4. **WebSocket issues**: Check proxy configuration

### Debug Commands

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f [service]

# Enter container
docker compose exec [service] bash

# Check resource usage
docker stats

# Network connectivity
docker compose exec backend curl -f http://frontend:8080/health
```

### Log Analysis

```bash
# Backend logs
docker compose logs backend | grep ERROR

# Frontend logs  
docker compose logs frontend | grep -E "(error|404|500)"

# Real-time monitoring
./scripts/monitor.sh monitor
```

## Backup & Recovery

### Automated Backups

- Automatic daily backups (configurable)
- 30-day retention policy
- Configuration and code backup
- Container image export

### Recovery Process

1. List available backups: `./scripts/backup.sh list`
2. Stop current services: `./scripts/deploy.sh stop`
3. Restore backup: `./scripts/backup.sh restore <backup_name>`
4. Verify services: `./scripts/monitor.sh check`

## Scaling

### Horizontal Scaling

```yaml
# docker compose.yml
services:
  backend:
    deploy:
      replicas: 3
    environment:
      - WORKERS=2  # Per container
```

### Load Balancing

- Use nginx upstream for backend scaling
- Sticky sessions for WebSocket connections
- Database connection pooling

## Updates & Maintenance

### Rolling Updates

```bash
# Create backup before update
./scripts/backup.sh create pre_update_$(date +%Y%m%d)

# Deploy new version
./scripts/deploy.sh deploy

# Verify deployment
./scripts/monitor.sh check

# Rollback if needed
./scripts/deploy.sh rollback
```

### Maintenance Windows

1. Schedule maintenance
2. Create backup
3. Deploy updates
4. Run health checks
5. Monitor for issues

## Support

- Check logs: `./scripts/monitor.sh logs`
- Health status: `./scripts/monitor.sh status`
- Create backup: `./scripts/backup.sh create debug_$(date +%Y%m%d)`
- Export logs: Available in container logs and local files

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (Nginx)       │◄──►│   (FastAPI)     │
│   Port: 80/443  │    │   Port: 8000    │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│          Logging & Monitoring           │
│     Fluentd → Elasticsearch → Kibana   │
└─────────────────────────────────────────┘
```

This deployment provides a production-ready, scalable, and maintainable solution for the Yuragi Haptic Generator application.