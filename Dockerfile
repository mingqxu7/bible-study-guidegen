# ==============================================================================
# Bible Study Guide Generator — Multi-stage Docker Build
# ==============================================================================

# --- Stage 1: Build frontend ---
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production ---
FROM node:22-alpine

RUN apk add --no-cache nginx

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev --ignore-scripts

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
