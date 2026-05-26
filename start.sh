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

# Check Node.js version
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -ge 24 ]; then
  echo "[ERROR] Node.js version $(node -v) is not supported."
  echo ""
  echo "  better-sqlite3 has no prebuilt binaries for Node.js 24+."
  echo "  This project requires Node.js 18-22 LTS."
  echo ""
  echo "  Fix: Install Node.js 22 LTS"
  echo "  - Download: https://nodejs.org (select 22.x.x LTS)"
  echo "  - Or use nvm: nvm install 22 && nvm use 22"
  echo ""
  exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "First run: installing dependencies..."
  echo ""
  if ! npm install; then
    echo ""
    echo "[ERROR] Failed to install dependencies."
    echo ""
    echo "  This is likely because better-sqlite3 could not compile."
    echo "  Please install Node.js 22 LTS: https://nodejs.org"
    echo ""
    exit 1
  fi
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
