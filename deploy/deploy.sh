#!/usr/bin/env bash
#
# Brand Me Now v2 -- Deploy Script
#
# Run from the project root on the production server.
# Prerequisites: Docker, Docker Compose, .env.production file
#
# Usage:
#   bash deploy/deploy.sh              # Full deploy (pull + build + restart)
#   bash deploy/deploy.sh --no-build   # Deploy without rebuilding (just restart)
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

NO_BUILD=false
if [ "${1:-}" = "--no-build" ]; then
  NO_BUILD=true
fi

# Compose files -- base + Caddy overlay for HTTPS
COMPOSE_FILES="-f docker-compose.prod.yml -f docker-compose.caddy.yml"

echo "================================================"
echo "  Brand Me Now v2 -- Deploy"
echo "  Directory: $APP_DIR"
echo "  Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================"
echo ""

# ── 1. Pre-flight checks ─────────────────────────────────────
echo "[1/6] Pre-flight checks..."

if [ ! -f ".env.production" ]; then
  echo "  ERROR: .env.production not found!"
  echo "  Copy deploy/env.example to .env.production and fill in your secrets."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "  ERROR: Docker is not installed. Run deploy/setup-droplet.sh first."
  exit 1
fi

# Source production env vars so Docker build args get populated
set -a
source .env.production
set +a
echo "  .env.production sourced."
echo "  Pre-flight OK."

# ── 2. Pull latest code ──────────────────────────────────────
echo "[2/6] Pulling latest code..."
git pull origin main || { echo "  WARN: git pull failed, deploying current state."; }
echo "  At: $(git log --oneline -1)"

# ── 3. Build images ──────────────────────────────────────────
if [ "$NO_BUILD" = false ]; then
  echo "[3/6] Building Docker images..."
  docker compose $COMPOSE_FILES build --parallel
  echo "  Images built."
else
  echo "[3/6] Skipping build (--no-build flag)."
fi

# ── 4. Stop old containers ───────────────────────────────────
echo "[4/6] Stopping existing containers..."
docker compose $COMPOSE_FILES down --timeout 30 --remove-orphans
echo "  Containers stopped."

# ── 5. Start new containers ──────────────────────────────────
echo "[5/6] Starting containers..."
docker compose $COMPOSE_FILES up -d
echo "  Containers started."

# ── 6. Health check ──────────────────────────────────────────
echo "[6/6] Running health checks..."
echo "  Waiting 15 seconds for services to start..."
sleep 15

# Check server health
SERVER_HEALTH=$(docker compose $COMPOSE_FILES exec -T server wget -qO- http://localhost:4847/health 2>/dev/null || echo '{"status":"unhealthy"}')
SERVER_STATUS=$(echo "$SERVER_HEALTH" | jq -r '.status' 2>/dev/null || echo "unknown")

if [ "$SERVER_STATUS" = "healthy" ]; then
  echo "  Server: HEALTHY"
else
  echo "  Server: UNHEALTHY -- check logs: docker compose $COMPOSE_FILES logs server"
fi

# Check client health (via Caddy)
CLIENT_STATUS=$(docker compose $COMPOSE_FILES exec -T client wget -qO- http://localhost:80/ 2>/dev/null && echo "healthy" || echo "unhealthy")
if [ "$CLIENT_STATUS" = "healthy" ]; then
  echo "  Client: HEALTHY"
else
  echo "  Client: UNHEALTHY -- check logs: docker compose $COMPOSE_FILES logs client"
fi

# Show running containers
echo ""
echo "Running containers:"
docker compose $COMPOSE_FILES ps

echo ""
echo "================================================"
echo "  Deploy complete!"
echo "================================================"
echo ""
echo "Useful commands:"
echo "  Logs:     docker compose $COMPOSE_FILES logs -f"
echo "  Server:   docker compose $COMPOSE_FILES logs -f server"
echo "  Client:   docker compose $COMPOSE_FILES logs -f client"
echo "  Caddy:    docker compose $COMPOSE_FILES logs -f caddy"
echo "  Restart:  docker compose $COMPOSE_FILES restart"
echo "  Status:   docker compose $COMPOSE_FILES ps"
echo "  Rollback: git checkout HEAD~1 && bash deploy/deploy.sh"
echo ""
