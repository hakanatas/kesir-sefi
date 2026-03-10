#!/bin/bash
# Kesir Sefi - Raspberry Pi kiosk launcher

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-4182}"
URL="http://127.0.0.1:${PORT}/index.html"
LOG_DIR="$REPO_DIR/logs"
SERVER_LOG="$LOG_DIR/http-server.log"
KIOSK_LOG="$LOG_DIR/kiosk.log"
VIDEO_DEVICE="${VIDEO_DEVICE:-/dev/video42}"

mkdir -p "$LOG_DIR"

CHROMIUM_BIN="${CHROMIUM_BIN:-}"
if [ -z "$CHROMIUM_BIN" ]; then
    if command -v chromium >/dev/null 2>&1; then
        CHROMIUM_BIN="$(command -v chromium)"
    elif command -v chromium-browser >/dev/null 2>&1; then
        CHROMIUM_BIN="$(command -v chromium-browser)"
    else
        echo "Chromium bulunamadi." | tee -a "$KIOSK_LOG"
        exit 1
    fi
fi

stop_kiosk() {
    pkill -f "python3 -m http.server ${PORT}" 2>/dev/null || true
    pkill -f "${CHROMIUM_BIN}.*127.0.0.1:${PORT}/index.html" 2>/dev/null || true
}

wait_for_video_ready() {
    local device_name_file="/sys/class/video4linux/$(basename "$VIDEO_DEVICE")/name"

    for _ in $(seq 1 30); do
        if [ -e "$VIDEO_DEVICE" ]; then
            if [ ! -r "$device_name_file" ]; then
                sleep 1
                continue
            fi

            if [ "$(cat "$device_name_file" 2>/dev/null || true)" != "KesirSefiKamera" ]; then
                sleep 1
                continue
            fi

            if command -v v4l2-ctl >/dev/null 2>&1; then
                if ! v4l2-ctl --all -d "$VIDEO_DEVICE" >/dev/null 2>&1; then
                    sleep 1
                    continue
                fi
            fi

            sleep 3
            return 0
        fi
        sleep 1
    done

    return 1
}

if [ "${1:-}" = "stop" ]; then
    stop_kiosk
    exit 0
fi

export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

stop_kiosk
sleep 1

xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

if command -v unclutter >/dev/null 2>&1; then
    pkill -x unclutter 2>/dev/null || true
    unclutter -idle 0.5 -root >/dev/null 2>&1 &
fi

echo "$(date '+%F %T') kiosk launcher starting" >> "$KIOSK_LOG"

cd "$REPO_DIR"
python3 -m http.server "$PORT" --bind 127.0.0.1 >> "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

cleanup() {
    kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${PORT}/index.html" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! wait_for_video_ready; then
    echo "$(date '+%F %T') warning: $VIDEO_DEVICE tam hazir olmadan Chromium baslatiliyor" >> "$KIOSK_LOG"
fi

"$CHROMIUM_BIN" \
    --app="$URL" \
    --kiosk \
    --use-fake-ui-for-media-stream \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --disable-features=TranslateUI \
    --disable-session-crashed-bubble \
    --disable-component-update \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    --start-fullscreen \
    --disable-restore-session-state \
    >> "$KIOSK_LOG" 2>&1

echo "$(date '+%F %T') kiosk launcher stopped" >> "$KIOSK_LOG"
