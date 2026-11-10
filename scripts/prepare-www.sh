#!/usr/bin/env bash
# Gom file web vào www/ (webDir của Capacitor) + tải sẵn thư viện 800+ bài tập
set -e
rm -rf www && mkdir -p www/vendor
cp index.html style.css manifest.json sw.js icons.js firebase-config.js media-config.js video.js cloud.js data.js exdb.js app.js nutrition.js coach.js ptprofile.js pt.js privacy-policy.html www/
# free-exercise-db (Unlicense / Public Domain) — đóng gói kèm app để dùng offline
curl -fsSL https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json -o www/vendor/exercises.json \
  || echo "⚠️ Không tải được exercises.json — app sẽ tự tải khi có mạng"
mkdir -p www/assets && cp assets/bg-storm.jpg www/assets/
ls -la www www/vendor
