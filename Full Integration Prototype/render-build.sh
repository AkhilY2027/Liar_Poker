#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"

echo "[render-build] Installing server dependencies..."
cd "$SERVER_DIR"
npm ci

echo "[render-build] Installing client dependencies..."
cd "$CLIENT_DIR"
npm ci --include=dev

echo "[render-build] Building client..."
npm run build

echo "[render-build] Build complete."
