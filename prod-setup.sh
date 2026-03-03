#!/bin/bash
# Full Production Reset Script for 11GAWE
# Location: /root/11gawe/prod-setup.sh
set -e

APP_DIR="/root/11gawe"
BRANCH="main"

echo "🚀 Starting Full Production Reset..."

# 1. Enter directory
cd $APP_DIR

# 2. Stop current processes to clear ports/memory
echo "🛑 Stopping and clearing PM2 processes..."
pm2 stop business-os || true
pm2 stop google-sync-worker || true
pm2 delete business-os || true
pm2 delete google-sync-worker || true

# 3. Clean environment
echo "🧹 Cleaning and pulling latest code..."
git fetch origin $BRANCH
git reset --hard origin/$BRANCH
git clean -fd

# 4. Install dependencies
echo "📦 Installing dependencies (npm reset)..."
# We'll use npm install which is usually sufficient, but clean node_modules if needed
# rm -rf node_modules
npm install

# 5. Database Sync
echo "📂 Synchronizing database schema..."
npx prisma db push --accept-data-loss

# 6. Seed Data
echo "🌱 Seeding dummy data..."
node seed-dummy.js

# 7. Build
echo "🏗️ Building Next.js application..."
npm run build

# 8. Start Services
echo "🔄 Starting PM2 services..."

# Start Next.js App
pm2 start npm --name "business-os" -- start

# Start Google Sync Worker
pm2 start npm --name "google-sync-worker" -- run sync

# Save PM2 state
pm2 save

echo "✅ Production Reset Complete!"
pm2 status
