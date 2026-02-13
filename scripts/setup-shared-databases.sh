#!/bin/bash
# Setup script to add OpenBook databases to monitoring-tools shared infrastructure

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  OpenBook Shared Database Setup                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo

# Paths
MONITORING_TOOLS_PATH="/Users/renaka/gtx/monitoring-tools"
MONITORING_TOOLS_ENV="$MONITORING_TOOLS_PATH/.env"

# Check if monitoring-tools exists
if [ ! -d "$MONITORING_TOOLS_PATH" ]; then
    echo -e "${RED}✗ Error: monitoring-tools directory not found at:${NC}"
    echo "  $MONITORING_TOOLS_PATH"
    echo
    echo "Please ensure monitoring-tools is cloned at the correct location."
    exit 1
fi

echo -e "${GREEN}✓ Found monitoring-tools directory${NC}"

# Check if .env exists
if [ ! -f "$MONITORING_TOOLS_ENV" ]; then
    echo -e "${RED}✗ Error: .env file not found at:${NC}"
    echo "  $MONITORING_TOOLS_ENV"
    echo
    echo "Please create .env file in monitoring-tools directory."
    exit 1
fi

echo -e "${GREEN}✓ Found .env file${NC}"
echo

# Backup .env
BACKUP_FILE="$MONITORING_TOOLS_ENV.backup.$(date +%Y%m%d_%H%M%S)"
cp "$MONITORING_TOOLS_ENV" "$BACKUP_FILE"
echo -e "${BLUE}→ Backed up .env to: $BACKUP_FILE${NC}"
echo

# Read current databases
CURRENT_POSTGRES_DBS=$(grep "^POSTGRES_MULTIPLE_DATABASES=" "$MONITORING_TOOLS_ENV" | cut -d= -f2)
CURRENT_TIMESCALE_DBS=$(grep "^TIMESCALE_MULTIPLE_DATABASES=" "$MONITORING_TOOLS_ENV" | cut -d= -f2)

echo -e "${BLUE}Current PostgreSQL databases:${NC}"
echo "  $CURRENT_POSTGRES_DBS"
echo
echo -e "${BLUE}Current TimescaleDB databases:${NC}"
echo "  $CURRENT_TIMESCALE_DBS"
echo

# Check if OpenBook databases already exist
if echo "$CURRENT_POSTGRES_DBS" | grep -q "openbook_devnet"; then
    echo -e "${YELLOW}⚠ OpenBook databases already configured${NC}"
    echo
    read -p "Do you want to reconfigure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Skipping database configuration${NC}"
        exit 0
    fi
fi

# Add OpenBook databases
NEW_POSTGRES_DBS="${CURRENT_POSTGRES_DBS},openbook_devnet,openbook_mainnet"
NEW_TIMESCALE_DBS="${CURRENT_TIMESCALE_DBS},analytics_openbook_devnet,analytics_openbook_mainnet"

echo -e "${GREEN}Adding OpenBook databases...${NC}"
echo

# Update .env file
sed -i '' "s|^POSTGRES_MULTIPLE_DATABASES=.*|POSTGRES_MULTIPLE_DATABASES=$NEW_POSTGRES_DBS|" "$MONITORING_TOOLS_ENV"
sed -i '' "s|^TIMESCALE_MULTIPLE_DATABASES=.*|TIMESCALE_MULTIPLE_DATABASES=$NEW_TIMESCALE_DBS|" "$MONITORING_TOOLS_ENV"

echo -e "${GREEN}✓ Updated .env file${NC}"
echo
echo -e "${BLUE}New PostgreSQL databases:${NC}"
echo "  $NEW_POSTGRES_DBS"
echo
echo -e "${BLUE}New TimescaleDB databases:${NC}"
echo "  $NEW_TIMESCALE_DBS"
echo

# Check if infrastructure network exists
if ! docker network ls | grep -q "infrastructure"; then
    echo -e "${YELLOW}⚠ Infrastructure network not found${NC}"
    echo -e "${BLUE}Creating infrastructure network...${NC}"
    docker network create infrastructure
    echo -e "${GREEN}✓ Created infrastructure network${NC}"
    echo
else
    echo -e "${GREEN}✓ Infrastructure network exists${NC}"
    echo
fi

# Check if databases are running
echo -e "${BLUE}Checking database services...${NC}"
echo

if ! docker ps | grep -q "postgres-database"; then
    echo -e "${YELLOW}⚠ PostgreSQL not running${NC}"
    echo -e "${BLUE}Starting monitoring-tools databases...${NC}"
    echo

    cd "$MONITORING_TOOLS_PATH"
    docker-compose -f docker-compose.databases.yaml up -d

    echo
    echo -e "${BLUE}Waiting for databases to be ready...${NC}"
    sleep 10
else
    echo -e "${YELLOW}⚠ Databases are running. Need to restart to create new databases.${NC}"
    echo
    read -p "Restart database services? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$MONITORING_TOOLS_PATH"
        echo -e "${BLUE}Restarting database services...${NC}"
        docker-compose -f docker-compose.databases.yaml restart postgres-database timescaledb

        echo
        echo -e "${BLUE}Waiting for databases to be ready...${NC}"
        sleep 10
    fi
fi

# Verify databases were created
echo
echo -e "${BLUE}Verifying OpenBook databases...${NC}"
echo

# Check PostgreSQL
if docker exec postgres-database psql -U postgres -lqt | cut -d \| -f 1 | grep -qw "openbook_devnet"; then
    echo -e "${GREEN}✓ openbook_devnet database created${NC}"
else
    echo -e "${RED}✗ openbook_devnet database not found${NC}"
fi

if docker exec postgres-database psql -U postgres -lqt | cut -d \| -f 1 | grep -qw "openbook_mainnet"; then
    echo -e "${GREEN}✓ openbook_mainnet database created${NC}"
else
    echo -e "${RED}✗ openbook_mainnet database not found${NC}"
fi

# Check TimescaleDB
if docker exec timescaledb psql -U postgres -lqt | cut -d \| -f 1 | grep -qw "analytics_openbook_devnet"; then
    echo -e "${GREEN}✓ analytics_openbook_devnet database created${NC}"
else
    echo -e "${RED}✗ analytics_openbook_devnet database not found${NC}"
fi

if docker exec timescaledb psql -U postgres -lqt | cut -d \| -f 1 | grep -qw "analytics_openbook_mainnet"; then
    echo -e "${GREEN}✓ analytics_openbook_mainnet database created${NC}"
else
    echo -e "${RED}✗ analytics_openbook_mainnet database not found${NC}"
fi

# Check Redis
echo
if docker exec redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis is not running${NC}"
fi

echo
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Setup Complete!                                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Review the configuration in $MONITORING_TOOLS_ENV"
echo "  2. Deploy OpenBook indexer:"
echo "     cd /Users/renaka/gtx/openbook"
echo "     docker-compose -f docker-compose.indexer.yml up -d"
echo
echo -e "${BLUE}Connection strings:${NC}"
echo "  PostgreSQL: postgresql://postgres:password@postgres-database:5432/openbook_devnet"
echo "  Redis: redis://redis:6379"
echo "  TimescaleDB: postgresql://postgres:password@timescaledb:5432/analytics_openbook_devnet"
echo
echo -e "${YELLOW}Backup saved to: $BACKUP_FILE${NC}"
echo
