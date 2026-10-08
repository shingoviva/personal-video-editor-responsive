#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/opt/ffmpeg-full/bin:/usr/local/opt/ffmpeg-full/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v python3 >/dev/null || ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  echo 'Python 3 と FFmpeg が必要です。README.md の初回セットアップをご確認ください。'
  echo 'Homebrew を導入済みの場合: brew install python ffmpeg-full'
  read -r -p 'Enter で終了します。'
  exit 1
fi
export PVE_PORT=8785
python3 engine/server.py
