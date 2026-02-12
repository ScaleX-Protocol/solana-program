#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

INDEXER_DIR="../indexer"
LEDGER_DIR="./test-ledger"
PROGRAM_ID="BKC65wuR3mxyKg3P8N6Ukqve8dsW4EAfN9E4Xy48NyDF"
PROGRAM_PATH="../openbook-v2/target/deploy/openbook_v2.so"

# Database configuration (using same DB as clob-indexer/ponder)
export DATABASE_URL="postgresql://postgres:password@localhost:5436/openbook_indexer"

# OpenBook Program ID (our compiled version)
export OPENBOOK_PROGRAM_ID="BKC65wuR3mxyKg3P8N6Ukqve8dsW4EAfN9E4Xy48NyDF"

echo "╔════════════════════════════════════════════════════════╗"
echo "║      OpenBook V2 Indexer - Service Startup Script     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Function to check if a process is running
check_process() {
  local process_name=$1
  if pgrep -f "$process_name" > /dev/null; then
    echo -e "${GREEN}✅ $process_name is running${NC}"
    return 0
  else
    echo -e "${RED}❌ $process_name is NOT running${NC}"
    return 1
  fi
}

# Function to wait for a service to be ready
wait_for_service() {
  local service_name=$1
  local check_command=$2
  local max_attempts=30
  local attempt=0

  echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"

  while [ $attempt -lt $max_attempts ]; do
    if eval "$check_command" &> /dev/null; then
      echo -e "${GREEN}✅ $service_name is ready!${NC}"
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
    echo -n "."
  done

  echo ""
  echo -e "${RED}❌ $service_name failed to start after ${max_attempts}s${NC}"
  return 1
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Checking prerequisites"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if indexer is built
if [ ! -f "$INDEXER_DIR/target/debug/event-listener" ]; then
  echo -e "${YELLOW}⚠️  Indexer not built. Building now...${NC}"
  cd "$INDEXER_DIR" && cargo build
  cd - > /dev/null
fi

# Check PostgreSQL (using Docker container)
echo -n "Checking PostgreSQL... "
if docker ps | grep -q "postgres-database"; then
  # Check if database exists
  if ! docker exec postgres-database psql -U postgres -lqt | cut -d \| -f 1 | grep -qw openbook_indexer; then
    echo -e "${YELLOW}⚠️  Database doesn't exist. Creating...${NC}"
    docker exec postgres-database psql -U postgres -c "CREATE DATABASE openbook_indexer"
    docker exec -i postgres-database psql -U postgres -d openbook_indexer < "$INDEXER_DIR/schema.sql"
  fi
  echo -e "${GREEN}✅ PostgreSQL is ready (Docker: postgres-database)${NC}"
else
  echo -e "${RED}❌ PostgreSQL Docker container 'postgres-database' not running.${NC}"
  echo -e "${YELLOW}   Start it with: docker start postgres-database${NC}"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Starting Solana Test Validator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if check_process "solana-test-validator"; then
  echo -e "${BLUE}ℹ️  Validator already running. Skipping...${NC}"
else
  echo "Starting validator..."

  # Kill any existing validator
  pkill -9 solana-test-validator 2>/dev/null
  sleep 2

  # Check if we should reset the ledger
  RESET_FLAG=""
  if [ -d "$LEDGER_DIR" ]; then
    # Check if program .so is newer than the ledger
    if [ "$PROGRAM_PATH" -nt "$LEDGER_DIR" ]; then
      echo -e "${YELLOW}⚠️  Program has been rebuilt since ledger was created${NC}"
      echo -e "${YELLOW}   Resetting ledger to use latest deployment...${NC}"
      RESET_FLAG="--reset"
    else
      echo -e "${GREEN}✅ Ledger exists and program is current - preserving data${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  No existing ledger found - creating fresh${NC}"
  fi

  # Start validator with conditional reset
  nohup solana-test-validator \
    $RESET_FLAG \
    --ledger "$LEDGER_DIR" \
    --bpf-program "$PROGRAM_ID" "$PROGRAM_PATH" \
    --rpc-port 8899 \
    --log \
    > validator.log 2>&1 &

  wait_for_service "Validator" "solana cluster-version"

  if [ -n "$RESET_FLAG" ]; then
    echo -e "${GREEN}✅ Validator started with FRESH ledger${NC}"
  else
    echo -e "${GREEN}✅ Validator started with EXISTING ledger data preserved${NC}"
  fi
  echo -e "${BLUE}   Log: validator.log${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Starting Indexer Event Listener"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if check_process "event_listener"; then
  echo -e "${BLUE}ℹ️  Event listener already running. Skipping...${NC}"
else
  echo "Starting event listener..."
  cd "$INDEXER_DIR"
  nohup cargo run --bin event-listener > event-listener.log 2>&1 &
  cd - > /dev/null

  sleep 3
  echo -e "${GREEN}✅ Event listener started${NC}"
  echo -e "${BLUE}   Log: $INDEXER_DIR/event-listener.log${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Starting Indexer API Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if check_process "api_server"; then
  echo -e "${BLUE}ℹ️  API server already running. Skipping...${NC}"
else
  echo "Starting API server..."
  cd "$INDEXER_DIR"
  nohup cargo run --bin api-server > api-server.log 2>&1 &
  cd - > /dev/null

  wait_for_service "API Server" "curl -s http://localhost:3000/health"

  echo -e "${GREEN}✅ API server started (http://localhost:3000)${NC}"
  echo -e "${BLUE}   Log: $INDEXER_DIR/api-server.log${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ ALL SERVICES RUNNING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📊 Service Status:"
check_process "solana-test-validator"
check_process "event_listener"
check_process "api_server"

echo ""
echo "🔗 API Endpoints:"
echo "   Health:     http://localhost:3000/health"
echo "   Markets:    http://localhost:3000/markets"
echo "   Order Book: http://localhost:3000/orderbook/{market_id}"
echo "   Events:     http://localhost:3000/events/{market_id}"
echo "   Trades:     http://localhost:3000/trades/{market_id}"

echo ""
echo "📝 Next Steps:"
echo "   1. Run the complete test: npm run test:indexer"
echo "   2. Or create market: npm run simple-market"
echo "   3. Then place orders: npm run simple-trade"
echo ""

echo "🛑 To stop all services:"
echo "   pkill -f solana-test-validator"
echo "   pkill -f event_listener"
echo "   pkill -f api_server"
echo ""
