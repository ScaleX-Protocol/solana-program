#!/bin/bash

set -e

echo "🚀 OpenBook V2 Local Deployment Script"
echo "======================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Set PATH to include Solana tools
export PATH="$HOME/.local/share/solana/install/solana-release/bin:$PATH"

# Navigate to project directory
cd "$(dirname "$0")/openbook-v2"

echo "📁 Current directory: $(pwd)"
echo ""

# Step 1: Build the program
echo "🔨 Step 1: Building the OpenBook V2 program..."
if just build; then
    echo -e "${GREEN}✅ Build successful!${NC}"
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi
echo ""

# Step 2: Get the program binary path
PROGRAM_SO="target/deploy/openbook_v2.so"
if [ ! -f "$PROGRAM_SO" ]; then
    echo -e "${RED}❌ Program binary not found at $PROGRAM_SO${NC}"
    exit 1
fi

PROGRAM_ID="opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
echo "📦 Program ID: $PROGRAM_ID"
echo "📦 Program binary: $PROGRAM_SO"
echo ""

# Step 3: Check if validator is already running
echo "🔍 Step 2: Checking for existing validator..."
if pgrep -f "solana-test-validator" > /dev/null; then
    echo -e "${YELLOW}⚠️  Validator is already running${NC}"
    read -p "Do you want to restart it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 Stopping existing validator..."
        pkill -f "solana-test-validator" || true
        sleep 2
    else
        echo "Using existing validator..."
        VALIDATOR_RUNNING=true
    fi
fi

# Step 4: Start validator with program loaded
if [ "$VALIDATOR_RUNNING" != "true" ]; then
    echo "🚀 Step 3: Starting local test validator with OpenBook V2 program..."
    echo ""

    # Start validator in background with program loaded
    solana-test-validator \
        --reset \
        --bpf-program $PROGRAM_ID $PROGRAM_SO \
        --quiet \
        > validator.log 2>&1 &

    VALIDATOR_PID=$!
    echo "✅ Validator started (PID: $VALIDATOR_PID)"
    echo "📝 Logs: $(pwd)/validator.log"

    # Wait for validator to be ready
    echo ""
    echo "⏳ Waiting for validator to be ready..."
    sleep 5

    # Check if validator is responding
    if solana config set --url http://localhost:8899 > /dev/null 2>&1; then
        if solana cluster-version > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Validator is ready!${NC}"
        else
            echo -e "${RED}❌ Validator not responding${NC}"
            echo "Check validator.log for details"
            exit 1
        fi
    fi
fi

# Set Solana CLI to use local validator
echo ""
echo "🔧 Configuring Solana CLI for local validator..."
solana config set --url http://localhost:8899 > /dev/null

# Check if keypair exists, if not create one
KEYPAIR_PATH="$HOME/.config/solana/id.json"
if [ ! -f "$KEYPAIR_PATH" ]; then
    echo "🔑 Creating new keypair..."
    solana-keygen new --no-bpf-deprecated-load-instructions --force --silent
fi

echo "🔑 Keypair: $(solana address)"
echo ""

# Step 5: Fund the account
echo "💰 Step 4: Funding account..."
solana airdrop 10 > /dev/null 2>&1 || echo "Airdrop may have failed, but continuing..."
BALANCE=$(solana balance | awk '{print $1}')
echo "✅ Balance: $BALANCE SOL"
echo ""

# Step 6: Run the deployment script
echo "🏪 Step 5: Creating markets (BTC/USDT and WETH/USDT)..."
echo ""

cd ../scripts-v2
if npm run deploy-local 2>&1; then
    echo ""
    echo -e "${GREEN}✨ Deployment complete!${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Deployment script completed with warnings${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Local OpenBook V2 is now running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📡 RPC URL: http://localhost:8899"
echo "🔑 Keypair: $KEYPAIR_PATH"
echo "📦 Program ID: $PROGRAM_ID"
echo ""
echo "🔧 Useful commands:"
echo "   solana logs                 # View transaction logs"
echo "   solana balance              # Check your balance"
echo "   npm run get-markets         # List all markets"
echo ""
echo "🛑 To stop the validator:"
echo "   pkill -f solana-test-validator"
echo ""
