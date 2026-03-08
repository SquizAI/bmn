# client-storefront/Dockerfile
#
# Multi-stage build for the public-facing storefront SPA.
# Build context: repo root (same pattern as client/)
# Stage 1: Install deps + build static assets with Vite
# Stage 2: Serve via Nginx Alpine

# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

# Copy dependency files
COPY client-storefront/package.json ./
COPY package-lock.json ../package-lock.json

# Install all dependencies (including devDependencies for build)
RUN npm install --legacy-peer-deps

# Copy storefront source code
COPY client-storefront/ .

# Build the production bundle
ARG VITE_API_URL=http://localhost:4847

ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ============================================
# Stage 2: Serve with Nginx
# ============================================
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY client-storefront/nginx.conf /etc/nginx/conf.d/default.conf

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
