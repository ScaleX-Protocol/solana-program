#!/bin/bash

# Deployment Validation Script
# Tests all API endpoints to ensure the indexer is working correctly

set -e

API_BASE="${API_BASE:-http://localhost:42070}"
TEST_USER="HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt"

PASSED=0
FAILED=0
ERRORS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 OpenBook Indexer API Deployment Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "API Base URL: ${API_BASE}"
echo "Test User: ${TEST_USER}"
echo ""

# Function to test an endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local required_fields="$3"

    echo -n "Testing ${name}... "

    # Make request
    response=$(curl -s -w "\n%{http_code}" "${url}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check HTTP status
    if [ "$http_code" != "200" ]; then
        echo -e "${RED}✗ FAILED${NC} (HTTP ${http_code})"
        FAILED=$((FAILED + 1))
        ERRORS+=("${name}: HTTP ${http_code}")
        return 1
    fi

    # Check if response is valid JSON
    if ! echo "$body" | jq empty 2>/dev/null; then
        echo -e "${RED}✗ FAILED${NC} (Invalid JSON)"
        FAILED=$((FAILED + 1))
        ERRORS+=("${name}: Invalid JSON response")
        return 1
    fi

    # Check required fields if specified
    if [ -n "$required_fields" ]; then
        for field in $required_fields; do
            if ! echo "$body" | jq -e "$field" > /dev/null 2>&1; then
                echo -e "${RED}✗ FAILED${NC} (Missing field: ${field})"
                FAILED=$((FAILED + 1))
                ERRORS+=("${name}: Missing required field ${field}")
                return 1
            fi
        done
    fi

    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED=$((PASSED + 1))
    return 0
}

# Function to test array endpoint
test_array_endpoint() {
    local name="$1"
    local url="$2"

    echo -n "Testing ${name}... "

    response=$(curl -s -w "\n%{http_code}" "${url}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" != "200" ]; then
        echo -e "${RED}✗ FAILED${NC} (HTTP ${http_code})"
        FAILED=$((FAILED + 1))
        ERRORS+=("${name}: HTTP ${http_code}")
        return 1
    fi

    if ! echo "$body" | jq empty 2>/dev/null; then
        echo -e "${RED}✗ FAILED${NC} (Invalid JSON)"
        FAILED=$((FAILED + 1))
        ERRORS+=("${name}: Invalid JSON response")
        return 1
    fi

    if ! echo "$body" | jq -e 'if type == "array" then true else false end' > /dev/null 2>&1; then
        echo -e "${RED}✗ FAILED${NC} (Not an array)"
        FAILED=$((FAILED + 1))
        ERRORS+=("${name}: Response is not an array")
        return 1
    fi

    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED=$((PASSED + 1))
    return 0
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 Market Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_array_endpoint "GET /api/markets" "${API_BASE}/api/markets"
test_array_endpoint "GET /api/markets?limit=10" "${API_BASE}/api/markets?limit=10"
test_array_endpoint "GET /api/pairs" "${API_BASE}/api/pairs"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📈 Price & Order Book Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get first market symbol for testing
SYMBOL=$(curl -s "${API_BASE}/api/markets?limit=1" | jq -r '.[0].symbol // "BTC/USDT"')
echo "Using symbol: ${SYMBOL}"
echo ""

test_endpoint "GET /api/depth?symbol=${SYMBOL}" \
    "${API_BASE}/api/depth?symbol=${SYMBOL}" \
    ".bids .asks"

test_endpoint "GET /api/ticker/price?symbol=${SYMBOL}" \
    "${API_BASE}/api/ticker/price?symbol=${SYMBOL}" \
    ".symbol .price"

test_endpoint "GET /api/ticker/24hr?symbol=${SYMBOL}" \
    "${API_BASE}/api/ticker/24hr?symbol=${SYMBOL}" \
    ".symbol .lastPrice .volume"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📋 Order Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_array_endpoint "GET /api/allOrders?user=${TEST_USER}" \
    "${API_BASE}/api/allOrders?user=${TEST_USER}"

test_array_endpoint "GET /api/allOrders?address=${TEST_USER}" \
    "${API_BASE}/api/allOrders?address=${TEST_USER}"

test_array_endpoint "GET /api/openOrders?user=${TEST_USER}" \
    "${API_BASE}/api/openOrders?user=${TEST_USER}"

test_array_endpoint "GET /api/openOrders?address=${TEST_USER}" \
    "${API_BASE}/api/openOrders?address=${TEST_USER}"

test_array_endpoint "GET /api/allOrders?user=${TEST_USER}&symbol=${SYMBOL}" \
    "${API_BASE}/api/allOrders?user=${TEST_USER}&symbol=${SYMBOL}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  💰 Trade Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_array_endpoint "GET /api/trades?symbol=${SYMBOL}" \
    "${API_BASE}/api/trades?symbol=${SYMBOL}"

test_array_endpoint "GET /api/trades?symbol=${SYMBOL}&limit=10" \
    "${API_BASE}/api/trades?symbol=${SYMBOL}&limit=10"

test_array_endpoint "GET /api/trades?symbol=${SYMBOL}&orderBy=asc" \
    "${API_BASE}/api/trades?symbol=${SYMBOL}&orderBy=asc"

test_array_endpoint "GET /api/trades?symbol=${SYMBOL}&orderBy=desc" \
    "${API_BASE}/api/trades?symbol=${SYMBOL}&orderBy=desc"

test_array_endpoint "GET /api/trades?user=${TEST_USER}" \
    "${API_BASE}/api/trades?user=${TEST_USER}"

test_array_endpoint "GET /api/trades?address=${TEST_USER}" \
    "${API_BASE}/api/trades?address=${TEST_USER}"

test_array_endpoint "GET /api/trades?user=${TEST_USER}&symbol=${SYMBOL}" \
    "${API_BASE}/api/trades?user=${TEST_USER}&symbol=${SYMBOL}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  👤 Account Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "GET /api/account?address=${TEST_USER}" \
    "${API_BASE}/api/account?address=${TEST_USER}" \
    ".canTrade .canWithdraw .canDeposit"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  💼 Asset Tracking (Lending Dashboard)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "GET /api/lending/dashboard/${TEST_USER}" \
    "${API_BASE}/api/lending/dashboard/${TEST_USER}" \
    ".supplies .borrows .availableToSupply .availableToBorrow .activityHistory .interestRateParams .assetConfigurations .summary"

test_endpoint "GET /api/lending/dashboard/${TEST_USER}?chainId=101" \
    "${API_BASE}/api/lending/dashboard/${TEST_USER}?chainId=101" \
    ".summary.totalSupplied .summary.totalBorrowed .summary.healthFactor"

# Test detailed lending dashboard fields
echo -n "Validating lending dashboard format... "
DASHBOARD_RESPONSE=$(curl -s "${API_BASE}/api/lending/dashboard/${TEST_USER}")

REQUIRED_SUMMARY_FIELDS=".summary.totalSupplied .summary.totalBorrowed .summary.netAPY .summary.totalEarnings .summary.healthFactor .summary.borrowingPower"
ALL_PRESENT=true

for field in $REQUIRED_SUMMARY_FIELDS; do
    if ! echo "$DASHBOARD_RESPONSE" | jq -e "$field" > /dev/null 2>&1; then
        echo -e "${RED}✗ FAILED${NC} (Missing ${field})"
        FAILED=$((FAILED + 1))
        ERRORS+=("Lending Dashboard: Missing ${field}")
        ALL_PRESENT=false
        break
    fi
done

if [ "$ALL_PRESENT" = true ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED=$((PASSED + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔄 System Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "GET /api/sync-status" \
    "${API_BASE}/api/sync-status" \
    ".is_synced .chain_id"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=$((PASSED + FAILED))
echo "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ❌ Errors"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    for error in "${ERRORS[@]}"; do
        echo -e "${RED}✗${NC} ${error}"
    done
    echo ""
    echo -e "${RED}❌ DEPLOYMENT VALIDATION FAILED${NC}"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ ALL TESTS PASSED - DEPLOYMENT VALIDATED${NC}"
    echo ""
    exit 0
fi
