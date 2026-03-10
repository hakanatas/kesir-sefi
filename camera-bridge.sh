#!/bin/bash
# Kesir Sefi - Raspberry Pi camera bridge service

set -euo pipefail

VIDEO_DEVICE="${VIDEO_DEVICE:-/dev/video10}"
VIDEO_NR="${VIDEO_NR:-10}"
WIDTH="${WIDTH:-640}"
HEIGHT="${HEIGHT:-480}"
FPS="${FPS:-30}"
LOG_PREFIX="[KesirSefiCamera]"

pkill -f "gst-launch-1.0 libcamerasrc" 2>/dev/null || true
modprobe v4l2loopback devices=1 video_nr="${VIDEO_NR}" card_label="KesirSefiKamera" exclusive_caps=1
sleep 1

if command -v v4l2loopback-ctl >/dev/null 2>&1; then
  v4l2loopback-ctl set-caps "${VIDEO_DEVICE}" "YUYV:${WIDTH}x${HEIGHT}" || true
  v4l2loopback-ctl set-fps "${VIDEO_DEVICE}" "${FPS}" || true
fi

run_pipeline() {
  local description="$1"
  shift

  echo "$LOG_PREFIX trying pipeline: $description"
  gst-launch-1.0 -e "$@"
}

run_with_fallbacks() {
  run_pipeline "YUY2 direct" \
    libcamerasrc ! \
    "video/x-raw,format=YUY2,width=${WIDTH},height=${HEIGHT},framerate=${FPS}/1" ! \
    queue ! \
    v4l2sink device="${VIDEO_DEVICE}" sync=false \
  && return 0

  run_pipeline "NV12 -> YUY2" \
    libcamerasrc ! \
    "video/x-raw,format=NV12,width=${WIDTH},height=${HEIGHT},framerate=${FPS}/1" ! \
    queue ! \
    videoconvert ! \
    "video/x-raw,format=YUY2,width=${WIDTH},height=${HEIGHT}" ! \
    v4l2sink device="${VIDEO_DEVICE}" sync=false \
  && return 0

  run_pipeline "BGRx -> YUY2" \
    libcamerasrc ! \
    "video/x-raw,format=BGRx,width=${WIDTH},height=${HEIGHT},framerate=${FPS}/1" ! \
    queue ! \
    videoconvert ! \
    "video/x-raw,format=YUY2,width=${WIDTH},height=${HEIGHT}" ! \
    v4l2sink device="${VIDEO_DEVICE}" sync=false
}

run_with_fallbacks
