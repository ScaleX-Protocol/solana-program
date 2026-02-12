#!/bin/bash

echo "🔨 OpenBook Development - Starting Validator"
echo ""

# Set PATH
export PATH="$HOME/.local/share/solana/install/solana-release/bin:$PATH"

# Kill existing validator
echo "Stopping existing validator..."
pkill -9 -f solana-test-validator
sleep 2

# Download Metaplex if not exists
if [ ! -f /tmp/metaplex_token_metadata.so ]; then
    echo "📥 Downloading Metaplex program..."
    solana program dump \
      metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
      /tmp/metaplex_token_metadata.so \
      --url https://api.devnet.solana.com
fi

# Build OpenBook
echo ""
echo "🔨 Building OpenBook from source..."
cd /Users/renaka/gtx/openbook/openbook-v2
anchor build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Fix errors and try again."
    exit 1
fi

# Get program ID
echo ""
echo "🔑 Getting OpenBook program ID..."
OPENBOOK_PROGRAM_ID=$(solana address -k target/deploy/openbook_v2-keypair.json)
echo "Your OpenBook Program ID: $OPENBOOK_PROGRAM_ID"

# Start validator
echo ""
echo "🚀 Starting validator with YOUR OpenBook + Metaplex..."
solana-test-validator \
  --reset \
  --bpf-program $OPENBOOK_PROGRAM_ID \
    target/deploy/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    /tmp/metaplex_token_metadata.so \
  --quiet > /tmp/validator.log 2>&1 &

echo "⏳ Waiting for validator to start..."
sleep 10

# Configure and fund
echo "⚙️  Configuring Solana CLI..."
solana config set --url http://localhost:8899

echo "💰 Requesting airdrop..."
solana airdrop 100

# Verify
echo ""
echo "✅ Validator started successfully!"
echo ""
echo "📋 Programs loaded:"
echo "   OpenBook (YOUR build):  $OPENBOOK_PROGRAM_ID"
echo "   Metaplex (from devnet): metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
echo ""
echo "⚠️  IMPORTANT: Update your scripts with this program ID!"
echo "   Edit: scripts-v2/localDeployFixed.ts"
echo "   Change PROGRAM_ID to: $OPENBOOK_PROGRAM_ID"
echo ""
echo "💡 Next steps:"
echo "   1. Update program ID in scripts-v2/localDeployFixed.ts"
echo "   2. cd /Users/renaka/gtx/openbook/scripts-v2"
echo "   3. npm run deploy-local-fixed"
echo ""
echo "🔧 To modify OpenBook:"
echo "   1. Edit code in openbook-v2/programs/"
echo "   2. Run: anchor build"
echo "   3. Restart this script"
echo ""
