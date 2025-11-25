#!/bin/bash

# Kill any process using port 8888
echo "Checking for existing processes on port 8888..."
PID=$(lsof -ti:8888)

if [ -n "$PID" ]; then
    echo "Killing process $PID on port 8888..."
    kill -9 $PID
    sleep 1
fi

# Start the server
echo "Starting HTTP server on port 8888..."
cd "$(dirname "$0")"
python3 -m http.server 8888

