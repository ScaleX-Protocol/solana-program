#!/bin/bash

# Retry Until Success - For Devnet Order Placement
# This script will keep retrying until orders are successfully placed

set +e  # Don't exit on error

echo "🔄 Automated Retry Script for Devnet"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will keep trying until devnet stabilizes and orders are placed."
echo "You can stop anytime with Ctrl+C"
echo ""

cd "$(dirname "$0")/../packages/scripts"

SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
MARKET_ADDRESS="${MARKET_ADDRESS:-HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6}"
ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"

ATTEMPT=1
MAX_WAIT=300  # Maximum 5 minutes between retries

while true; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 Attempt #$ATTEMPT - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  if SOLANA_RPC_URL="$SOLANA_RPC_URL" \
     MARKET_ADDRESS="$MARKET_ADDRESS" \
     ANCHOR_WALLET="$ANCHOR_WALLET" \
     pnpm post-order-devnet 2>&1; then

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ SUCCESS! Orders placed on devnet!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Total attempts: $ATTEMPT"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    exit 0
  fi

  # Calculate wait time (increases gradually, caps at MAX_WAIT)
  WAIT_TIME=$((ATTEMPT * 10))
  if [ $WAIT_TIME -gt $MAX_WAIT ]; then
    WAIT_TIME=$MAX_WAIT
  fi

  echo ""
  echo "⚠️  Attempt $ATTEMPT failed"
  echo "⏳ Waiting ${WAIT_TIME}s before retry..."
  echo ""

  sleep $WAIT_TIME
  ATTEMPT=$((ATTEMPT + 1))
done
