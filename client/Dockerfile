# client/Dockerfile
#
# Multi-stage build for the React 19 + Vite 7 SPA.
# Build context: repo root (to include shared/ directory)
# Stage 1: Install deps + build static assets
# Stage 2: Serve via Nginx Alpine

# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

# Copy dependency files
COPY client/package.json client/package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy client source code
COPY client/ .

# Copy shared schemas into ../shared (Vite @shared alias resolves to ../shared)
# Symlink node_modules so shared schemas can resolve zod
COPY shared/ ../shared/
RUN ln -s /app/node_modules /shared/node_modules

# Build the production bundle
ARG VITE_API_URL=http://localhost:4847
ARG VITE_WS_URL=ws://localhost:4847
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ARG VITE_SENTRY_DSN

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

RUN npm run build

# ============================================
# Stage 2: Serve with Nginx
# ============================================
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Security: run as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
