# OpenBook V2 Local Deployment Summary

**Date:** February 11, 2026
**Status:** ✅ Successfully Deployed

---

## Environment Configuration

### Versions Used

| Component | Version | Location |
|-----------|---------|----------|
| **Rust** | 1.79.0 | `openbook-v2/rust-toolchain.toml` |
| **Solana CLI** | 1.18.23 | System installation |
| **Anchor** | 0.28.0 (CLI) / 0.29.0 (deps) | Workspace |
| **Node.js** | v20.11.0 | System installation |

### Updated Files

1. **`openbook-v2/rust-toolchain.toml`**
   - Changed from: `1.70.0`
   - Changed to: `1.79.0`
   - Reason: Support newer Cargo features while avoiding stack overflow issues

2. **`openbook-v2/Cargo.toml`**
   - Solana dependencies: `~1.17.1` → `~1.18.23`
   - Updated: solana-program, solana-sdk, solana-client, etc.

3. **`env-local.sh`** (new file)
   - Project-specific environment setup script
   - Sets PATH for Solana 1.18.23
   - Verifies versions before building

---

## Deployment Approach

### Why Pre-Built OpenBook?

We used **pre-built OpenBook from devnet** instead of compiling locally because:

- ✅ Solana 1.18.23+ dependencies require Rust edition2024 (very recent Rust versions)
- ✅ Rust 1.85+ causes BPF stack overflow issues with OpenBook's complex functions
- ✅ Recommended approach in the setup guide for non-development use
- ✅ Faster and more reliable than dealing with toolchain conflicts

### Programs Deployed

**Downloaded Programs:**

1. **OpenBook V2**
   - Program ID: `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`
   - Location: `/tmp/openbook_v2.so`
   - Source: Solana Devnet
   - Size: 2,059,776 bytes (1.96 MB)

2. **Metaplex Token Metadata**
   - Program ID: `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`
   - Location: `/tmp/metaplex_token_metadata.so`
   - Source: Solana Devnet
   - Size: 1,295,344 bytes (1.24 MB)

---

## Deployed Assets

### Tokens with Metadata

All tokens created with full metadata (name, symbol, logo URI):

| Token | Decimals | Mint Address |
|-------|----------|--------------|
| **Bitcoin (BTC)** | 8 | `B7udgqHsi1GNWQ3XGuYp7z7cDvSG9zfjfJFDuLNcXaBd` |
| **Tether USD (USDT)** | 6 | `C3tsGNDJuYuh6Gxcez7R6Zd2ENeSB2CkXjfkDqM3Gh11` |
| **Wrapped Ethereum (WETH)** | 9 | `FT1QsN1uerpiF59WyfsLRYM7mMqxktWJaE94S8daxckz` |

### Trading Markets

| Market Pair | Market Address | Created |
|-------------|----------------|---------|
| **BTC/USDT** | `CXzruzDdyDxk7JtSnTjRwtwq77QmDcTu7KtLHrnGzFXh` | Slot 1770795767 |
| **WETH/USDT** | `BcF2kT1Rx9GHAh2zm9rVwUwWkoQZXggiejC2dhbtV2Ns` | Slot 1770795769 |

---

## Validator Configuration

### Connection Details

```bash
RPC URL:       http://localhost:8899
WebSocket URL: ws://localhost:8900/
Keypair:       ~/.config/solana/id.json
Commitment:    confirmed
```

### Authority Account

```
Address: HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt
Balance: 500000100.00 SOL (plenty for testing)
```

### Validator Start Command

```bash
solana-test-validator \
  --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
    /tmp/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    /tmp/metaplex_token_metadata.so \
  --quiet &
```

---

## Transaction Signatures

### Market Creation Transactions

- **BTC/USDT Market:** `56nw4KJLV1Y5JPRUn7nS...`
- **WETH/USDT Market:** `3AZMFxXZFktChTPtdn31...`

---

## Available Scripts

All scripts located in `/Users/renaka/gtx/openbook/scripts-v2/`:

### Deployment & Management

```bash
# Deploy markets (what we just ran)
npm run deploy-local-fixed

# View all markets with details
npm run view-markets

# List markets (simple)
npm run get-markets

# Create a custom market
npm run create-market

# Place an order
npm run post-order
```

### Token Creation

```bash
# Create standalone tokens with metadata
npm run create-tokens-with-metadata

# Low-level token creation (educational)
npm run create-token-low-level
```

---

## Quick Reference Commands

### Check Validator Status

```bash
# Check if validator is running
ps aux | grep solana-test-validator

# View logs
solana logs

# Check programs
solana program show opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb
solana program show metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s

# Check balance
solana balance
```

### Restart Validator

```bash
# Kill existing validator
pkill -9 -f solana-test-validator

# Start with programs
solana-test-validator \
  --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so \
  --quiet &

# Wait and configure
sleep 10
solana config set --url http://localhost:8899
solana airdrop 100
```

### Redeploy Markets

```bash
cd /Users/renaka/gtx/openbook/scripts-v2
npm run deploy-local-fixed
```

---

## What Works Now

✅ **Local Solana validator** running with OpenBook V2
✅ **Token creation** with proper metadata (name, symbol, logo)
✅ **Trading markets** (BTC/USDT, WETH/USDT)
✅ **Fast iteration** (instant confirmations)
✅ **Free testing** (unlimited airdrops)
✅ **Production-ready** token infrastructure

---

## Architecture Notes

### Why Two Programs?

**OpenBook V2 Program:**
- Handles order book logic
- Manages markets, orders, and matching
- Your trading DEX application

**Metaplex Token Metadata:**
- Stores token names, symbols, logos
- External library used as-is
- No need to modify

### Token Structure

Each token consists of:

1. **Mint Account** (82 bytes)
   - Stores decimals, supply, mint authority
   - Managed by SPL Token Program

2. **Metadata Account** (PDA)
   - Stores name, symbol, URI
   - Managed by Metaplex Program
   - Derived from mint address (deterministic)

### Market Structure

Each market consists of:
- Market state account
- Event queue
- Bids orderbook
- Asks orderbook
- Base vault (for base token)
- Quote vault (for quote token)

---

## Next Development Steps

### 1. Place Test Orders

Edit `scripts-v2/postOrder.ts` with your desired parameters:
```typescript
// Market address (BTC/USDT or WETH/USDT)
// Side (buy or sell)
// Price and quantity
```

Then run:
```bash
npm run post-order
```

### 2. Build Trading UI

Connect to your local validator:
```typescript
const connection = new Connection("http://localhost:8899");
const programId = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
```

Use OpenBook V2 TypeScript client to:
- Display order books
- Show trades
- Place/cancel orders
- View market depth

### 3. Create More Markets

```bash
# Edit createMarket.ts with new token pairs
npm run create-market
```

### 4. Develop Trading Strategies

- Market making bots
- Arbitrage detection
- Order matching algorithms
- Price feeds integration

---

## Troubleshooting Reference

### Validator Not Running

```bash
# Check if running
ps aux | grep solana-test-validator

# If not, start it
solana-test-validator \
  --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so \
  --quiet &
```

### Connection Refused

```bash
# Make sure RPC is configured
solana config set --url http://localhost:8899

# Test connection
solana cluster-version
```

### Insufficient Funds

```bash
# Airdrop more SOL
solana airdrop 100
solana balance
```

### Programs Missing

```bash
# Check if program files exist
ls -lh /tmp/openbook_v2.so
ls -lh /tmp/metaplex_token_metadata.so

# If missing, download them again
solana program dump opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so --url https://api.devnet.solana.com
solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so --url https://api.devnet.solana.com
```

### Markets Not Found

```bash
# Validator was reset, redeploy
cd /Users/renaka/gtx/openbook/scripts-v2
npm run deploy-local-fixed
```

---

## Related Documentation

- **COMPLETE_SETUP_GUIDE.md** - Full setup instructions
- **LOCAL_DEPLOYMENT_SUCCESS.md** - Previous deployment notes
- **LOW_LEVEL_EXPLANATION.md** - Technical deep dive
- **EVM_TO_SOLANA_TOKENS.md** - EVM developer guide
- **env-local.sh** - Environment setup script

---

## Notes

### Version Alignment Issue

We encountered a toolchain conflict:
- Solana 1.18.23+ requires Rust with edition2024 support (1.85+)
- Rust 1.80+ causes BPF stack overflow in OpenBook compilation
- Solution: Use pre-built OpenBook program from devnet

This is the **recommended approach** and works perfectly for local development and testing.

### Future Considerations

If you need to modify OpenBook source code:
1. Consider using Solana 1.17.x with Rust 1.75.0 for compilation
2. Or wait for Solana toolchain updates that resolve the conflict
3. Or use newer BPF tooling that handles stack limits better

For now, using the pre-built program is ideal for:
- Learning OpenBook V2
- Building applications on top of OpenBook
- Testing market interactions
- Developing trading strategies

---

**Deployment successful! Your local OpenBook DEX is ready for development.** 🚀
