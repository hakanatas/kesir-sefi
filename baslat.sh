#!/bin/bash
# Bulunulan dizinde (script'in olduğu klasörde) Python ile basit bir sunucu başlat
cd "$(dirname "$0")" || exit

# Önceden açık kalmış sunucuları kapat
pkill -f "python3 -m http.server 8000"
sleep 1

# Python ile basit bir sunucu başlat (IPv4 bağlamı otomatik)
python3 -m http.server 8000 &
SERVER_PID=$!

# Sunucunun başlaması için 5 saniye bekle
sleep 5

# Chromium (veya chromium-browser) komutunu bul
if command -v libcamerify >/dev/null 2>&1; then
    BROWSER_CMD="libcamerify chromium"
else
    BROWSER_CMD="chromium"
fi

# Geçici bir cache klasörü oluştur (her çalıştırmada temiz)
CACHE_DIR="/tmp/chromium_cache_$(date +%s)"
mkdir -p "$CACHE_DIR"

# Chromium'u başlat (incognito + cache yönlendirme)
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
  --disk-cache-dir="$CACHE_DIR" \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-gpu-compositing \
  --in-process-gpu \
  --noerrdialogs \
  --disable-infobars

# Tarayıcı kapandığında Python sunucusunu da durdur
kill $SERVER_PID
