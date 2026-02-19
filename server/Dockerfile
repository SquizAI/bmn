# server/Dockerfile

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:22-alpine AS deps

WORKDIR /app

# Copy dependency files only (for layer caching)
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install production dependencies only
RUN npm install --omit=dev

# ============================================
# Stage 2: Build (if needed for future TS/build step)
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install

# Copy source code
COPY src/ ./src/

# ============================================
# Stage 3: Production
# ============================================
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S bmn && \
    adduser -S bmn -u 1001 -G bmn

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source from build stage
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json

# Set ownership to non-root user
RUN chown -R bmn:bmn /app

USER bmn

# Expose port
EXPOSE 4847

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4847/health || exit 1

# Start the server
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
