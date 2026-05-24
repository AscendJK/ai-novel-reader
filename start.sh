#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "===== AI Novel Reader ====="
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js is not installed."
  echo ""
  echo "Install Node.js first:"
  echo "  https://nodejs.org"
  echo "  or use nvm: https://github.com/nvm-sh/nvm"
  echo ""
  exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "First run: installing dependencies..."
  echo ""
  npm install
  echo ""
fi

# Choose mode
echo "Select launch mode:"
echo "  [1] Dev mode  (fast reload, may refresh on mobile sleep)"
echo "  [2] Prod mode (stable, no auto-refresh, recommended for mobile)"
echo "  [0] Exit"
echo ""
read -r -p "Enter choice: " mode

case "$mode" in
  0) exit 0 ;;
  2)
    # Kill old process
    PID=$(lsof -ti:5173 2>/dev/null || true)
    if [ -n "$PID" ]; then
      echo "Stopping old instance PID $PID..."
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo "Building for production..."
    npm run build
    echo "Starting production preview..."
    nohup npx vite preview --host 0.0.0.0 --port 5173 > /dev/null 2>&1 &
    sleep 2
    echo "=============================="
    echo "  PROD http://localhost:5173"
    echo "=============================="
    ;;
  *)
    PID=$(lsof -ti:5173 2>/dev/null || true)
    if [ -n "$PID" ]; then
      echo "Stopping old instance PID $PID..."
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo "Starting dev server..."
    nohup npx vite --host 0.0.0.0 --port 5173 > /dev/null 2>&1 &
    sleep 3
    echo "=============================="
    echo "  DEV  http://localhost:5173"
    echo "=============================="
    ;;
esac

echo ""
echo "Stop server: run ./stop.sh or ./port-mgr.sh"
echo ""
