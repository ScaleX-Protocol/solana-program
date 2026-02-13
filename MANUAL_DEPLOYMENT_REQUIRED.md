# Manual Deployment Required

## Current Situation

✅ **Code Fixes Complete** - All fixes committed and pushed:
1. `80518b9` - Market scanner implementation
2. `4963a05` - Fixed discriminator to actual on-chain value
3. `68302ea` - Fixed base58 encoding for RPC filter

❌ **Containers Not Running** - The Solana indexer containers have been removed from your server and need to be manually redeployed.

## Root Cause Analysis Summary

### Original Issue
The indexer was indexing fake markets owned by System Program instead of real OpenBook markets because:
1. Event processor extracted market address from wrong account position (signer, not market)
2. This created 4 fake markets in the database

### Fix Implementation
1. Created market scanner that queries blockchain directly for real markets
2. Filters by:
   - Program ownership: `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`
   - Market discriminator (base58): `dkokXHR3DTw`
   - Data size: 1132 bytes

### Validation
- Tested discriminator filter against devnet: **Found 1415 matching accounts**
- Verified real market exists: `HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6`

## Manual Deployment Steps

### Prerequisites
- Latest code already pushed to main branch
- Database already cleaned (TRUNCATE completed successfully)
- Server: `152.53.225.25`

### Step 1: Build and Deploy via GitHub Actions

**Option A: Trigger Workflow Manually**
1. Go to: https://github.com/ScaleX-Protocol/solana-program/actions
2. Find workflow: "🚀 Deploy Indexer - Devnet"
3. Click "Run workflow" → Select branch: `main` → Run
4. Wait for completion (~10-15 minutes for Rust build)

**Option B: Check if workflow is running/failed**
1. Check: https://github.com/ScaleX-Protocol/solana-program/actions
2. Look for recent "Deploy Indexer - Devnet" runs
3. If failed, check logs for errors
4. Re-run if needed

### Step 2: Verify Deployment on Server

```bash
# SSH to server
ssh root@152.53.225.25

# Check if containers are running
docker ps | grep solana

# Should see:
# - solana-devnet-indexer (API server)
# - solana-devnet-listener (Event listener with market scanner)

# If not running, check docker compose status
cd /path/to/deployment  # Find actual path
docker compose -f docker-compose.simple.yml ps
```

### Step 3: Check Market Scanner Logs

```bash
# View market scanner output
docker logs solana-devnet-listener 2>&1 | grep -A20 'Market Scanner'

# Should see something like:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 Market Scanner - Indexing Real OpenBook Markets
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 Scanning for OpenBook V2 market accounts...
# ✅ Found XXX potential market accounts
#   📊 Market: HLcm5... - <name> (base: ..., quote: ...)
# ✅ Successfully parsed X markets
# 💾 Storing X markets in database...
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ Market Indexing Complete
# 📊 X markets indexed successfully
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 4: Verify Markets in Database

```bash
# Check market count
docker exec postgres-database psql -U postgres -d openbook_devnet -c \
  "SELECT COUNT(*) as market_count FROM markets;"

# Should show > 0

# View indexed markets
docker exec postgres-database psql -U postgres -d openbook_devnet -c \
  "SELECT id, symbol, base_mint, quote_mint FROM markets LIMIT 20;"

# Verify at least one real market exists:
# - HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6
```

### Step 5: Test API Endpoints

```bash
# Test from server
curl -s http://localhost:42090/api/markets | jq '.'

# Test externally
curl -s https://solana-devnet-indexer.scalex.money/api/markets | jq '.'

# Should return array of real markets (not the 4 fake ones)
# Expected: Markets with proper symbols, valid poolIds, etc.

# Test orders endpoint
curl -s https://solana-devnet-indexer.scalex.money/api/allOrders | jq '.'

# Should return array (empty initially is OK, will fill as orders are placed)
```

## Troubleshooting

### If Workflow Fails

**Check build logs for**:
- Cargo compilation errors
- Missing dependencies
- Docker build failures

**Common fixes**:
- Re-run workflow (sometimes transient failures)
- Check runner status
- Verify env files exist in repository

### If Market Scanner Finds 0 Markets

**Possible causes**:
1. RPC endpoint rate limiting → Wait and retry
2. Incorrect program ID in config → Verify `.env.solana-devnet`
3. Network connectivity issues → Check RPC endpoint

**Debug**:
```bash
# Check RPC connectivity from container
docker exec solana-devnet-listener curl -s https://api.devnet.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | jq '.'

# Should return: {"jsonrpc":"2.0","result":"ok","id":1}
```

### If Markets Still Empty After Successful Scan

**Possible causes**:
1. Database connection issue → Check DATABASE_URL in env
2. Permission issues → Check postgres user permissions
3. Schema mismatch → Re-run schema.sql

**Fix**:
```bash
# Re-initialize schema
docker exec -i postgres-database psql -U postgres -d openbook_devnet < \
  /path/to/crates/indexer/schema.sql

# Restart listener to trigger scanner again
docker restart solana-devnet-listener

# Wait 30 seconds and check again
sleep 30
docker exec postgres-database psql -U postgres -d openbook_devnet -c \
  "SELECT COUNT(*) FROM markets;"
```

## Expected Final State

✅ Solana devnet indexer containers running
✅ Market scanner found and indexed real OpenBook markets
✅ Database contains real markets (not System Program-owned fakes)
✅ API returns market data
✅ Orders can be placed and indexed correctly

## Verification Checklist

- [ ] GitHub Actions workflow completed successfully
- [ ] Containers running on server (docker ps shows solana-devnet-*)
- [ ] Market scanner logs show markets found and indexed
- [ ] Database has markets (COUNT > 0)
- [ ] API endpoint returns markets: https://solana-devnet-indexer.scalex.money/api/markets
- [ ] At least market HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6 is indexed
- [ ] No fake markets (HDsWR5v5..., 7iahzfPX..., etc.)

## Technical Details

### Discriminator Discovery
- Analyzed real market account on-chain
- First 8 bytes: `db be d5 37 00 e3 c6 9a` (hex)
- Base58 encoded: `dkokXHR3DTw`
- Tested filter: Found 1415 matching accounts on devnet

### Code Locations
- Market scanner: `crates/indexer/src/market_scanner.rs`
- Event listener: `crates/indexer/src/bin/event_listener.rs`
- Event processor: `crates/indexer/src/event_processor.rs`

### Commits
- Market scanner: `80518b9`
- Discriminator fix: `4963a05`
- Base58 encoding: `68302ea`
- This guide: Latest commit

## Next Steps

1. **Deploy via GitHub Actions** (or manually if workflow unavailable)
2. **Verify deployment** using steps above
3. **Test API endpoints** to confirm fix works
4. **Monitor orders** to ensure they're processed correctly

Once deployed and verified, the indexer will be fully operational with real OpenBook markets!
