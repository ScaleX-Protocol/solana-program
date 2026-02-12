#!/bin/bash

# Fill Order Book Script
# Uses multiple wallets to fill order book and execute market orders

# ========================================
# ENVIRONMENT VARIABLES
# ========================================
# Before running this script, you may need to set these environment variables:
#
# OPTIONAL (with defaults):
# - SOLANA_RPC_URL: RPC URL for Solana (default: http://127.0.0.1:8899)
# - NUM_TRADERS: Number of trader wallets to use (default: 3)
# - ORDERS_PER_TRADER: Number of orders per trader (default: 3)
#
# PREREQUISITES:
# - Run deploy.sh first to deploy markets
# - Ensure validator/network is running
# - Have sufficient SOL for airdrops (localnet) or funded wallets (devnet)
#
# USAGE EXAMPLES:
# # Basic usage (uses defaults):
# bash shellscripts/fill-orderbook.sh
#
# # With custom RPC (devnet):
# SOLANA_RPC_URL="https://api.devnet.solana.com" bash shellscripts/fill-orderbook.sh
#
# # Use 5 traders with 5 orders each:
# NUM_TRADERS=5 ORDERS_PER_TRADER=5 bash shellscripts/fill-orderbook.sh
#
# # Heavy load test:
# NUM_TRADERS=10 ORDERS_PER_TRADER=10 bash shellscripts/fill-orderbook.sh
# ========================================

set -e  # Exit on any error

echo "🚀 Starting Order Book Fill Script..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOLANA_RPC_URL="${SOLANA_RPC_URL:-http://127.0.0.1:8899}"
NUM_TRADERS="${NUM_TRADERS:-3}"
ORDERS_PER_TRADER="${ORDERS_PER_TRADER:-3}"

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Check if validator/network is running
print_step "Checking network connectivity..."
if ! solana cluster-version --url "$SOLANA_RPC_URL" > /dev/null 2>&1; then
    print_error "Cannot connect to $SOLANA_RPC_URL"
    echo "For localnet: bash shellscripts/deploy.sh"
    echo "For devnet: SOLANA_NETWORK=\"devnet\" bash shellscripts/deploy.sh"
    exit 1
fi
print_success "Network is reachable"

# Check wallet balance
print_step "Checking wallet balance..."
WALLET_ADDRESS=$(solana address)
BALANCE=$(solana balance --url "$SOLANA_RPC_URL" | awk '{print $1}')

print_success "Wallet: $WALLET_ADDRESS"
print_success "Balance: $BALANCE SOL"

# Warn if balance is low
if (( $(echo "$BALANCE < 5" | bc -l) )); then
    print_warning "Low balance ($BALANCE SOL). You may need more SOL for funding trader wallets."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Navigate to scripts directory
cd "$PROJECT_ROOT/packages/scripts"

# Verify markets exist
print_step "Verifying markets exist..."
pnpm view-markets > /dev/null 2>&1 || {
    print_error "No markets found. Please run deploy.sh first."
    exit 1
}
print_success "Markets verified"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 FILLING ORDER BOOK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_success "Configuration:"
echo "   - RPC URL: $SOLANA_RPC_URL"
echo "   - Number of traders: $NUM_TRADERS"
echo "   - Orders per trader: $ORDERS_PER_TRADER"
echo "   - Total limit orders: ~$((NUM_TRADERS * ORDERS_PER_TRADER * 2))"
echo "   - Market orders: ~$((NUM_TRADERS < 3 ? NUM_TRADERS * 2 : 6))"
echo ""

# Run the multi-wallet trading script
print_step "Executing multi-wallet trading strategy..."
echo ""

export SOLANA_RPC_URL
export NUM_TRADERS
export ORDERS_PER_TRADER

pnpm multi-wallet-trade

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ ORDER BOOK FILL COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show current order book
print_step "Fetching current order book..."
echo ""
pnpm order-book
echo ""

# Summary
print_success "Summary:"
echo "   - Traders created/used: $NUM_TRADERS"
echo "   - Trader keypairs saved in: ~/.config/solana/trader-*.json"
echo "   - Order book is now populated with limit orders"
echo "   - Market orders executed for price discovery"
echo ""
echo "📝 Next Steps:"
echo "   1. View order book: pnpm order-book"
echo "   2. View markets: pnpm view-markets"
echo "   3. Place more orders: pnpm post-order"
echo "   4. Run trading demo: pnpm trading-demo"
echo ""
echo "🔧 Advanced:"
echo "   - View trader balances: solana balance <trader-address> --url $SOLANA_RPC_URL"
echo "   - Re-run with more traders: NUM_TRADERS=10 bash shellscripts/fill-orderbook.sh"
echo "   - Clean trader keypairs: rm ~/.config/solana/trader-*.json"
echo ""
