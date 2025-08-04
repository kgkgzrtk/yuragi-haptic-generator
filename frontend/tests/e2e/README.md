# E2E Testing Guide

This guide explains how to run and manage end-to-end (E2E) tests for the Yuragi Haptic Generator frontend.

## Overview

The E2E tests use Playwright to test the complete application flow, including interactions between the frontend and backend. These tests ensure that all components work together correctly in a real browser environment.

> **Note**: As this is a prototype, E2E tests are configured to run only in Chrome/Chromium browser to reduce test execution time and complexity.

## Prerequisites

- Node.js 16+ and pnpm installed
- Python 3.9+ with uv package manager
- Backend dependencies installed (`uv pip install -e ".[api]"` in backend directory)
- Frontend dependencies installed (`pnpm install` in frontend directory)
- Playwright browsers installed (`pnpm exec playwright install`)

## Running E2E Tests

### Method 1: Using the Test Script (Recommended)

The easiest way to run E2E tests is using the provided script that handles starting the backend server:

```bash
# From the project root
./scripts/run-e2e-tests.sh
```

This script will:

1. Start the backend server on port 8000
2. Wait for the backend to be ready
3. Run the E2E tests in Chrome/Chromium only
4. Clean up by stopping the backend server

### Method 2: Using Docker Compose

You can use Docker Compose to run both frontend and backend services:

```bash
# From the project root
docker compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
sleep 10

# Run E2E tests
cd frontend
npm run test:e2e

# Stop services when done
docker compose -f docker-compose.dev.yml down
```

### Method 3: Manual Setup

If you prefer to run services manually:

1. **Start the backend server** (in terminal 1):

```bash
cd backend
PYTHONPATH=src uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

2. **Run E2E tests** (in terminal 2):

```bash
cd frontend
npm run test:e2e -- --project chromium  # Chrome only for prototype
```

## Test Configuration

The E2E tests are configured in `playwright.config.ts` with the following settings:

- **Base URL**: `http://localhost:3000`
- **Browsers**: Chromium only (for prototype phase)
  - Full browser support (Firefox, WebKit, Mobile) can be enabled in production
- **Parallel execution**: Enabled (except on CI)
- **Retries**: 2 on CI, 0 locally
- **Timeouts**:
  - Test timeout: 30 seconds
  - Action timeout: 10 seconds
  - Navigation timeout: 30 seconds

## Test Structure

E2E tests are organized by feature:

```
tests/e2e/
├── app.smoke.spec.ts          # Basic application functionality
├── channel-controls.spec.ts   # Channel parameter controls
├── error-handling.spec.ts     # Error scenarios and recovery
├── streaming-controls.spec.ts # Audio streaming functionality
└── vector-controls.spec.ts    # Vector force controls
```

## Writing E2E Tests

When writing new E2E tests:

1. Use page objects for common interactions
2. Test user workflows rather than implementation details
3. Include both happy path and error scenarios
4. Use proper waiting strategies for async operations
5. Add descriptive test names and comments

Example test structure:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name - Test Category', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Setup code
  })

  test('should perform specific action', async ({ page }) => {
    // Arrange
    await page.waitForSelector('[data-testid="element"]')

    // Act
    await page.click('[data-testid="button"]')

    // Assert
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
  })
})
```

## Debugging Tests

### View test execution in browser (Chrome only)

```bash
npm run test:e2e:headed -- --project chromium
```

### Debug specific test (Chrome only)

```bash
npm run test:e2e:debug -- --project chromium
```

### View test report

```bash
npm run test:e2e:report
```

### Using Playwright UI (Chrome only)

```bash
npm run test:e2e:ui -- --project chromium
```

## CI/CD Integration

E2E tests run automatically in CI with the following differences:

- Sequential execution (workers=1)
- 2 retries for flaky tests
- GitHub Actions reporter
- Results saved as artifacts

## Common Issues

### Backend Connection Refused

**Error**: `net::ERR_CONNECTION_REFUSED`
**Solution**: Ensure the backend server is running on port 8000

### WebSocket Connection Failed

**Error**: `WebSocket connection to 'ws://localhost:8000/ws' failed`
**Solution**: Check that the backend WebSocket endpoint is accessible

### Test Timeouts

**Error**: Test timeout exceeded
**Solution**:

- Increase timeout in specific tests: `test.setTimeout(60000)`
- Check for proper waiting strategies
- Ensure backend is responding quickly

### Browser Installation

**Error**: Browser not found
**Solution**: Run `pnpm exec playwright install`

## Performance Tips

1. Run tests in parallel when possible
2. Use `test.only` during development to run specific tests
3. Reuse browser context for related tests
4. Mock external API calls when appropriate
5. Use proper selectors (data-testid preferred)

## Maintenance

- Update Playwright regularly: `pnpm update @playwright/test`
- Review and update tests when UI changes
- Monitor test execution time and optimize slow tests
- Keep test data minimal and focused
