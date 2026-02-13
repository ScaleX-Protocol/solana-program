#!/bin/bash
# Get deployment information from deployment JSON files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NETWORK="devnet"
DEPLOYMENTS_DIR="./deployments"

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --network NETWORK    Network to query (devnet, mainnet, localnet)"
    echo "  -l, --latest             Show only latest deployment"
    echo "  -a, --all                Show all deployments"
    echo "  -p, --program-id         Show only program ID"
    echo "  -m, --markets            Show market addresses"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -n devnet -l          # Show latest devnet deployment"
    echo "  $0 -n mainnet -p         # Show mainnet program ID"
    echo "  $0 -n devnet -m          # Show devnet markets"
    exit 1
}

# Parse arguments
SHOW_LATEST=false
SHOW_ALL=false
SHOW_PROGRAM_ONLY=false
SHOW_MARKETS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--network)
            NETWORK="$2"
            shift 2
            ;;
        -l|--latest)
            SHOW_LATEST=true
            shift
            ;;
        -a|--all)
            SHOW_ALL=true
            shift
            ;;
        -p|--program-id)
            SHOW_PROGRAM_ONLY=true
            shift
            ;;
        -m|--markets)
            SHOW_MARKETS=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Validate network
if [[ ! "$NETWORK" =~ ^(devnet|mainnet|localnet)$ ]]; then
    echo -e "${RED}Error: Invalid network '$NETWORK'. Must be devnet, mainnet, or localnet${NC}"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Get the deployment file path
DEPLOYMENT_FILE="$DEPLOYMENTS_DIR/${NETWORK}.json"

# Check if deployment file exists
if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${YELLOW}No deployments found for ${NETWORK}${NC}"
    echo "File not found: $DEPLOYMENT_FILE"
    echo ""
    echo "Available example files:"
    ls -1 "$DEPLOYMENTS_DIR"/*.example.json 2>/dev/null || echo "  None"
    exit 1
fi

# Show program ID only
if [ "$SHOW_PROGRAM_ONLY" = true ]; then
    PROGRAM_ID=$(jq -r '.deployments[0].programs.openbook_v2' "$DEPLOYMENT_FILE")
    echo "$PROGRAM_ID"
    exit 0
fi

# Show markets only
if [ "$SHOW_MARKETS" = true ]; then
    echo -e "${BLUE}Markets on ${NETWORK}:${NC}"
    jq -r '.deployments[0].markets[]? | "\(.name): \(.address)"' "$DEPLOYMENT_FILE" || echo "No markets found"
    exit 0
fi

# Show latest deployment
if [ "$SHOW_LATEST" = true ] || [ "$SHOW_ALL" = false ]; then
    echo -e "${GREEN}=== Latest Deployment on ${NETWORK} ===${NC}"
    echo ""

    # Network info
    LAST_UPDATED=$(jq -r '.lastUpdated' "$DEPLOYMENT_FILE")
    echo -e "${BLUE}Last Updated:${NC} $LAST_UPDATED"
    echo ""

    # Deployment info
    TIMESTAMP=$(jq -r '.deployments[0].timestamp' "$DEPLOYMENT_FILE")
    COMMIT=$(jq -r '.deployments[0].commit' "$DEPLOYMENT_FILE")
    DEPLOYER=$(jq -r '.deployments[0].deployer' "$DEPLOYMENT_FILE")
    PROGRAM_ID=$(jq -r '.deployments[0].programs.openbook_v2' "$DEPLOYMENT_FILE")
    RPC=$(jq -r '.deployments[0].rpc_endpoint' "$DEPLOYMENT_FILE")
    STATUS=$(jq -r '.deployments[0].status' "$DEPLOYMENT_FILE")

    echo -e "${BLUE}Deployment Time:${NC} $TIMESTAMP"
    echo -e "${BLUE}Commit:${NC} $COMMIT"
    echo -e "${BLUE}Deployer:${NC} $DEPLOYER"
    echo -e "${BLUE}Status:${NC} $STATUS"
    echo ""

    # Program info
    echo -e "${BLUE}OpenBook V2 Program:${NC}"
    echo "  $PROGRAM_ID"
    echo ""

    # RPC endpoint
    echo -e "${BLUE}RPC Endpoint:${NC}"
    echo "  $RPC"
    echo ""

    # Markets
    MARKET_COUNT=$(jq '.deployments[0].markets? | length' "$DEPLOYMENT_FILE")
    if [ "$MARKET_COUNT" != "null" ] && [ "$MARKET_COUNT" -gt 0 ]; then
        echo -e "${BLUE}Markets ($MARKET_COUNT):${NC}"
        jq -r '.deployments[0].markets[]? | "  \(.name): \(.address)"' "$DEPLOYMENT_FILE"
        echo ""
    fi

    # Configuration
    echo -e "${BLUE}Configuration:${NC}"
    jq -r '.deployments[0].configuration | to_entries[] | "  \(.key): \(.value)"' "$DEPLOYMENT_FILE"
    echo ""

    # Verification command
    echo -e "${BLUE}Verify Deployment:${NC}"
    echo "  solana program show $PROGRAM_ID --url $RPC"
    echo ""
fi

# Show all deployments
if [ "$SHOW_ALL" = true ]; then
    echo -e "${GREEN}=== All Deployments on ${NETWORK} ===${NC}"
    echo ""

    DEPLOYMENT_COUNT=$(jq '.deployments | length' "$DEPLOYMENT_FILE")
    echo -e "${BLUE}Total Deployments:${NC} $DEPLOYMENT_COUNT"
    echo ""

    jq -r '.deployments[] |
        "---",
        "Timestamp: \(.timestamp)",
        "Commit: \(.commit)",
        "Program: \(.programs.openbook_v2)",
        "Status: \(.status)",
        ""' "$DEPLOYMENT_FILE"
fi
