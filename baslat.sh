#!/bin/bash
# Bulunulan dizinde Python ile basit bir sunucu başlat (Arkada çalışsın)
python3 -m http.server 8000 &
SERVER_PID=$!

# Sunucunun başlaması için 2 saniye bekle
sleep 2

# Chromium'u tam ekran, çeviri olmadan ve otomatik medya oynatma izniyle başlat
# Raspberry Pi'de bazen 'chromium-browser' yerine komut ismi 'chromium' olabilir
chromium \
  --app=http://localhost:8000 \
  --kiosk \
  --window-position=0,0 \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --enable-features=V4L2VideoDecoder \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=TranslateUI \
  --noerrdialogs \
  --disable-infobars

# Tarayıcı kapatıldığında Python sunucusunu da durdur
kill $SERVER_PID
