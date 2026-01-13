# Multi-stage Docker build for LLM Proxy Service
FROM node:22-alpine AS base

# Install security dependencies
RUN apk add --no-cache libc6-compat dumb-init

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
# Install all dependencies (including dev) for build
RUN npm ci && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 llmproxy

# Copy built application and production dependencies only
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy configuration files
COPY config ./config

# Set ownership
RUN chown -R llmproxy:nodejs /app

USER llmproxy

# Expose port
EXPOSE 3000

# Health check (fixed - uses node directly)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
