#!/bin/bash
# Quick deployment script for OpenBook Indexer

set -e

SERVER="152.53.225.25"
PASSWORD="o5lmlWbyFNJBkQs"

echo "🚀 Deploying OpenBook Indexer to Production..."
echo "Server: $SERVER"
echo ""

# Deploy using SSH
cat << 'DEPLOY_SCRIPT' | ssh root@$SERVER bash -s
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📦 Step 1: Clone/Update repository${NC}"
if [ -d "/root/openbook" ]; then
    cd /root/openbook
    git pull origin main
    echo -e "${GREEN}✓ Repository updated${NC}"
else
    cd /root
    git clone https://github.com/ScaleX-Protocol/solana-program.git openbook
    cd openbook
    echo -e "${GREEN}✓ Repository cloned${NC}"
fi

echo -e "${BLUE}📊 Step 2: Check databases${NC}"
if docker exec postgres-database psql -U postgres -lqt | cut -d \| -f 1 | grep -qw "openbook_devnet"; then
    echo -e "${GREEN}✓ Database exists${NC}"
else
    echo -e "${BLUE}Creating database...${NC}"
    docker exec postgres-database psql -U postgres -c "CREATE DATABASE openbook_devnet;"
    docker exec timescaledb psql -U postgres -c "CREATE DATABASE analytics_openbook_devnet;"
    echo -e "${GREEN}✓ Databases created${NC}"
fi

echo -e "${BLUE}🌐 Step 3: Check Traefik${NC}"
if docker ps | grep -q traefik; then
    echo -e "${GREEN}✓ Traefik is running${NC}"
else
    echo -e "${RED}✗ Traefik is not running - please start it first${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Step 4: Deploy indexer${NC}"
export NETWORK=devnet
export POSTGRES_PASSWORD=password
export OPENBOOK_DATABASE=openbook_devnet

cd /root/openbook
docker-compose -f docker-compose.simple.yml -p solana-devnet up -d --build

echo -e "${GREEN}✓ Indexer deployed${NC}"

echo ""
echo -e "${BLUE}📋 Step 5: Verify deployment${NC}"
sleep 5
docker ps | grep solana-devnet-indexer
docker logs solana-devnet-indexer --tail 20

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}Public URL: https://solana-devnet-indexer.scalex.money${NC}"

DEPLOY_SCRIPT

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "Next: Add DNS record in Cloudflare:"
echo "  solana-devnet-indexer.scalex.money → 152.53.225.25"
