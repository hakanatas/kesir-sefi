#!/bin/bash
# Kesir Sefi - Raspberry Pi camera bridge service

set -euo pipefail

VIDEO_DEVICE="${VIDEO_DEVICE:-/dev/video10}"
VIDEO_NR="${VIDEO_NR:-10}"
WIDTH="${WIDTH:-640}"
HEIGHT="${HEIGHT:-480}"
FPS="${FPS:-30}"

pkill -f "gst-launch-1.0 libcamerasrc" 2>/dev/null || true
modprobe v4l2loopback devices=1 video_nr="${VIDEO_NR}" card_label="KesirSefiKamera" exclusive_caps=1
sleep 1

exec gst-launch-1.0 \
  libcamerasrc ! \
  "video/x-raw,width=${WIDTH},height=${HEIGHT},framerate=${FPS}/1" ! \
  videoconvert ! \
  v4l2sink device="${VIDEO_DEVICE}"
