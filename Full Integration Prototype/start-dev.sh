#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"

if [[ ! -f "$SERVER_DIR/package.json" ]]; then
  echo "[start-dev] Missing server/package.json"
  exit 1
fi

if [[ ! -f "$CLIENT_DIR/package.json" ]]; then
  echo "[start-dev] Missing client/package.json"
  exit 1
fi

if [[ ! -d "$SERVER_DIR/node_modules" ]]; then
  echo "[start-dev] Installing server dependencies..."
  (cd "$SERVER_DIR" && npm install)
fi

if [[ ! -d "$CLIENT_DIR/node_modules" ]]; then
  echo "[start-dev] Installing client dependencies..."
  (cd "$CLIENT_DIR" && npm install)
fi

echo "[start-dev] Starting backend..."
(
  cd "$SERVER_DIR"
  npm start
) &
SERVER_PID=$!

echo "[start-dev] Starting frontend..."
(
  cd "$CLIENT_DIR"
  npm run dev
) &
CLIENT_PID=$!

cleanup() {
  echo
  echo "[start-dev] Shutting down processes..."
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
  wait "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait "$SERVER_PID" "$CLIENT_PID"
