#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "Stopping server on port 5173..."
PID=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$PID" ]; then
  kill -9 "$PID" 2>/dev/null || true
  echo "Stopped PID $PID"
else
  echo "No server running on port 5173"
fi
echo ""
