#!/bin/sh
set -e

echo "Starting Bible Study Guide Generator..."

# Start nginx in background
nginx

# Start Node.js backend (foreground)
cd /app/backend
exec node server.js
