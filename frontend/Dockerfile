# Multi-stage Dockerfile for Yuragi Haptic Generator Frontend
# Optimized for production deployment with minimal image size
#
# IMPORTANT: This Dockerfile is designed to be built from the repo root
# because the repo is a pnpm workspace: pnpm-lock.yaml, pnpm-workspace.yaml,
# and .npmrc all live at the root, not inside ./frontend.
# Build with:   docker build -f frontend/Dockerfile --target <stage> .

# Build stage
FROM node:20-alpine as builder

WORKDIR /workspace

ENV NODE_ENV=production \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"

# Activate pnpm version pinned in frontend/package.json (packageManager field)
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy workspace manifests first for cache-friendly install
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend/package.json ./frontend/

# Install frontend deps (including devDependencies — tsc/vite needed for build)
RUN pnpm install --frozen-lockfile --prod=false --filter "./frontend"

# Copy frontend source
COPY frontend/ ./frontend/

WORKDIR /workspace/frontend

# Use production env file at build time
COPY frontend/.env.production .env

# Build the application with production optimizations
RUN pnpm run build:production

# Production stage - Nginx
FROM nginx:alpine as production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html

# nginx:alpine already provides the `nginx` user/group — reuse it.

# Set ownership and permissions on dirs nginx needs to write/read
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Create pid file directory
RUN mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/run/nginx

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Development stage
FROM node:20-alpine as development

WORKDIR /workspace

ENV NODE_ENV=development \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend/package.json ./frontend/

# Install all deps including dev
RUN pnpm install --frozen-lockfile --filter "./frontend"

COPY frontend/ ./frontend/

WORKDIR /workspace/frontend

COPY frontend/.env.development .env

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["pnpm", "run", "dev", "--host", "0.0.0.0"]
