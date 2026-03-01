#!/bin/bash
# ============================================================
#  Business OS — Server Auto-Configuration Script
#  Tested on: Ubuntu 22.04 / 24.04 LTS
# ============================================================

set -euo pipefail

APP_NAME="business-os"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_VERSION="20"
PM2_APP_NAME="$APP_NAME"
PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── 1. System update ──────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Business OS — Server Setup"
echo "═══════════════════════════════════════════════════════"
echo ""

log "Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git build-essential nginx certbot python3-certbot-nginx

# ── 2. Node.js via NodeSource ─────────────────────────────────
if command -v node &>/dev/null; then
  CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$CURRENT_NODE" -ge "$NODE_VERSION" ]; then
    log "Node.js v$(node -v) already installed"
  else
    warn "Node.js version too old, upgrading..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
else
  log "Installing Node.js v${NODE_VERSION}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi

log "Node: $(node -v) | NPM: $(npm -v)"

# ── 3. PM2 ────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  log "Installing PM2..."
  sudo npm install -g pm2
else
  log "PM2 already installed"
fi

# ── 4. Project setup ──────────────────────────────────────────
cd "$APP_DIR"

if [ ! -f ".env.local" ]; then
  warn "No .env.local found. Creating template..."
  cat > .env.local << 'EOF'
# Google Sheets
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SHEETS_CREDENTIALS={}

# Twilio / WhatsApp
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
  warn "⚠  Edit .env.local with your actual credentials before running!"
fi

log "Installing dependencies..."
npm ci --production=false 2>/dev/null || npm install

log "Building Next.js application..."
npm run build || fail "Build failed! Check errors above."

# ── 5. PM2 Process ────────────────────────────────────────────
log "Starting application with PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
pm2 start npm --name "$PM2_APP_NAME" -- start -- -p $PORT
pm2 save
pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null || true

# ── 6. Nginx Reverse Proxy ────────────────────────────────────
log "Configuring Nginx..."

NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
sudo tee "$NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Static files cache
    location /_next/static/ {
        proxy_pass http://127.0.0.1:$PORT;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

log "Nginx configured successfully"

# ── 7. Firewall ───────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  log "Configuring firewall..."
  sudo ufw allow 'Nginx Full'
  sudo ufw --force enable 2>/dev/null || true
fi

# ── 8. Done ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "  ${GREEN}Setup Complete!${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Application: http://$(hostname -I | awk '{print $1}'):80"
echo "  PM2 Status:  pm2 status"
echo "  PM2 Logs:    pm2 logs $PM2_APP_NAME"
echo ""
echo "  Next steps:"
echo "    1. Edit .env.local with real credentials"
echo "    2. Run: pm2 restart $PM2_APP_NAME"
echo "    3. (Optional) Setup SSL:"
echo "       sudo certbot --nginx -d yourdomain.com"
echo ""
