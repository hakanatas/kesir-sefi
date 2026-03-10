#!/bin/bash
# Kesir Sefi - Raspberry Pi kiosk installer

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/kesir-sefi-kiosk.desktop"
SERVICE_NAME="kesir-sefi-camera.service"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}"
TARGET_USER="${SUDO_USER:-$USER}"

if [ "${1:-}" = "uninstall" ]; then
    echo "Kesir Sefi kiosk kurulumu kaldiriliyor..."
    rm -f "$DESKTOP_FILE"
    sudo systemctl disable --now "$SERVICE_NAME" 2>/dev/null || true
    sudo rm -f "$SERVICE_FILE"
    sudo systemctl daemon-reload
    echo "Kaldirildi."
    exit 0
fi

echo "1/4 paketler kuruluyor..."
CHROMIUM_PACKAGE="chromium"
if ! apt-cache show "$CHROMIUM_PACKAGE" >/dev/null 2>&1; then
    CHROMIUM_PACKAGE="chromium-browser"
fi

sudo apt update -qq
sudo apt install -y \
    "$CHROMIUM_PACKAGE" \
    python3 \
    curl \
    unclutter \
    v4l-utils \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-libcamera \
    v4l2loopback-dkms

echo "2/4 script izinleri ayarlaniyor..."
chmod +x "$REPO_DIR/baslat.sh" "$REPO_DIR/camera-bridge.sh" "$REPO_DIR/kiosk.sh" "$REPO_DIR/install-kiosk.sh"
sudo usermod -aG video "$TARGET_USER"

echo "3/4 kamera servisi kuruluyor..."
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Kesir Sefi camera bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/bin/bash -lc 'exec "$REPO_DIR/camera-bridge.sh"'
ExecStopPost=/bin/bash -lc 'pkill -f "gst-launch-1.0 libcamerasrc" 2>/dev/null || true; rmmod v4l2loopback 2>/dev/null || true'
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"

echo "4/4 kiosk autostart ayarlaniyor..."
mkdir -p "$AUTOSTART_DIR"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Kesir Sefi Kiosk
Comment=Kesir Sefi sayfasini kiosk modunda ac
Exec=/bin/bash -lc 'exec "$REPO_DIR/kiosk.sh"'
Terminal=false
Hidden=false
X-GNOME-Autostart-enabled=true
X-LXDE-Autostart=true
EOF

echo
echo "Kurulum tamamlandi."
echo "Bir sonraki yeniden baslatmada Raspberry Pi, masaustu oturumu acildiginda uygulamayi kiosk modunda baslatacak."
echo "Not: '$TARGET_USER' kullanicisi video grubuna eklendi; bu degisiklik icin reboot gereklidir."
echo "Manuel test: $REPO_DIR/kiosk.sh"
echo "Kaldirma: $REPO_DIR/install-kiosk.sh uninstall"
