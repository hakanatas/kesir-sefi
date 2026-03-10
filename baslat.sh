#!/bin/bash
# Kesir Şefi - Raspberry Pi 5 Temiz Başlatıcı (Web Sürümü)
# Bu sürüm mevcut klasörü yerelden servis eder; böylece son kod doğrudan test edilir.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=4182
VIDEO_NR="${VIDEO_NR:-42}"
VIDEO_DEVICE="${VIDEO_DEVICE:-/dev/video42}"

CHROMIUM_BIN="${CHROMIUM_BIN:-}"
if [ -z "$CHROMIUM_BIN" ]; then
  if command -v chromium >/dev/null 2>&1; then
    CHROMIUM_BIN="$(command -v chromium)"
  elif command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM_BIN="$(command -v chromium-browser)"
  else
    echo "Chromium bulunamadi. 'chromium' veya 'chromium-browser' kurulu olmali."
    exit 1
  fi
fi

echo "🧹 Eski süreçler temizleniyor..."
sudo pkill -f rpicam 2>/dev/null || true
sudo pkill -f ffmpeg 2>/dev/null || true
pkill -f chromium 2>/dev/null || true
pkill -f chromium-browser 2>/dev/null || true
pkill -f "http.server ${PORT}" 2>/dev/null || true
sudo rmmod v4l2loopback 2>/dev/null || true

echo "📦 Gerekli paketler kontrol ediliyor..."
sudo apt-get install -y gstreamer1.0-tools gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libcamera v4l2loopback-dkms v4l2loopback-utils >/dev/null 2>&1

echo "📹 Sanal kamera altyapısı (v4l2loopback) hazırlanıyor..."
sudo modprobe v4l2loopback devices=1 video_nr="${VIDEO_NR}" card_label="KesirSefiKamera" exclusive_caps=1
sleep 1

echo "▶️ GStreamer ile kamera akışı başlatılıyor..."
# camera-bridge.sh format fallback'lerini kullanır; Pi kamera negotiated hatalarında daha dayanıklıdır.
"$REPO_DIR/camera-bridge.sh" >/tmp/kesir-sefi-camera-bridge.log 2>&1 &
CAM_PID=$!

echo "⏳ Sanal kamera hazır bekleniyor..."
for _ in $(seq 1 30); do
  if [ -e "$VIDEO_DEVICE" ] && [ "$(cat "/sys/class/video4linux/$(basename "$VIDEO_DEVICE")/name" 2>/dev/null || true)" = "KesirSefiKamera" ]; then
    if ! command -v v4l2-ctl >/dev/null 2>&1 || v4l2-ctl --all -d "$VIDEO_DEVICE" >/dev/null 2>&1; then
      sleep 3
      break
    fi
  fi
  sleep 1
done

echo "🗂️ Yerel web sunucusu başlatılıyor..."
cd "$REPO_DIR"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1

echo "🌐 Tarayıcı (Kesir Şefi) açılıyor..."
# Yerel uygulamayı Chromium ile kısıtlamalar olmadan açıyoruz
"$CHROMIUM_BIN" \
  --app=http://127.0.0.1:${PORT}/index.html \
  --kiosk \
  --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=TranslateUI \
  --no-sandbox \
  --disable-gpu-compositing

# Tarayıcı (oyun) kapatıldığında arkadaki kamerayı da temizle
echo "🛑 Oyun kapatıldı, yerel sunucu ve kamera akışı durduruluyor..."
kill $SERVER_PID 2>/dev/null || true
kill $CAM_PID 2>/dev/null || true
sudo rmmod v4l2loopback 2>/dev/null || true
