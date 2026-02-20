#!/usr/bin/env bash
#
# Brand Me Now v2 -- DigitalOcean Droplet Setup Script
#
# Provisions a fresh Ubuntu 24.04 droplet with:
#   - Docker + Docker Compose
#   - UFW firewall (22, 80, 443 only)
#   - Fail2ban for SSH brute force protection
#   - Swap file (2GB)
#   - Non-root deploy user
#   - Caddy reverse proxy with automatic HTTPS
#
# Usage:
#   1. Create a DO droplet (Ubuntu 24.04, 4GB+ RAM recommended)
#   2. SSH in as root: ssh root@YOUR_DROPLET_IP
#   3. Run: curl -sSL https://raw.githubusercontent.com/SquizAI/bmn/main/deploy/setup-droplet.sh | bash
#   Or:  scp deploy/setup-droplet.sh root@YOUR_IP:/root/ && ssh root@YOUR_IP 'bash /root/setup-droplet.sh'
#
set -euo pipefail

DEPLOY_USER="deploy"
APP_DIR="/opt/bmn"
DOMAIN="${BMN_DOMAIN:-brandmenow.com}"
API_DOMAIN="${BMN_API_DOMAIN:-api.brandmenow.com}"
APP_DOMAIN="${BMN_APP_DOMAIN:-app.brandmenow.com}"

echo "================================================"
echo "  Brand Me Now v2 -- Droplet Setup"
echo "================================================"
echo ""

# ── 1. System updates ────────────────────────────────────────
echo "[1/8] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git ufw fail2ban \
  ca-certificates gnupg lsb-release \
  htop ncdu jq

# ── 2. Create deploy user ────────────────────────────────────
echo "[2/8] Creating deploy user..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
  echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER

  # Copy SSH keys from root
  mkdir -p /home/$DEPLOY_USER/.ssh
  cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
  chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
  chmod 700 /home/$DEPLOY_USER/.ssh
  chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
fi
echo "  User '$DEPLOY_USER' ready."

# ── 3. Install Docker ────────────────────────────────────────
echo "[3/8] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker $DEPLOY_USER
fi
echo "  Docker $(docker --version | cut -d' ' -f3) installed."

# ── 4. Install Docker Compose (v2 plugin) ────────────────────
echo "[4/8] Verifying Docker Compose..."
docker compose version || {
  apt-get install -y docker-compose-plugin
}
echo "  $(docker compose version)"

# ── 5. Configure firewall ────────────────────────────────────
echo "[5/8] Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "  Firewall: SSH(22), HTTP(80), HTTPS(443) allowed."

# ── 6. Configure fail2ban ────────────────────────────────────
echo "[6/8] Configuring fail2ban..."
cat > /etc/fail2ban/jail.local <<'JAIL'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
JAIL
systemctl enable fail2ban
systemctl restart fail2ban
echo "  fail2ban active (5 retries, 1h ban)."

# ── 7. Create swap file ──────────────────────────────────────
echo "[7/8] Creating 2GB swap file..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi
echo "  Swap: $(swapon --show | tail -1 | awk '{print $3}')"

# ── 8. Set up application directory ──────────────────────────
echo "[8/8] Setting up application directory..."
mkdir -p $APP_DIR
chown $DEPLOY_USER:$DEPLOY_USER $APP_DIR

# Create Caddyfile for automatic HTTPS
mkdir -p $APP_DIR/caddy
cat > $APP_DIR/caddy/Caddyfile <<CADDY
# Brand Me Now -- Caddy Reverse Proxy
# Automatic HTTPS via Let's Encrypt

$APP_DOMAIN {
    reverse_proxy client:80
}

$API_DOMAIN {
    reverse_proxy server:4847
}

$DOMAIN {
    redir https://$APP_DOMAIN{uri} permanent
}
CADDY

# Create docker-compose for Caddy
cat > $APP_DIR/docker-compose.caddy.yml <<'COMPOSE'
# Caddy reverse proxy with automatic HTTPS
services:
  caddy:
    image: caddy:2-alpine
    container_name: bmn-caddy
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - bmn-caddy-data:/data
      - bmn-caddy-config:/config
    restart: always
    networks:
      - bmn-external
      - bmn-internal

volumes:
  bmn-caddy-data:
  bmn-caddy-config:

networks:
  bmn-external:
    external: true
    name: bmn_bmn-external
  bmn-internal:
    external: true
    name: bmn_bmn-internal
COMPOSE

chown -R $DEPLOY_USER:$DEPLOY_USER $APP_DIR

echo ""
echo "================================================"
echo "  Setup complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. SSH as deploy user:  ssh $DEPLOY_USER@$(curl -s ifconfig.me)"
echo "  2. Clone the repo:      cd $APP_DIR && git clone https://github.com/SquizAI/bmn.git ."
echo "  3. Copy env file:       cp deploy/env.example .env.production"
echo "  4. Edit secrets:        nano .env.production"
echo "  5. Deploy:              bash deploy/deploy.sh"
echo ""
echo "  Point DNS A records to: $(curl -s ifconfig.me)"
echo "    $DOMAIN        -> $(curl -s ifconfig.me)"
echo "    $APP_DOMAIN    -> $(curl -s ifconfig.me)"
echo "    $API_DOMAIN    -> $(curl -s ifconfig.me)"
echo ""
