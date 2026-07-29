# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/backend/package*.json ./
COPY package*.json ./
COPY apps/backend/tsconfig.json ./

# Install dependencies
RUN npm ci --workspace=apps/backend

# Copy source
COPY apps/backend/src ./src

# Build
RUN npm run build --workspace=apps/backend

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001

# Copy package files
COPY apps/backend/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --workspace=apps/backend && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist

# Create upload directory
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start
CMD ["node", "dist/index.js"]
