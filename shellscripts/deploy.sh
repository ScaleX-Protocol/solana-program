#!/bin/bash

# Solana Program Deployment Script
# Deploys OpenBook V2 DEX for local development

# ========================================
# ENVIRONMENT VARIABLES
# ========================================
# Before running this script, you may need to set these environment variables:
#
# OPTIONAL (with defaults):
# - SOLANA_RPC_URL: RPC URL for Solana (default: http://127.0.0.1:8899)
# - SOLANA_NETWORK: Network to use (default: localnet)
# - RESET_VALIDATOR: Reset validator ledger (default: true)
#
# USAGE EXAMPLES:
# # Basic usage (uses defaults):
# bash shellscripts/deploy.sh
#
# # With custom RPC:
# SOLANA_RPC_URL="http://localhost:8899" bash shellscripts/deploy.sh
#
# # Without resetting validator:
# RESET_VALIDATOR="false" bash shellscripts/deploy.sh
#
# # Deploy to devnet:
# SOLANA_NETWORK="devnet" bash shellscripts/deploy.sh
# ========================================

set -e  # Exit on any error

echo "🚀 Starting Solana Program Deployment (OpenBook V2 DEX)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOLANA_NETWORK="${SOLANA_NETWORK:-localnet}"

# Set RPC URL based on network
if [[ "$SOLANA_NETWORK" == "devnet" ]]; then
    SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
elif [[ "$SOLANA_NETWORK" == "mainnet" ]]; then
    SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
else
    SOLANA_RPC_URL="${SOLANA_RPC_URL:-http://127.0.0.1:8899}"
fi

RESET_VALIDATOR="${RESET_VALIDATOR:-true}"
OPENBOOK_PROGRAM_ID="opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
METAPLEX_PROGRAM_ID="metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command_exists solana; then
    print_error "Solana CLI not found. Please install it first."
    echo "Run: sh -c \"\$(curl -sSfL https://release.solana.com/v1.18.23/install)\""
    exit 1
fi

if ! command_exists node; then
    print_error "Node.js not found. Please install it first."
    exit 1
fi

if ! command_exists pnpm; then
    print_error "pnpm not found. Please install it first."
    echo "Run: npm install -g pnpm"
    exit 1
fi

print_success "All prerequisites installed"

# Get project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Check if we're deploying to localnet
if [[ "$SOLANA_NETWORK" == "localnet" ]]; then
    print_step "Setting up local validator..."

    # Check if pre-built programs exist
    if [[ ! -f "/tmp/openbook_v2.so" ]] || [[ ! -f "/tmp/metaplex_token_metadata.so" ]]; then
        print_warning "Pre-built programs not found in /tmp/"
        print_step "Downloading pre-built programs from devnet..."

        solana program dump "$OPENBOOK_PROGRAM_ID" /tmp/openbook_v2.so --url https://api.devnet.solana.com || {
            print_error "Failed to download OpenBook V2 program"
            exit 1
        }

        solana program dump "$METAPLEX_PROGRAM_ID" /tmp/metaplex_token_metadata.so --url https://api.devnet.solana.com || {
            print_error "Failed to download Metaplex Token Metadata program"
            exit 1
        }

        print_success "Programs downloaded successfully"
    else
        print_success "Pre-built programs found in /tmp/"
    fi

    # Check if validator is running
    if pgrep -f "solana-test-validator" > /dev/null; then
        print_warning "Validator already running"

        if [[ "$RESET_VALIDATOR" == "true" ]]; then
            print_step "Stopping existing validator..."
            pkill -9 -f "solana-test-validator" || true
            sleep 2
        else
            print_success "Using existing validator"
            SKIP_VALIDATOR_START=true
        fi
    fi

    # Start validator if needed
    if [[ "$SKIP_VALIDATOR_START" != "true" ]]; then
        print_step "Starting Solana test validator..."

        RESET_FLAG=""
        if [[ "$RESET_VALIDATOR" == "true" ]]; then
            RESET_FLAG="--reset"
            print_warning "Resetting validator ledger (all data will be lost)"
        fi

        solana-test-validator \
            $RESET_FLAG \
            --bpf-program "$OPENBOOK_PROGRAM_ID" /tmp/openbook_v2.so \
            --bpf-program "$METAPLEX_PROGRAM_ID" /tmp/metaplex_token_metadata.so \
            --rpc-port 8899 \
            --quiet &

        # Wait for validator to be ready
        print_step "Waiting for validator to be ready..."
        sleep 5

        MAX_RETRIES=30
        RETRY_COUNT=0
        while ! solana cluster-version --url "$SOLANA_RPC_URL" > /dev/null 2>&1; do
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
                print_error "Validator failed to start after ${MAX_RETRIES} seconds"
                exit 1
            fi
            sleep 1
            echo -n "."
        done
        echo ""

        print_success "Validator is ready"
    fi
else
    print_step "Configuring for $SOLANA_NETWORK network..."
    print_success "Using $SOLANA_RPC_URL"
fi

# Configure Solana CLI to use the appropriate network
solana config set --url "$SOLANA_RPC_URL" > /dev/null
print_success "Solana CLI configured to use $SOLANA_RPC_URL"

# Check wallet balance
print_step "Checking wallet balance..."
WALLET_ADDRESS=$(solana address)
BALANCE=$(solana balance --url "$SOLANA_RPC_URL" | awk '{print $1}')

print_success "Wallet: $WALLET_ADDRESS"
print_success "Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 1" | bc -l) )); then
    if [[ "$SOLANA_NETWORK" == "localnet" ]]; then
        print_warning "Low balance detected. Airdropping 10 SOL..."
        solana airdrop 10 --url "$SOLANA_RPC_URL"
        print_success "Airdrop successful"
    elif [[ "$SOLANA_NETWORK" == "devnet" ]]; then
        print_warning "Low balance detected. Attempting devnet airdrop..."
        solana airdrop 2 --url "$SOLANA_RPC_URL" || {
            print_error "Airdrop failed. Get devnet SOL from https://faucet.solana.com"
            exit 1
        }
        print_success "Airdrop successful"
    else
        print_error "Insufficient balance for deployment (need at least 1 SOL)"
        exit 1
    fi
fi

# Install dependencies
print_step "Installing dependencies..."
cd "$PROJECT_ROOT/packages/scripts"
pnpm install > /dev/null 2>&1
print_success "Dependencies installed"

# Deploy markets
print_step "Deploying tokens and markets..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm deploy-local-fixed
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify deployment
print_step "Verifying deployment..."
print_success "Checking deployed markets..."
echo ""
pnpm view-markets
echo ""

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_success "Network: $SOLANA_NETWORK"
print_success "RPC URL: $SOLANA_RPC_URL"
print_success "OpenBook Program: $OPENBOOK_PROGRAM_ID"
print_success "Metaplex Program: $METAPLEX_PROGRAM_ID"
echo ""
echo "📝 Next Steps:"
echo "   1. Run populate data: bash shellscripts/populate-data.sh"
echo "   2. View markets: pnpm view-markets"
echo "   3. Place test order: pnpm post-order"
echo ""
print_success "Deployment logs saved in packages/scripts/"
echo ""
