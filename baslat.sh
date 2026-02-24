#!/bin/bash
# Bulunulan dizinde (script'in olduğu klasörde) Python ile basit bir sunucu başlat
cd "$(dirname "$0")" || exit
python3 -m http.server 8000 &
SERVER_PID=$!

# Sunucunun başlaması için 2 saniye bekle
sleep 2

# Chromium'u tam ekran, çeviri olmadan ve otomatik medya oynatma izniyle başlat
# Raspberry Pi'de bazen 'chromium-browser' yerine komut ismi 'chromium' olabilir
# CSI kameralarını tarayıcıya /dev/video0 olarak göstermek için 'libcamerify' kullanıyoruz
if command -v libcamerify &> /dev/null; then
    BROWSER_CMD="libcamerify chromium"
else
    BROWSER_CMD="chromium"
fi

$BROWSER_CMD \
  --app=http://localhost:8000 \
  --kiosk \
  --window-position=0,0 \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=WebGPU,TranslateUI \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --noerrdialogs \
  --disable-infobars

# Tarayıcı kapatıldığında Python sunucusunu da durdur
kill $SERVER_PID
