#!/bin/bash
# Script to run E2E tests with backend server

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting E2E test environment...${NC}"

# Get the project root directory
PROJECT_ROOT=$(dirname "$(dirname "$(realpath "$0")")")
cd "$PROJECT_ROOT"

# Function to cleanup on exit
cleanup() {
    echo -e "${GREEN}Cleaning up...${NC}"
    # Kill backend server if running
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Kill any existing process on port 8000
echo -e "${GREEN}Checking for existing processes on port 8000...${NC}"
if lsof -ti:8000 >/dev/null 2>&1; then
    echo -e "${GREEN}Killing existing process on port 8000...${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start backend server
echo -e "${GREEN}Starting backend server...${NC}"
cd backend
PYTHONPATH=src uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo -e "${GREEN}Waiting for backend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}Backend is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Backend failed to start after 30 seconds${NC}"
        exit 1
    fi
    sleep 1
done

# Run E2E tests (Chrome only for prototype)
echo -e "${GREEN}Running E2E tests (Chrome only)...${NC}"
cd "$PROJECT_ROOT/frontend"
npm run test:e2e -- --project chromium

# Exit with the test result
exit $?