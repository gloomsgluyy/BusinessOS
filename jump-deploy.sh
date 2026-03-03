#!/bin/bash
set -e

echo "=== [1] Connecting to production server ==="
ssh -o StrictHostKeyChecking=no -i /root/guntur-key.pem ubuntu@172.20.10.88 << 'PROD'
echo "=== [2] On production server, switching to root ==="
sudo su - << 'ROOT'
echo "=== [3] Running as root on production ==="
cd /root/11gawe

echo "--- git force reset to match local/GitHub ---"
git fetch origin main
git reset --hard origin/main
git clean -fd

echo "--- npm install ---"
npm install

echo "--- npm build ---"
npm run build

echo "--- PM2 restart ---"
pm2 restart business-os
pm2 restart google-sync-worker || true

echo "--- PM2 status ---"
pm2 status

echo "=== DEPLOYMENT COMPLETE ==="
ROOT
PROD
