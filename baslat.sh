#!/bin/bash
# Kesir Şefi - Raspberry Pi 5 Temiz Başlatıcı (Web Sürümü)
# Doğrudan GitHub Pages üzerinden açılır, yerel sunucuya ihtiyaç yoktur.

echo "🧹 Eski süreçler temizleniyor..."
sudo pkill -f rpicam
sudo pkill -f ffmpeg
pkill -f chromium
sudo rmmod v4l2loopback 2>/dev/null

echo "📦 Gerekli paketler kontrol ediliyor..."
sudo apt-get install -y gstreamer1.0-tools gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libcamera v4l2loopback-dkms >/dev/null 2>&1

echo "📹 Sanal kamera altyapısı (v4l2loopback) hazırlanıyor..."
sudo modprobe v4l2loopback devices=1 video_nr=10 card_label="KesirSefiKamera" exclusive_caps=1
sleep 1

echo "▶️ GStreamer ile kamera akışı başlatılıyor..."
# GStreamer kullanarak doğrudan ve uyumlu bir şekilde sanal kameraya yayın veriyoruz
gst-launch-1.0 libcamerasrc ! video/x-raw,width=640,height=480,framerate=30/1 ! videoconvert ! v4l2sink device=/dev/video10 >/dev/null 2>&1 &
CAM_PID=$!

# Kameranın kendine gelmesi için 2 saniye bekliyoruz
sleep 2

echo "🌐 Tarayıcı (Kesir Şefi) açılıyor..."
# GitHub Pages adresini Chromium ile kısıtlamalar olmadan açıyoruz
chromium \
  --app=https://hakanatas.github.io/kesir-sefi \
  --kiosk \
  --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=TranslateUI \
  --no-sandbox \
  --disable-gpu-compositing

# Tarayıcı (oyun) kapatıldığında arkadaki kamerayı da temizle
echo "🛑 Oyun kapatıldı, kamera akışı durduruluyor..."
kill $CAM_PID
sudo rmmod v4l2loopback 2>/dev/null
