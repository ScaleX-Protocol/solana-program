# Deployment Validation Guide

## Overview

The `validate-deployment.sh` script provides comprehensive validation of all OpenBook Indexer API endpoints to ensure your deployment is working correctly.

## Quick Start

```bash
# Validate local deployment
./validate-deployment.sh

# Validate remote deployment
API_BASE=https://api.example.com ./validate-deployment.sh
```

## What It Tests

### ✅ Market Endpoints
- `GET /api/markets` - List all markets
- `GET /api/markets?limit=10` - Markets with limit
- `GET /api/pairs` - Trading pairs

### ✅ Price & Order Book Endpoints
- `GET /api/depth?symbol=BTC/USDT` - Order book depth
- `GET /api/ticker/price?symbol=BTC/USDT` - Current price
- `GET /api/ticker/24hr?symbol=BTC/USDT` - 24hr ticker stats

### ✅ Order Endpoints
- `GET /api/allOrders?user=ADDRESS` - All orders (with user param)
- `GET /api/allOrders?address=ADDRESS` - All orders (with address param)
- `GET /api/openOrders?user=ADDRESS` - Open orders (with user param)
- `GET /api/openOrders?address=ADDRESS` - Open orders (with address param)
- `GET /api/allOrders?user=ADDRESS&symbol=BTC/USDT` - Filtered by symbol

### ✅ Trade Endpoints
- `GET /api/trades?symbol=BTC/USDT` - Market trades
- `GET /api/trades?symbol=BTC/USDT&limit=10` - Trades with limit
- `GET /api/trades?symbol=BTC/USDT&orderBy=asc` - Oldest first
- `GET /api/trades?symbol=BTC/USDT&orderBy=desc` - Newest first
- `GET /api/trades?user=ADDRESS` - User trades (with user param)
- `GET /api/trades?address=ADDRESS` - User trades (with address param)
- `GET /api/trades?user=ADDRESS&symbol=BTC/USDT` - User trades on market

### ✅ Account Endpoints
- `GET /api/account?address=ADDRESS` - Account information

### ✅ Asset Tracking (Lending Dashboard)
- `GET /api/lending/dashboard/:user` - Full dashboard
- `GET /api/lending/dashboard/:user?chainId=101` - With chainId
- Validates all required fields:
  - `supplies`, `borrows`, `availableToSupply`, `availableToBorrow`
  - `activityHistory`, `interestRateParams`, `assetConfigurations`
  - Complete `summary` object with all 6 fields

### ✅ System Endpoints
- `GET /api/sync-status` - Indexer sync status

## Validation Checks

For each endpoint, the script validates:

1. **HTTP Status Code** - Must return 200 OK
2. **Valid JSON** - Response must be parseable JSON
3. **Response Type** - Arrays where expected, objects where expected
4. **Required Fields** - All mandatory fields must be present
5. **Field Structure** - Nested objects must be complete

## Exit Codes

- `0` - All tests passed ✅
- `1` - One or more tests failed ❌

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 OpenBook Indexer API Deployment Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API Base URL: http://localhost:42070
Test User: HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 Market Endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing GET /api/markets... ✓ PASSED
Testing GET /api/markets?limit=10... ✓ PASSED
Testing GET /api/pairs... ✓ PASSED

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 Results Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Tests: 25
Passed: 25
Failed: 0

✅ ALL TESTS PASSED - DEPLOYMENT VALIDATED
```

## Configuration

### Environment Variables

- `API_BASE` - Base URL for the API (default: `http://localhost:42070`)

### Test User

The script uses a known test user address:
```
HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt
```

To use a different test user, edit the `TEST_USER` variable in the script.

## Usage Examples

### Local Development

```bash
# Test local indexer
./validate-deployment.sh
```

### Staging Environment

```bash
# Test staging server
API_BASE=https://staging-api.example.com ./validate-deployment.sh
```

### Production Environment

```bash
# Test production server
API_BASE=https://api.example.com ./validate-deployment.sh
```

### CI/CD Integration

```bash
#!/bin/bash
# In your CI/CD pipeline

# Start the indexer
./start-indexer.sh

# Wait for it to be ready
sleep 10

# Validate deployment
if ./validate-deployment.sh; then
    echo "Deployment validated successfully"
    exit 0
else
    echo "Deployment validation failed"
    exit 1
fi
```

### Docker Integration

```dockerfile
# Dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y curl jq
COPY --from=builder /app/target/release/api_server /usr/local/bin/
COPY scripts-v2/validate-deployment.sh /usr/local/bin/

# Health check using validation script
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD /usr/local/bin/validate-deployment.sh || exit 1
```

## Troubleshooting

### Common Issues

#### 1. Connection Refused
```
Testing GET /api/markets... ✗ FAILED (HTTP 000)
```

**Solution:** Ensure the API server is running:
```bash
# Check if server is running
curl http://localhost:42070/api/markets

# Start the server if needed
cd /Users/renaka/gtx/openbook/indexer
cargo run --bin api_server
```

#### 2. Invalid JSON Response
```
Testing GET /api/markets... ✗ FAILED (Invalid JSON)
```

**Solution:** The server returned non-JSON data. Check server logs:
```bash
tail -f /Users/renaka/gtx/openbook/indexer/logs/api_server.log
```

#### 3. Missing Required Fields
```
Testing GET /api/lending/dashboard... ✗ FAILED (Missing field: .summary.healthFactor)
```

**Solution:** The API response is missing required fields. Ensure you're running the latest version:
```bash
cd /Users/renaka/gtx/openbook/indexer
git pull
cargo build --release
```

#### 4. HTTP 404 Not Found
```
Testing GET /api/ticker/24hr... ✗ FAILED (HTTP 404)
```

**Solution:** Endpoint not implemented or wrong path. Check the API documentation:
```bash
cat API_QUICK_REFERENCE.md
```

## What Gets Validated

### Response Format Checks

✅ **camelCase Field Names**
```json
{
  "orderId": "123",      // ✅ Correct
  "order_id": "123"      // ❌ Wrong
}
```

✅ **Binance-Compatible Format**
```json
{
  "side": "BUY",         // ✅ Correct
  "side": "bid"          // ❌ Wrong
}
```

✅ **String Values for Amounts**
```json
{
  "price": "50000.00",   // ✅ Correct
  "price": 50000         // ❌ Wrong
}
```

✅ **Complete Nested Objects**
```json
{
  "projectedEarnings": {
    "hourly": "0.00",    // ✅ All 4 fields present
    "daily": "0.00",
    "weekly": "0.00",
    "monthly": "0.00"
  }
}
```

## Continuous Validation

### Run on Every Deployment

```bash
# In your deployment script
#!/bin/bash
set -e

echo "Deploying indexer..."
./deploy.sh

echo "Waiting for service to be ready..."
sleep 30

echo "Validating deployment..."
if API_BASE=https://your-api.com ./validate-deployment.sh; then
    echo "✅ Deployment successful and validated"
else
    echo "❌ Deployment validation failed - rolling back"
    ./rollback.sh
    exit 1
fi
```

### Scheduled Health Checks

```bash
# Add to cron: check every 15 minutes
*/15 * * * * /path/to/validate-deployment.sh || /path/to/alert.sh
```

## Test Coverage

The script provides **comprehensive coverage** of all public API endpoints:

| Category | Endpoints Tested | Coverage |
|----------|------------------|----------|
| Markets | 3 | 100% |
| Prices | 3 | 100% |
| Orders | 5 | 100% |
| Trades | 7 | 100% |
| Account | 1 | 100% |
| Assets | 3 | 100% |
| System | 1 | 100% |
| **Total** | **23** | **100%** |

## Success Criteria

For deployment to be considered valid, ALL tests must pass:

- ✅ All endpoints return HTTP 200
- ✅ All responses are valid JSON
- ✅ All required fields are present
- ✅ All nested objects are complete
- ✅ Field names follow camelCase convention
- ✅ Values follow Binance-compatible format

## Next Steps After Validation

Once validation passes:

1. **Monitor Performance**
   ```bash
   # Check response times
   curl -w "@curl-format.txt" http://localhost:42070/api/markets
   ```

2. **Test with Real Users**
   ```bash
   # Replace with actual user addresses
   curl "http://localhost:42070/api/lending/dashboard/REAL_USER_ADDRESS"
   ```

3. **Set Up Monitoring**
   - Configure alerting for failed health checks
   - Monitor API response times
   - Track error rates

4. **Document API Version**
   ```bash
   # Tag the validated version
   git tag -a v1.0.0 -m "Validated API deployment"
   ```

## Summary

The validation script ensures:
- ✅ All endpoints are accessible
- ✅ All responses are correctly formatted
- ✅ Frontend compatibility is maintained
- ✅ No breaking changes were introduced
- ✅ API contract is fulfilled

**Result:** Confidence that your deployment is production-ready! 🚀
