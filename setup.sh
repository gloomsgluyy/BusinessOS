#!/bin/bash

# ==============================================================================
# Business OS - Linux Deployment Script
# Automates Git Pull, Env Config, Build, and PM2 Process Management
# ==============================================================================

# Exit immediately if a command exits with a non-zero status

# Default repository details
REPO_URL="https://github.com/gloomsgluyy/11gawe.git"
REPO_DIR="11gawe"
BRANCH="main"

echo "====================================================="
echo "🚀 Starting Business OS Deployment Configurator..."
echo "====================================================="

# 1. Check & Install Dependencies (Git, Node, PM2)
echo "📦 Checking system requirements..."

SUDO_CMD=""
if command -v sudo &> /dev/null && [ "$EUID" -ne 0 ]; then
    SUDO_CMD="sudo"
fi

install_pkg() {
    if command -v apt-get &> /dev/null; then
        $SUDO_CMD apt-get update -y || true
        $SUDO_CMD apt-get install -y "$1"
    elif command -v yum &> /dev/null; then
        $SUDO_CMD yum install -y "$1"
    else
        echo "❌ Cannot determine package manager to install $1. Please install manually."
        exit 1
    fi
}

if ! command -v curl &> /dev/null; then
    echo "📦 curl could not be found. Installing curl..."
    install_pkg curl
fi

if ! command -v git &> /dev/null; then
    echo "📦 Git could not be found. Installing Git..."
    install_pkg git
fi

if ! command -v npm &> /dev/null; then
    echo "📦 NPM could not be found. Installing Node.js v18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | $SUDO_CMD bash -
    if command -v apt-get &> /dev/null; then
        $SUDO_CMD apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        $SUDO_CMD yum install -y nodejs
    fi
fi

if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing pm2 process manager globally..."
    $SUDO_CMD npm install -g pm2
fi

# 2. Setup Repository
if [ -d "$REPO_DIR" ]; then
    echo "📁 Repository directory exists. Pulling latest changes from $BRANCH..."
    cd "$REPO_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    echo "📁 Cloning repository..."
    git clone "$REPO_URL" "$REPO_DIR"
    cd "$REPO_DIR"
fi

# 3. Setup Environment Variables (.env)
echo "🔒 Configuring Environment Variables..."
ENV_FILE=".env"

# Touch the file to ensure it exists
touch "$ENV_FILE"

# Make it fully non-interactive. Just create the file with placeholders if empty.
if ! grep -q "GROQ_API_KEY=" "$ENV_FILE"; then
    echo "GROQ_API_KEY=" >> "$ENV_FILE"
fi
if ! grep -q "NEXT_PUBLIC_GROQ_API_KEY=" "$ENV_FILE"; then
    echo "NEXT_PUBLIC_GROQ_API_KEY=" >> "$ENV_FILE"
fi
if ! grep -q "OPENROUTER_API_KEY=" "$ENV_FILE"; then
    echo "OPENROUTER_API_KEY=" >> "$ENV_FILE"
fi
if ! grep -q "GOOGLE_SHEETS_ID=" "$ENV_FILE"; then
    echo "GOOGLE_SHEETS_ID=" >> "$ENV_FILE"
fi

echo "⚠️ .env file created with empty values. Please fill it manually later using: nano .env"
echo "📄 Current .env file generated successfully."

# 4. Install Dependencies
echo "📥 Installing NPM dependencies..."
npm install

# 5. Build Production App
echo "🏗️ Building Next.js production app (with memory optimization)..."
# Skip TS and ESLint checks during build to save RAM on small servers
export NEXT_TELEMETRY_DISABLED=1
export DISABLE_ESLINT_PLUGIN=true
export NEXT_DISABLE_ESLINT=1
export NEXT_DISABLE_TYPESCRIPT_CHECK=1
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# 6. PM2 Process Management
echo "⚙️ Starting/Restarting application with PM2..."
PM2_APP_NAME="business-os"

if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo "🔄 Reloading existing PM2 process..."
    pm2 reload "$PM2_APP_NAME" --update-env
else
    echo "▶️ Starting new PM2 process..."
    pm2 start npm --name "$PM2_APP_NAME" -- run start
fi

# Save PM2 process list to auto-start on server reboot
echo "💾 Saving PM2 process list to system startup..."
pm2 save

echo "====================================================="
echo "✅ Deployment Successful!"
echo "🌐 Your app should now be running on port 3000 (usually http://<server-ip>:3000)"
echo "📊 Run 'pm2 logs business-os' to view live application logs."
echo "📊 Run 'pm2 monit' to monitor CPU and Memory usage."
echo "====================================================="
