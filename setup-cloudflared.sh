#!/bin/bash
set -e

DOMAIN="production.sangkaraprasetya.site"
TUNNEL_NAME="business-os-production"
PORT="3000"

echo "====================================================="
echo "☁️ Starting Cloudflare Tunnel Setup for $DOMAIN"
echo "====================================================="

# 1. Install cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing cloudflared..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

# 2. Login
CONFIG_DIR="/root/.cloudflared"
CERT_FILE="$CONFIG_DIR/cert.pem"

if [ ! -f "$CERT_FILE" ]; then
    echo "🔑 Please authenticate with Cloudflare..."
    echo "A link will appear below. Open it in your browser and authorize the domain 'sangkaraprasetya.site'."
    echo "--------------------------------------------------------"
    cloudflared tunnel login
else
    echo "🔑 Cloudflare authentication certificate found. Skipping login..."
fi

# 3. Create Tunnel & Fetch UUID
echo "� Checking if tunnel '$TUNNEL_NAME' exists..."
EXISTING_TUNNEL=$(cloudflared tunnel list | grep -w "$TUNNEL_NAME" || true)

if [ -z "$EXISTING_TUNNEL" ]; then
    echo "🚇 Creating new tunnel '$TUNNEL_NAME'..."
    cloudflared tunnel create "$TUNNEL_NAME"
    TUNNEL_UUID=$(cloudflared tunnel list | grep -w "$TUNNEL_NAME" | awk '{print $1}')
else
    echo "🚇 Tunnel '$TUNNEL_NAME' already exists. Reusing it..."
    TUNNEL_UUID=$(echo "$EXISTING_TUNNEL" | awk '{print $1}')
fi

if [ -z "$TUNNEL_UUID" ]; then
    echo "❌ Failed to retrieve Tunnel UUID."
    exit 1
fi

CRED_FILE="$CONFIG_DIR/${TUNNEL_UUID}.json"

CONFIG_FILE="$CONFIG_DIR/config.yml"

# Remove old config.yml just in case it's conflicting
rm -f "$CONFIG_FILE"

echo "📄 Creating config.yml for Tunnel $TUNNEL_UUID..."
cat <<EOF > "$CONFIG_FILE"
tunnel: $TUNNEL_UUID
credentials-file: $CRED_FILE

ingress:
  - hostname: $DOMAIN
    service: http://localhost:$PORT
  - service: http_status:404
EOF

# 4. Route DNS
echo "🌐 Routing DNS for $DOMAIN..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" || echo "DNS route already exists. Skipping..."

# 5. Install & Restart Service
echo "⚙️ Installing Cloudflared as a system service..."
# Stop and clean old service completely just in case
systemctl stop cloudflared || true
cloudflared service uninstall || true

# Remove conflicting default system-wide configuration
rm -f /etc/cloudflared/config.yml

# Re-install service with explicit configuration path
cloudflared --config "$CONFIG_FILE" service install

# Enable and restart the service
echo "🔄 Starting tunnel service..."
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared

echo "====================================================="
echo "✅ Cloudflare Tunnel Setup Complete!"
echo "🌍 Your application should now be securely available at:"
echo "👉 https://$DOMAIN"
echo "====================================================="
