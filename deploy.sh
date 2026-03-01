#!/bin/bash

# ==========================================
# Deployment Script for CoalTradeOS (Next.js)
# ==========================================

# Variables
APP_NAME="coaltrade_os"
BRANCH="main" # Ganti dengan nama branch jika berbeda

echo "🚀 Memulai proses deployment untuk $APP_NAME..."

# 1. Pastikan berada di directory yang benar
# cd /path/to/your/project # Uncomment dan sesuaikan ini jika diletakkan di luar folder project

# 2. Tarik kode terbaru dari repository Git
echo "⬇️ Pulling latest changes dari branch $BRANCH..."
git pull origin $BRANCH

# 3. Install dependencies terbaru
echo "📦 Menginstall dependencies Node.js..."
npm install

# 4. Build aplikasi Next.js (Production Build)
echo "🏗️ Membangun (Build) aplikasi..."
npm run build

# 5. Menjalankan / Me-restart aplikasi menggunakan PM2
# Note: PM2 sangat direkomendasikan untuk menjalankan Node.js app di Server Linux
echo "🔄 Restarting service dengan PM2..."
if pm2 status $APP_NAME | grep -q $APP_NAME; then
    # Jika sudah berjalan, cukup di-reload agar zero-downtime
    echo "Aplikasi sudah berjalan, melakukan reload..."
    pm2 reload $APP_NAME
else
    # Jika belum, start aplikasi dari awal
    echo "Aplikasi belum berjalan, mem-booting untuk pertama kalinya..."
    pm2 start npm --name "$APP_NAME" -- start
fi

# 6. Menyimpan konfigurasi PM2 agar otomatis jalan saat server direstart
pm2 save

echo "✅ Deployment berhasil diselesaikan!"
echo "Aplikasi berjalan di port yang terdefinisi (default Next.js Production: 3000)."
