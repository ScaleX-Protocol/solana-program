#!/bin/bash

# Solana Program Data Population Script
# Populates OpenBook V2 markets with test trading activity

# ========================================
# ENVIRONMENT VARIABLES
# ========================================
# Before running this script, you may need to set these environment variables:
#
# OPTIONAL (with defaults):
# - SOLANA_RPC_URL: RPC URL for Solana (default: http://127.0.0.1:8899)
# - NUM_ORDERS: Number of orders to place (default: 10)
# - ORDER_SIDE: Side of orders to place: "buy", "sell", or "both" (default: both)
#
# PREREQUISITES:
# - Run deploy.sh first to deploy markets
# - Ensure validator is running
# - Have sufficient SOL and token balances
#
# USAGE EXAMPLES:
# # Basic usage (uses defaults):
# bash shellscripts/populate-data.sh
#
# # With custom RPC:
# SOLANA_RPC_URL="http://localhost:8899" bash shellscripts/populate-data.sh
#
# # Place 20 orders:
# NUM_ORDERS=20 bash shellscripts/populate-data.sh
#
# # Place only buy orders:
# ORDER_SIDE="buy" bash shellscripts/populate-data.sh
# ========================================

set -e  # Exit on any error

echo "🚀 Starting Data Population for OpenBook V2 Markets..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOLANA_RPC_URL="${SOLANA_RPC_URL:-http://127.0.0.1:8899}"
NUM_ORDERS="${NUM_ORDERS:-10}"
ORDER_SIDE="${ORDER_SIDE:-both}"

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

# Check if validator is running
print_step "Checking validator status..."
if ! solana cluster-version --url "$SOLANA_RPC_URL" > /dev/null 2>&1; then
    print_error "Validator not running at $SOLANA_RPC_URL"
    echo "Run: bash shellscripts/deploy.sh"
    exit 1
fi
print_success "Validator is running"

# Check wallet balance
print_step "Checking wallet balance..."
WALLET_ADDRESS=$(solana address)
BALANCE=$(solana balance --url "$SOLANA_RPC_URL" | awk '{print $1}')

print_success "Wallet: $WALLET_ADDRESS"
print_success "Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 1" | bc -l) )); then
    print_warning "Low balance detected. Airdropping 10 SOL..."
    solana airdrop 10 --url "$SOLANA_RPC_URL"
    print_success "Airdrop successful"
fi

# Navigate to scripts directory
cd "$PROJECT_ROOT/packages/scripts"

# Verify markets exist
print_step "Verifying markets..."
echo ""
pnpm view-markets || {
    print_error "No markets found. Please run deploy.sh first."
    exit 1
}
echo ""

# Start populating data
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 POPULATING MARKET DATA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_success "Configuration:"
echo "   - Number of orders: $NUM_ORDERS"
echo "   - Order side: $ORDER_SIDE"
echo ""

# Place orders
for i in $(seq 1 $NUM_ORDERS); do
    print_step "Placing order $i of $NUM_ORDERS..."

    # Determine order side
    if [[ "$ORDER_SIDE" == "both" ]]; then
        # Alternate between buy and sell
        if (( i % 2 == 0 )); then
            CURRENT_SIDE="buy"
        else
            CURRENT_SIDE="sell"
        fi
    else
        CURRENT_SIDE="$ORDER_SIDE"
    fi

    print_success "Order side: $CURRENT_SIDE"

    # Place order
    pnpm post-order || {
        print_warning "Failed to place order $i"
        continue
    }

    # Small delay between orders
    sleep 1
done

echo ""
print_success "Placed $NUM_ORDERS orders"

# Show order book
print_step "Fetching current order book..."
echo ""
pnpm order-book
echo ""

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ DATA POPULATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_success "Orders placed: $NUM_ORDERS"
print_success "Network: $SOLANA_RPC_URL"
echo ""
echo "📝 Next Steps:"
echo "   1. View order book: pnpm order-book"
echo "   2. View markets: pnpm view-markets"
echo "   3. Place more orders: pnpm post-order"
echo "   4. Run trading demo: pnpm trading-demo"
echo ""
echo "🔧 Advanced Options:"
echo "   - Place crossing orders: pnpm place-orders"
echo "   - Simple trade: pnpm simple-trade"
echo "   - Deposit/Withdraw: pnpm deposit-withdraw"
echo ""
