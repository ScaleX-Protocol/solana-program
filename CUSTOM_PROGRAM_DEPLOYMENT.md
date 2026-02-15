# Custom OpenBook V2 Program Deployment Guide

## Overview

This guide covers deploying a custom OpenBook V2 program with the BPF stack overflow fix to devnet.

**Program ID**: `GesS1wVm85uRvvjYDAgCVK9MJU5icjsX3LX6GMfibKW1`

## Problem Fixed

**BPF Stack Overflow in CreateMarket**
- Error: `Stack offset of 4360 exceeded max offset of 4096 by 264 bytes`
- Root cause: Large structs on the stack in the `CreateMarket` instruction
- Solution: Wrapped `market_base_vault` and `market_quote_vault` in `Box<>` to move from stack to heap

## Prerequisites

1. **SOL Balance**: At least 6 SOL on devnet
   ```bash
   solana balance --url devnet
   ```

2. **Toolchain**:
   - Rust 1.79.0 (avoid 1.80+ for BPF compatibility)
   - Anchor 0.29.0
   - Solana CLI configured for devnet

3. **OpenBook V2 Source**: Clone the official OpenBook V2 repository
   ```bash
   cd programs
   git clone https://github.com/openbook-dex/openbook-v2.git
   cd openbook-v2
   ```

## Step 1: Apply Stack Overflow Fix

### Option A: Using Patch File

```bash
cd programs/openbook-v2
patch -p1 < ../../patches/openbook-v2-stack-overflow-fix.patch
```

### Option B: Manual Edit

Edit `programs/openbook-v2/src/accounts_ix/create_market.rs`:

```rust
// Lines 42 and 49 - change from:
pub market_base_vault: Account<'info, TokenAccount>,
pub market_quote_vault: Account<'info, TokenAccount>,

// To:
pub market_base_vault: Box<Account<'info, TokenAccount>>,
pub market_quote_vault: Box<Account<'info, TokenAccount>>,
```

## Step 2: Deploy to Devnet

From your server (where network connectivity is available):

```bash
cd /path/to/openbook
./scripts/deploy-fixed-program.sh
```

The script will:
1. Verify the stack overflow fix is applied
2. Clean previous builds
3. Build with Rust 1.79.0 and `--features enable-gpl`
4. Check for stack overflow warnings
5. Prompt for confirmation
6. Deploy to devnet
7. Update `deployments/devnet.json` with deployment details

## Step 3: Verify Deployment

Check the program on Solana Explorer:
```
https://explorer.solana.com/address/GesS1wVm85uRvvjYDAgCVK9MJU5icjsX3LX6GMfibKW1?cluster=devnet
```

View program info:
```bash
solana program show GesS1wVm85uRvvjYDAgCVK9MJU5icjsX3LX6GMfibKW1 --url devnet
```

## Step 4: Test Market Creation

```bash
cd packages/scripts
ANCHOR_WALLET=~/.config/solana/id.json npx ts-node testCustomProgram.ts
```

This will attempt to create a BTC/USDT market using your custom program.

## Step 5: Configure Indexer

Update `.env.solana-devnet`:
```
OPENBOOK_PROGRAM_ID=GesS1wVm85uRvvjYDAgCVK9MJU5icjsX3LX6GMfibKW1
```

Clear the indexer database:
```bash
./scripts/clear-indexer-db.sh
```

Restart the indexer to start indexing your custom program's markets.

## Build Details

**Stack Usage**:
- Before fix: 4360 bytes (264 bytes over limit) ❌
- After fix: <4096 bytes ✅

**Build Configuration**:
- Rust: 1.79.0
- Solana: ~1.17.1 dependencies
- Features: `enable-gpl`
- Target: BPF (Berkeley Packet Filter)

## Troubleshooting

### DNS Resolution Errors (Local)

If you see "dns error: failed to lookup address information", deploy from a server with proper network connectivity instead of localhost.

### Low SOL Balance

Get more SOL from the faucet:
```bash
solana airdrop 5 --url devnet
```

### Stack Overflow Warnings Persist

If you still see CreateMarket stack overflow errors:
1. Verify the patch was applied correctly
2. Check that you're building with Rust 1.79.0
3. Run `cargo clean && anchor clean` before rebuilding

### Deployment Fails

- Check RPC URL is accessible
- Verify wallet has upgrade authority
- Try using a private RPC (Helius, QuickNode) instead of public devnet RPC

## Files Modified

- `programs/openbook-v2/src/accounts_ix/create_market.rs` - Stack overflow fix
- `deployments/devnet.json` - Deployment tracking
- `.env.solana-devnet` - Indexer configuration

## Next Steps

1. Create markets with your tokens (BTC, USDT, WETH)
2. Test order placement and matching
3. Monitor indexer to ensure markets appear
4. Build trading UI or strategies using the custom program

## Resources

- Program Explorer: https://explorer.solana.com/address/GesS1wVm85uRvvjYDAgCVK9MJU5icjsX3LX6GMfibKW1?cluster=devnet
- Patch: `patches/openbook-v2-stack-overflow-fix.patch`
- Deployment Script: `scripts/deploy-fixed-program.sh`
- Test Script: `packages/scripts/testCustomProgram.ts`
