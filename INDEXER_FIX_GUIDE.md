# OpenBook Indexer Fix Guide

## Issue Summary

**Root Cause Identified**: The indexer was extracting market addresses from the wrong account index (position 0 = signer), resulting in fake markets owned by the System Program being indexed instead of real OpenBook markets.

### Evidence

**Fake Markets** (owned by System Program `11111111111111111111111111111111`):
- `HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt`
- `7iahzfPXQRxmuJW5TnYh51MXP4PLgq41JJUSZ2i8n5CB`
- `Dy3wRkoWG5phCTSsQS3YxkMqr8D9K28nrWbRXdNJvQ4W`
- `HdUZsHUxp6mcqBmEDahmZgW5jnLV5x6GWz5SNT2dh8ad`

**Real Market** (owned by OpenBook program `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`):
- `HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6`

## Fix Deployed

**Commit**: `80518b9` - "Fix indexer to use on-chain market scanner instead of event parsing"

**Changes**:
1. Added `market_scanner.rs` - Scans blockchain for real OpenBook markets
   - Filters by market discriminator (first 8 bytes of account data)
   - Validates accounts are owned by OpenBook program
   - Parses market data (name, base/quote mints, decimals)

2. Updated `event_listener.rs` - Runs market scanner on startup before backfill

3. Updated `event_processor.rs` - CreateMarket events only log (don't insert markets)

4. Created `cleanup-fake-markets.sql` - SQL script to remove fake markets

**Deployment Status**: ✅ Successfully deployed at 2026-02-13 20:34:53 UTC

## Manual Cleanup Required

The code fix is deployed, but the database still contains old fake markets. Run these commands on your server:

### Step 1: Clean Database

```bash
# SSH into server
ssh root@152.53.225.25

# Clear all stale market data
docker exec postgres-database psql -U postgres -d openbook_devnet << 'EOF'
BEGIN;

-- Show current state
SELECT 'Before cleanup:' as status;
SELECT COUNT(*) as markets_count FROM markets;
SELECT COUNT(*) as orders_count FROM orders;

-- Clear all data (CASCADE handles foreign key dependencies)
TRUNCATE TABLE orders, trades, events, markets CASCADE;

-- Verify cleanup
SELECT 'After cleanup:' as status;
SELECT COUNT(*) as markets_count FROM markets;
SELECT COUNT(*) as orders_count FROM orders;

COMMIT;
EOF
```

### Step 2: Restart Listener

```bash
# Restart the listener to trigger market scanner
docker restart solana-devnet-listener

# Wait a few seconds for it to start
sleep 5
```

### Step 3: Monitor Market Scanning

```bash
# Watch the logs (press Ctrl+C to exit when done)
docker logs -f solana-devnet-listener

# Look for these log messages:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 Market Scanner - Indexing Real OpenBook Markets
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 Scanning for OpenBook V2 market accounts...
# ✅ Found X potential market accounts
#   📊 Market: <address> - <name> (base: ..., quote: ...)
# ✅ Successfully parsed X markets
# 💾 Storing X markets in database...
#   ✅ <name> - <address>
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ Market Indexing Complete
# 📊 X markets indexed successfully
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 4: Verify Markets

```bash
# Check markets in database
docker exec postgres-database psql -U postgres -d openbook_devnet -c \
  "SELECT id, symbol, base_mint, quote_mint FROM markets;"

# Should show only real OpenBook markets (owned by program)
# At minimum, should see: HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6
```

### Step 5: Test API

```bash
# Test markets endpoint
curl -s https://solana-devnet-indexer.scalex.money/api/markets | jq '.'

# Expected: Array of real markets, no fake ones
# Each market should have valid symbol, poolId, base/quote assets

# Test orders endpoint
curl -s https://solana-devnet-indexer.scalex.money/api/allOrders | jq '.'

# Expected: Empty array initially (will fill as orders are placed)
```

## Verification Checklist

After running the cleanup:

- [ ] Database truncated successfully
- [ ] Listener restarted
- [ ] Market scanner logs appeared
- [ ] Real markets indexed (verified in database)
- [ ] API returns real markets (not the 4 fake ones)
- [ ] Orders endpoint accessible (empty array is OK)

## Known Real Market on Devnet

```bash
# Verify this market on-chain:
solana account HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6 --url https://api.devnet.solana.com

# Should show:
# Owner: opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb
```

## If Market Scanner Finds 0 Markets

If the scanner reports 0 markets found, it means:
1. No OpenBook V2 markets exist on devnet with the standard discriminator
2. The filter criteria may need adjustment
3. Markets might use a different account structure

In this case, investigate with:

```bash
# Check if OpenBook program has ANY accounts
curl -s -X POST https://api.devnet.solana.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getProgramAccounts",
    "params": [
      "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb",
      {"encoding": "base64", "dataSlice": {"offset": 0, "length": 0}}
    ]
  }' | jq '.result | length'

# If this returns a large number, the program exists but market filter needs adjustment
```

## Troubleshooting

### SSH Timeout Issues

If you can't SSH from your current location:
- Try from a different network/IP
- Check firewall rules on the server
- Use server console access if available
- Check SSH service status: `systemctl status sshd`

### Listener Not Starting

```bash
# Check container status
docker ps -a | grep solana

# If not running, check why
docker logs solana-devnet-listener --tail 100

# Common issues:
# - Build failure (missing dependencies)
# - Database connection failure
# - RPC connection failure
# - Permission issues
```

### Market Scanner Errors

```bash
# Check for errors in listener logs
docker logs solana-devnet-listener 2>&1 | grep -i error

# Common issues:
# - RPC rate limiting
# - Invalid program ID in config
# - Database connection issues
# - Account data parsing errors
```

## Technical Details

### Market Account Discriminator

OpenBook V2 uses Anchor's account discriminator pattern:
- First 8 bytes = SHA256("account:Market")[0..8]
- Value: `[247, 158, 187, 245, 186, 185, 204, 167]`
- Hex: `f79ebef5bab9cca7`

### Market Scanner Logic

```rust
// Filter accounts by:
1. Program ownership = opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb
2. Discriminator match (first 8 bytes)
3. Minimum data size ~3000 bytes

// Parse account data:
- Name at offset ~370 (16 bytes)
- Base mint at offset ~386 (32 bytes)
- Quote mint at offset ~418 (32 bytes)
```

## Files Modified

- `crates/indexer/src/market_scanner.rs` (new)
- `crates/indexer/src/lib.rs` (added module)
- `crates/indexer/src/bin/event_listener.rs` (run scanner on startup)
- `crates/indexer/src/event_processor.rs` (disable market insertion from events)
- `crates/indexer/cleanup-fake-markets.sql` (new)

## Contact

If you encounter issues:
1. Check listener logs for error messages
2. Verify database connectivity
3. Confirm RPC endpoint is responding
4. Validate program ID in `.env.solana-devnet`

Deployment timestamp: 2026-02-13 20:34:53 UTC
Workflow: https://github.com/ScaleX-Protocol/solana-program/actions/runs/21988385214
