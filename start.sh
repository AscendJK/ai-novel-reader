#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "===== AI Novel Reader ====="
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js is not installed."
  echo "Install Node.js first: https://nodejs.org"
  exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "First run: installing dependencies..."
  echo ""
  npm install
  echo ""
fi

echo "Select launch mode:"
echo "  [1] Dev mode  (fast reload, sync server + Vite)"
echo "  [2] Prod mode (stable, single port, recommended for mobile/LAN)"
echo "  [0] Exit"
echo ""
read -r -p "Enter choice: " mode

case "$mode" in
  0) exit 0 ;;
  2)
    PID=$(lsof -ti:5173 2>/dev/null || true)
    if [ -n "$PID" ]; then
      echo "Stopping old instance PID $PID..."
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo "Building for production..."
    npm run build
    echo "Starting production server (port 5173)..."
    nohup node server/index.js --full > /dev/null 2>&1 &
    sleep 2
    echo "=============================="
    echo "  PROD http://localhost:5173"
    echo "=============================="
    ;;
  *)
    # Kill old processes
    for port in 5173 3001; do
      PID=$(lsof -ti:"$port" 2>/dev/null || true)
      if [ -n "$PID" ]; then
        echo "Stopping old instance on port $port (PID $PID)..."
        kill -9 "$PID" 2>/dev/null || true
      fi
    done
    echo "Starting sync server (port 3001)..."
    nohup node server/index.js > server/server.log 2>&1 &
    sleep 1
    echo "Starting Vite dev server (port 5173)..."
    nohup npx vite --host 0.0.0.0 --port 5173 > /dev/null 2>&1 &
    sleep 3
    echo "=============================="
    echo "  DEV  http://localhost:5173"
    echo "=============================="
    ;;
esac

echo ""
echo "Stop server: run ./stop.sh"
echo ""
