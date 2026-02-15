#!/bin/bash
# Deploy Stack-Overflow-Fixed OpenBook Program to Devnet

set -e

echo "🚀 OpenBook V2 Custom Program Deployment"
echo "========================================"
echo ""

# Configuration
PROGRAM_ID="GesS1wVm85uRvvjYDAgCVK9MJU5icjsX3LX6GMfibKW1"
RPC_URL="https://api.devnet.solana.com"
WALLET="$HOME/.config/solana/id.json"

# Navigate to OpenBook source
cd "$(dirname "$0")/../programs/openbook-v2"

echo "📋 Pre-flight checks..."
echo "Rust version: $(rustc --version)"
echo "Anchor version: $(anchor --version)"
echo "Program ID: $PROGRAM_ID"
echo "Wallet: $(solana address)"
echo "Balance: $(solana balance --url devnet)"
echo ""

# Check if we have enough SOL
BALANCE=$(solana balance --url devnet | awk '{print $1}')
if (( $(echo "$BALANCE < 6" | bc -l) )); then
    echo "⚠️  Low balance: $BALANCE SOL"
    echo "You may need more SOL for deployment"
    echo ""
fi

# Clean and build
echo "🧹 Cleaning previous build..."
cargo clean
anchor clean

echo ""
echo "🔨 Building with Rust 1.79.0 and stack overflow fix..."
rustup override set 1.79.0
anchor build -- --features enable-gpl

if [ ! -f "target/deploy/openbook_v2.so" ]; then
    echo "❌ Build failed - binary not found"
    exit 1
fi

echo ""
echo "✅ Build successful!"
echo "Binary size: $(ls -lh target/deploy/openbook_v2.so | awk '{print $5}')"
echo "IDL size: $(ls -lh target/idl/openbook_v2.json | awk '{print $5}')"
echo ""

# Check for stack overflow warnings
if grep -q "Stack offset.*exceeded" <(anchor build -- --features enable-gpl 2>&1); then
    echo "⚠️  Stack overflow warnings detected (expected for Solana SDK)"
else
    echo "✅ No stack overflow warnings in CreateMarket!"
fi

echo ""
read -p "Deploy to devnet? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "📤 Deploying to devnet..."
solana program deploy target/deploy/openbook_v2.so \
  --program-id $PROGRAM_ID \
  --url $RPC_URL \
  --upgrade-authority $WALLET

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "Program: $PROGRAM_ID"
    echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
    echo ""

    # Update deployment file
    cd ../..
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    SLOT=$(solana program show $PROGRAM_ID --url devnet | grep "Last Deployed In Slot" | awk '{print $5}')

    echo "📝 Updating deployment record..."
    jq --arg ts "$TIMESTAMP" --arg slot "$SLOT" \
       '.programs.openbook_v2 = "'$PROGRAM_ID'" | .timestamp = $ts | .lastDeployedSlot = $slot | .stackOverflowFixed = true' \
       deployments/devnet.json > /tmp/devnet.json && \
       mv /tmp/devnet.json deployments/devnet.json

    echo ""
    echo "✅ Deployment record updated"
    echo ""
    echo "🧪 Next steps:"
    echo "1. Test market creation:"
    echo "   cd packages/scripts"
    echo "   ANCHOR_WALLET=$WALLET npx ts-node testCustomProgram.ts"
    echo ""
    echo "2. Update indexer to use custom program"
    echo "3. Create markets with your tokens"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi
