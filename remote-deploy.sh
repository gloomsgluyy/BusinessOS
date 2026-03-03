#!/bin/bash
# Script to be executed on the jump server (dayu@100.70.220.18)
# Then it will SSH into the production server and deploy

# Switch to root
echo "dayudestamy" | sudo -S bash << 'SUDO_BLOCK'
echo "On jump server as root"
# SSH into production guntur server
ssh -o StrictHostKeyChecking=no -i /home/dayu/guntur-key.pem ubuntu@172.20.10.88 << 'PROD_BLOCK'
# Now on production server - switch to root
sudo su -c '
cd /root/11gawe
echo "=== Current directory ==="
pwd
echo "=== Git pull ==="
git pull origin main
echo "=== NPM install ==="
npm install --production=false
echo "=== NPM build ==="
npm run build
echo "=== PM2 restart ==="
pm2 restart business-os
pm2 restart google-sync-worker
echo "=== PM2 status ==="
pm2 status
echo "=== DEPLOYMENT COMPLETE ==="
'
PROD_BLOCK
SUDO_BLOCK
