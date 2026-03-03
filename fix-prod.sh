#!/bin/bash
# fix-prod.sh
# Run this on the JUMP server (dayu@100.70.220.18)

ssh -o StrictHostKeyChecking=no -i /root/guntur-key.pem ubuntu@172.20.10.88 << 'EOF'
sudo su - << 'ROOT'
cd /root/11gawe
echo "=== Initializing Database ==="
npx prisma db push --accept-data-loss
echo "=== Seeding Dummy Data ==="
node seed-dummy.js
echo "=== Restarting PM2 ==="
pm2 restart business-os google-sync-worker || pm2 restart all
pm2 status
ROOT
EOF
