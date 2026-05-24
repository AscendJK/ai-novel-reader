#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

while true; do
  clear
  echo "============================================"
  echo "  AI Novel Reader - Port Manager"
  echo "============================================"
  echo ""
  echo "  [1] List ports 5170-5179"
  echo "  [2] Start server on port 5173"
  echo "  [3] Kill a port"
  echo "  [4] Kill all 5170-5179"
  echo "  [0] Exit"
  echo ""
  read -r -p "Select: " choice

  case "$choice" in
    1)
      clear
      echo ""
      echo "Listening ports (5170-5179):"
      echo "----------------------------------------"
      for port in $(seq 5170 5179); do
        PID=$(lsof -ti:"$port" 2>/dev/null || true)
        if [ -n "$PID" ]; then
          printf "  Port %s  PID %s\n" "$port" "$PID"
        fi
      done
      echo "----------------------------------------"
      echo ""
      read -r -p "Press Enter to continue..."
      ;;
    2)
      clear
      echo ""
      echo "Checking port 5173..."
      PID=$(lsof -ti:5173 2>/dev/null || true)
      if [ -n "$PID" ]; then
        kill -9 "$PID" 2>/dev/null || true
        echo "Old process killed"
      fi
      echo "Starting server..."
      nohup npx vite --host 0.0.0.0 --port 5173 > /dev/null 2>&1 &
      sleep 2
      echo ""
      echo "=============================="
      echo "  http://localhost:5173"
      echo "=============================="
      echo ""
      read -r -p "Press Enter to continue..."
      ;;
    3)
      echo ""
      read -r -p "Port number to kill: " p
      if [ -z "$p" ]; then continue; fi
      PID=$(lsof -ti:"$p" 2>/dev/null || true)
      if [ -n "$PID" ]; then
        kill -9 "$PID" 2>/dev/null || true
        echo "Port $p killed"
      else
        echo "Port $p not listening"
      fi
      echo ""
      read -r -p "Press Enter to continue..."
      ;;
    4)
      clear
      echo "Killing all ports 5170-5179..."
      for port in $(seq 5170 5179); do
        PID=$(lsof -ti:"$port" 2>/dev/null || true)
        if [ -n "$PID" ]; then
          kill -9 "$PID" 2>/dev/null || true
          echo "Killed port $port (PID $PID)"
        fi
      done
      echo "Done"
      read -r -p "Press Enter to continue..."
      ;;
    0)
      exit 0
      ;;
  esac
done
