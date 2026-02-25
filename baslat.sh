#!/bin/bash
# Bulunulan dizinde (script'in olduğu klasörde) Python ile basit bir sunucu başlat
cd "$(dirname "$0")" || exit
# Önceki açık kalmış sunucuları kapat
pkill -f "python3 -m http.server 8000"
sleep 1

# Python ile basit bir sunucu başlat
python3 -m http.server 8000 &
SERVER_PID=$!

# Sunucunun başlaması için 5 saniye bekle
sleep 5

# Chromium'u tam ekran, çeviri olmadan ve otomatik medya oynatma izniyle başlat
# Raspberry Pi'de bazen 'chromium-browser' yerine komut ismi 'chromium' olabilir
# CSI kameralarını tarayıcıya /dev/video0 olarak göstermek için 'libcamerify' kullanıyoruz
if command -v libcamerify &> /dev/null; then
    BROWSER_CMD="libcamerify chromium"
else
    BROWSER_CMD="chromium"
fi

$BROWSER_CMD \
  --app=http://127.0.0.1:8000 \
  --kiosk \
  --window-position=0,0 \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=WebGPU,TranslateUI \
  --incognito \
  --disk-cache-dir=/dev/null \
  --disable-cache \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-gpu-compositing \
  --in-process-gpu \
  --noerrdialogs \
  --disable-infobars

# Tarayıcı kapatıldığında Python sunucusunu da durdur
kill $SERVER_PID
