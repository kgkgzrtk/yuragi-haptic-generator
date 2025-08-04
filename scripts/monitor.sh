#!/bin/bash

# Monitoring script for Yuragi Haptic Generator
# Provides real-time monitoring of services and system resources

set -e

# Configuration
PROJECT_NAME="yuragi-haptic-generator"
ALERT_EMAIL="${ALERT_EMAIL:-admin@example.com}"
CHECK_INTERVAL=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check service health
check_service_health() {
    local service_name=$1
    local health_url=$2
    
    if curl -f -s "$health_url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $service_name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is unhealthy"
        return 1
    fi
}

# Check Docker container status
check_containers() {
    info "Checking container status..."
    
    local unhealthy_containers=0
    
    # Check each service
    for service in backend frontend; do
        local container_id
        container_id=$(docker-compose ps -q "$service" 2>/dev/null || echo "")
        
        if [ -z "$container_id" ]; then
            error "$service container is not running"
            ((unhealthy_containers++))
            continue
        fi
        
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "unknown")
        
        case $status in
            "healthy")
                echo -e "${GREEN}✓${NC} $service container is healthy"
                ;;
            "unhealthy")
                error "$service container is unhealthy"
                ((unhealthy_containers++))
                ;;
            "starting")
                warning "$service container is starting"
                ;;
            *)
                warning "$service container status unknown: $status"
                ;;
        esac
    done
    
    return $unhealthy_containers
}

# Check system resources
check_system_resources() {
    info "Checking system resources..."
    
    # Check disk usage
    local disk_usage
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        error "Disk usage is critically high: ${disk_usage}%"
    elif [ "$disk_usage" -gt 80 ]; then
        warning "Disk usage is high: ${disk_usage}%"
    else
        echo -e "${GREEN}✓${NC} Disk usage is normal: ${disk_usage}%"
    fi
    
    # Check memory usage
    local mem_usage
    mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$mem_usage" -gt 90 ]; then
        error "Memory usage is critically high: ${mem_usage}%"
    elif [ "$mem_usage" -gt 80 ]; then
        warning "Memory usage is high: ${mem_usage}%"
    else
        echo -e "${GREEN}✓${NC} Memory usage is normal: ${mem_usage}%"
    fi
    
    # Check CPU load
    local cpu_load
    cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    
    echo -e "${BLUE}ℹ${NC} CPU load average: $cpu_load"
}

# Check application endpoints
check_endpoints() {
    info "Checking application endpoints..."
    
    local failed_checks=0
    
    # Backend health
    if ! check_service_health "Backend API" "http://localhost:8000/api/health"; then
        ((failed_checks++))
    fi
    
    # Frontend health  
    if ! check_service_health "Frontend" "http://localhost:80/health" && 
       ! check_service_health "Frontend" "http://localhost:8080/health"; then
        ((failed_checks++))
    fi
    
    # WebSocket connectivity (basic check)
    if command -v wscat &> /dev/null; then
        if timeout 5 wscat -c ws://localhost:8000/ws --execute "exit" &> /dev/null; then
            echo -e "${GREEN}✓${NC} WebSocket is accessible"
        else
            error "WebSocket connection failed"
            ((failed_checks++))
        fi
    else
        warning "wscat not available - skipping WebSocket check"
    fi
    
    return $failed_checks
}

# Get service logs
get_logs() {
    local service=$1
    local lines=${2:-50}
    
    info "Recent logs for $service (last $lines lines):"
    docker-compose logs --tail="$lines" "$service"
}

# Send alert (placeholder - implement with your preferred notification method)
send_alert() {
    local message=$1
    local severity=$2
    
    # Log alert
    error "ALERT [$severity]: $message"
    
    # Here you would implement your preferred notification method:
    # - Email
    # - Slack
    # - Discord
    # - PagerDuty
    # - etc.
    
    # Example email command (requires mail setup):
    # echo "$message" | mail -s "[$PROJECT_NAME] $severity Alert" "$ALERT_EMAIL"
}

# Monitor continuously
monitor() {
    log "Starting continuous monitoring (interval: ${CHECK_INTERVAL}s)"
    log "Press Ctrl+C to stop"
    
    while true; do
        clear
        echo "================== YURAGI HAPTIC GENERATOR MONITORING =================="
        echo "Time: $(date)"
        echo "======================================================================="
        
        # Check containers
        if ! check_containers; then
            send_alert "One or more containers are unhealthy" "CRITICAL"
        fi
        
        echo ""
        
        # Check endpoints
        if ! check_endpoints; then
            send_alert "One or more endpoints are failing" "HIGH"
        fi
        
        echo ""
        
        # Check system resources
        check_system_resources
        
        echo ""
        echo "Next check in ${CHECK_INTERVAL} seconds..."
        echo "======================================================================="
        
        sleep "$CHECK_INTERVAL"
    done
}

# Show service status
show_status() {
    echo "================== SERVICE STATUS =================="
    docker-compose ps
    echo ""
    
    echo "================== CONTAINER STATS =================="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    echo ""
    
    echo "================== SYSTEM INFO =================="
    check_system_resources
}

# Show usage
usage() {
    echo "Usage: $0 {monitor|status|logs|check}"
    echo ""
    echo "Commands:"
    echo "  monitor  - Start continuous monitoring"
    echo "  status   - Show current service status"
    echo "  logs     - Show recent logs for all services"
    echo "  check    - Run one-time health check"
    echo ""
    echo "Options:"
    echo "  logs [service] [lines] - Show logs for specific service"
    echo ""
}

# Main execution
main() {
    case "$1" in
        monitor)
            monitor
            ;;
        status)
            show_status
            ;;
        logs)
            if [ -n "$2" ]; then
                get_logs "$2" "${3:-50}"
            else
                docker-compose logs --tail=50
            fi
            ;;
        check)
            log "Running health check..."
            check_containers
            echo ""
            check_endpoints
            echo ""
            check_system_resources
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"