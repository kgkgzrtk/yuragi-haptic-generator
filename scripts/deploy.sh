#!/bin/bash

# Production deployment script for Yuragi Haptic Generator
# This script handles building, deploying, and managing the full stack application

set -e  # Exit on any error

# Configuration
PROJECT_NAME="yuragi-haptic-generator"
BACKUP_RETENTION_DAYS=7
LOG_FILE="/var/log/${PROJECT_NAME}-deploy.log"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_DEV_FILE="docker-compose.dev.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "${LOG_FILE}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "${LOG_FILE}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "${LOG_FILE}"
}

# Check if Docker is installed and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    log "Docker and Docker Compose are available"
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."

    # Check available disk space (minimum 2GB)
    available_space=$(df / | awk 'NR==2 {print $4}')
    required_space=$((2 * 1024 * 1024))  # 2GB in KB

    if [ "$available_space" -lt "$required_space" ]; then
        error "Insufficient disk space. At least 2GB required."
        exit 1
    fi

    # Check if ports are available
    if netstat -tuln | grep -q ':80\|:443\|:8000'; then
        warning "Some required ports (80, 443, 8000) may be in use"
    fi

    log "System requirements check completed"
}

# Create backup of current deployment
backup_current() {
    log "Creating backup of current deployment..."

    backup_dir="./backups/$(date +'%Y%m%d_%H%M%S')"
    mkdir -p "$backup_dir"

    # Backup docker-compose files
    if [ -f "$COMPOSE_FILE" ]; then
        cp "$COMPOSE_FILE" "$backup_dir/"
    fi

    # Backup environment files
    find . -name ".env*" -not -path "./node_modules/*" -not -path "./.git/*" | while read -r file; do
        cp "$file" "$backup_dir/"
    done

    # Export current container states
    if docker-compose ps -q &> /dev/null; then
        docker-compose ps > "$backup_dir/container_states.txt"
        docker-compose logs --tail=100 > "$backup_dir/recent_logs.txt" 2>/dev/null || true
    fi

    log "Backup created at $backup_dir"

    # Clean old backups
    find ./backups -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
}

# Build images
build_images() {
    log "Building Docker images..."

    # Build backend
    info "Building backend image..."
    docker build -t yuragi-haptic-backend:latest ./backend --target production

    # Build frontend
    info "Building frontend image..."
    docker build -t yuragi-haptic-frontend:latest ./frontend --target production

    log "Docker images built successfully"
}

# Deploy services
deploy() {
    log "Deploying services..."

    # Pull any external images
    docker-compose pull --ignore-pull-failures

    # Deploy with zero-downtime if possible
    if docker-compose ps -q | grep -q .; then
        info "Performing rolling update..."
        docker-compose up -d --no-deps --remove-orphans
    else
        info "Performing fresh deployment..."
        docker-compose up -d --remove-orphans
    fi

    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    timeout 300 bash -c '
        while ! docker-compose ps | grep -q "healthy"; do
            echo "Waiting for services to become healthy..."
            sleep 5
        done
    ' || {
        error "Services did not become healthy within timeout"
        return 1
    }

    log "Deployment completed successfully"
}

# Run health checks
health_check() {
    log "Running post-deployment health checks..."

    # Check backend health
    if ! curl -f http://localhost:8000/api/health &> /dev/null; then
        error "Backend health check failed"
        return 1
    fi

    # Check frontend health
    if ! curl -f http://localhost:80/health &> /dev/null && ! curl -f http://localhost:8080/health &> /dev/null; then
        error "Frontend health check failed"
        return 1
    fi

    # Check WebSocket connectivity
    info "WebSocket connectivity check would go here"

    log "All health checks passed"
}

# Rollback to previous version
rollback() {
    log "Starting rollback procedure..."

    # Find latest backup
    latest_backup=$(find ./backups -type d -name "*_*" | sort -r | head -1)

    if [ -z "$latest_backup" ]; then
        error "No backup found for rollback"
        exit 1
    fi

    log "Rolling back to backup: $latest_backup"

    # Stop current services
    docker-compose down --remove-orphans

    # Restore backup files
    if [ -f "$latest_backup/$COMPOSE_FILE" ]; then
        cp "$latest_backup/$COMPOSE_FILE" .
    fi

    # Start services with backup configuration
    docker-compose up -d --remove-orphans

    log "Rollback completed"
}

# Show usage
usage() {
    echo "Usage: $0 {build|deploy|rollback|dev|stop|logs|status|cleanup}"
    echo ""
    echo "Commands:"
    echo "  build     - Build Docker images"
    echo "  deploy    - Deploy to production"
    echo "  rollback  - Rollback to previous version"
    echo "  dev       - Start development environment"
    echo "  stop      - Stop all services"
    echo "  logs      - Show service logs"
    echo "  status    - Show service status"
    echo "  cleanup   - Clean up unused Docker resources"
    echo ""
}

# Main execution
main() {
    case "$1" in
        build)
            check_docker
            build_images
            ;;
        deploy)
            check_docker
            check_requirements
            backup_current
            build_images
            deploy
            health_check
            log "Production deployment completed successfully!"
            ;;
        rollback)
            check_docker
            rollback
            health_check
            log "Rollback completed successfully!"
            ;;
        dev)
            log "Starting development environment..."
            docker-compose -f "$COMPOSE_DEV_FILE" up -d --build
            log "Development environment started"
            ;;
        stop)
            log "Stopping all services..."
            docker-compose down --remove-orphans
            docker-compose -f "$COMPOSE_DEV_FILE" down --remove-orphans 2>/dev/null || true
            log "All services stopped"
            ;;
        logs)
            docker-compose logs -f
            ;;
        status)
            docker-compose ps
            ;;
        cleanup)
            log "Cleaning up unused Docker resources..."
            docker system prune -f
            docker volume prune -f
            log "Cleanup completed"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p ./backups

# Execute main function
main "$@"