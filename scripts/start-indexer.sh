#!/bin/bash
# Start both indexer services

set -e

echo "🚀 Starting OpenBook Indexer Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start event-listener in background
echo "📡 Starting event-listener..."
event-listener >> /app/logs/event-listener.log 2>&1 &
EVENT_LISTENER_PID=$!
echo "✅ Event-listener started (PID: $EVENT_LISTENER_PID)"

# Start api-server in foreground
echo "🌐 Starting API server..."
exec api-server
