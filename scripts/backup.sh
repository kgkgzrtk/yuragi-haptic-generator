#!/bin/bash

# Backup management script for Yuragi Haptic Generator
# Handles automated backups, restoration, and cleanup

set -e

# Configuration
PROJECT_NAME="yuragi-haptic-generator"
BACKUP_DIR="./backups"
RETENTION_DAYS=30
LOG_FILE="/var/log/${PROJECT_NAME}-backup.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
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

# Create backup directory if it doesn't exist
ensure_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
}

# Create full backup
create_backup() {
    local backup_name="${1:-$(date +'%Y%m%d_%H%M%S')}"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log "Creating backup: $backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup configuration files
    info "Backing up configuration files..."
    cp docker-compose*.yml "$backup_path/" 2>/dev/null || true
    
    # Backup environment files
    find . -name ".env*" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./backups/*" | while read -r file; do
        cp "$file" "$backup_path/"
    done
    
    # Backup application code (excluding node_modules and build artifacts)
    info "Backing up application code..."
    tar -czf "$backup_path/source_code.tar.gz" \
        --exclude=node_modules \
        --exclude=dist \
        --exclude=build \
        --exclude=.git \
        --exclude=backups \
        --exclude=logs \
        --exclude=*.log \
        --exclude=__pycache__ \
        --exclude=htmlcov \
        --exclude=playwright-report \
        .
    
    # Backup container states and logs
    if docker-compose ps -q &> /dev/null; then
        info "Backing up container information..."
        docker-compose ps > "$backup_path/container_states.txt"
        docker-compose config > "$backup_path/resolved_compose.yml"
        docker-compose logs --tail=1000 > "$backup_path/service_logs.txt" 2>/dev/null || true
        
        # Export container images
        info "Exporting container images..."
        docker-compose images --quiet | while read -r image; do
            if [ -n "$image" ]; then
                image_name=$(echo "$image" | tr '/' '_' | tr ':' '_')
                docker save "$image" | gzip > "$backup_path/image_${image_name}.tar.gz"
            fi
        done
    fi
    
    # Create backup metadata
    cat > "$backup_path/backup_info.json" <<EOF
{
    "backup_name": "$backup_name",
    "created_at": "$(date -Iseconds)",
    "project_name": "$PROJECT_NAME",
    "hostname": "$(hostname)",
    "backup_type": "full",
    "size_bytes": $(du -sb "$backup_path" | cut -f1)
}
EOF
    
    # Calculate backup size
    local backup_size
    backup_size=$(du -sh "$backup_path" | cut -f1)
    
    log "Backup created successfully: $backup_path ($backup_size)"
    
    echo "$backup_path"
}

# List available backups
list_backups() {
    log "Available backups:"
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        warning "No backups found"
        return
    fi
    
    echo -e "\n${BLUE}Backup Name${NC}\t\t${BLUE}Created${NC}\t\t\t${BLUE}Size${NC}"
    echo "=================================================================="
    
    for backup in "$BACKUP_DIR"/*; do
        if [ -d "$backup" ]; then
            local backup_name
            backup_name=$(basename "$backup")
            local created_date
            created_date=$(stat -c %y "$backup" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1 || echo "Unknown")
            local size
            size=$(du -sh "$backup" 2>/dev/null | cut -f1 || echo "Unknown")
            
            echo -e "$backup_name\t$created_date\t$size"
        fi
    done
    echo ""
}

# Restore from backup
restore_backup() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        error "Backup name required"
        list_backups
        exit 1
    fi
    
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_path" ]; then
        error "Backup not found: $backup_name"
        list_backups
        exit 1
    fi
    
    log "Restoring from backup: $backup_name"
    
    # Stop current services
    info "Stopping current services..."
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Create restore point
    local restore_point="pre_restore_$(date +'%Y%m%d_%H%M%S')"
    info "Creating restore point: $restore_point"
    create_backup "$restore_point" > /dev/null
    
    # Restore configuration files
    info "Restoring configuration files..."
    cp "$backup_path"/*.yml . 2>/dev/null || true
    cp "$backup_path"/.env* . 2>/dev/null || true
    
    # Restore source code if available
    if [ -f "$backup_path/source_code.tar.gz" ]; then
        info "Restoring source code..."
        tar -xzf "$backup_path/source_code.tar.gz"
    fi
    
    # Restore container images if available
    info "Restoring container images..."
    for image_file in "$backup_path"/image_*.tar.gz; do
        if [ -f "$image_file" ]; then
            info "Loading image: $(basename "$image_file")"
            gunzip -c "$image_file" | docker load
        fi
    done
    
    # Start services
    info "Starting services..."
    docker-compose up -d --remove-orphans
    
    log "Restore completed successfully"
}

# Clean old backups
cleanup_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        info "No backup directory found"
        return
    fi
    
    local deleted_count=0
    
    find "$BACKUP_DIR" -type d -name "*_*" -mtime +"$RETENTION_DAYS" | while read -r old_backup; do
        local backup_name
        backup_name=$(basename "$old_backup")
        info "Deleting old backup: $backup_name"
        rm -rf "$old_backup"
        ((deleted_count++))
    done
    
    if [ "$deleted_count" -gt 0 ]; then
        log "Deleted $deleted_count old backups"
    else
        info "No old backups to delete"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        error "Backup name required"
        exit 1
    fi
    
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_path" ]; then
        error "Backup not found: $backup_name"
        exit 1
    fi
    
    log "Verifying backup: $backup_name"
    
    local issues=0
    
    # Check backup metadata
    if [ ! -f "$backup_path/backup_info.json" ]; then
        error "Missing backup metadata"
        ((issues++))
    fi
    
    # Check essential files
    local essential_files=("docker-compose.yml")
    for file in "${essential_files[@]}"; do
        if [ ! -f "$backup_path/$file" ]; then
            warning "Missing file: $file"
            ((issues++))
        fi
    done
    
    # Verify compressed files
    for compressed_file in "$backup_path"/*.tar.gz; do
        if [ -f "$compressed_file" ]; then
            if ! tar -tzf "$compressed_file" >/dev/null 2>&1; then
                error "Corrupted archive: $(basename "$compressed_file")"
                ((issues++))
            fi
        fi
    done
    
    if [ "$issues" -eq 0 ]; then
        log "Backup verification passed: $backup_name"
    else
        error "Backup verification failed: $issues issues found"
        return 1
    fi
}

# Schedule automatic backups (creates cron job)
schedule_backups() {
    local schedule="${1:-0 2 * * *}"  # Default: daily at 2 AM
    
    log "Scheduling automatic backups with cron: $schedule"
    
    local script_path
    script_path=$(realpath "$0")
    local cron_job="$schedule cd $(pwd) && $script_path create >/dev/null 2>&1"
    
    # Add to crontab
    (crontab -l 2>/dev/null | grep -v "$script_path"; echo "$cron_job") | crontab -
    
    log "Automatic backup scheduled"
}

# Show usage
usage() {
    echo "Usage: $0 {create|list|restore|cleanup|verify|schedule}"
    echo ""
    echo "Commands:"
    echo "  create [name]        - Create a new backup (optional name)"
    echo "  list                 - List available backups"
    echo "  restore <name>       -스 Restore from specific backup"
    echo "  cleanup              - Remove old backups based on retention policy"
    echo "  verify <name>        - Verify backup integrity"
    echo "  schedule [cron]      - Schedule automatic backups (default: daily 2 AM)"
    echo ""
    echo "Examples:"
    echo "  $0 create pre_update"
    echo "  $0 restore 20240101_120000"
    echo "  $0 schedule '0 */6 * * *'  # Every 6 hours"
    echo ""
}

# Main execution
main() {
    ensure_backup_dir
    
    case "$1" in
        create)
            create_backup "$2"
            ;;
        list)
            list_backups
            ;;
        restore)
            if [ -z "$2" ]; then
                error "Backup name required for restore"
                list_backups
                exit 1
            fi
            restore_backup "$2"
            ;;
        cleanup)
            cleanup_backups
            ;;
        verify)
            if [ -z "$2" ]; then
                error "Backup name required for verification"
                list_backups
                exit 1
            fi
            verify_backup "$2"
            ;;
        schedule)
            schedule_backups "$2"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"