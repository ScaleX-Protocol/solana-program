# OpenBook V2 Scripts

TypeScript scripts and examples for interacting with OpenBook V2 DEX.

## ⚠️ Critical: OpenOrders Account Pattern

**Read this before placing orders!** OpenBook V2 uses an index-based system for OpenOrders accounts.

### ❌ WRONG - Never Do This

```typescript
// This calculates the WRONG address!
const [openOrdersPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("OpenOrders"), authority.toBuffer(), MARKET.toBuffer()],
  PROGRAM_ID
);
```

### ✅ CORRECT - Always Use This

```typescript
// Let the SDK find the correct account
const openOrdersAccounts = await client.findOpenOrdersForMarket(
  authority.publicKey,
  MARKET
);

// Use the latest account
const openOrdersPDA = openOrdersAccounts[openOrdersAccounts.length - 1];

// Or create if none exist
if (openOrdersAccounts.length === 0) {
  await client.createOpenOrders(payer, MARKET, "trader");
  // Then find again...
}
```

**Why?** OpenOrders PDAs are derived as `["OpenOrders", owner, accountIndex]` where accountIndex is a counter (0, 1, 2...) tracked by an OpenOrdersIndexer account. The market address is NOT part of the PDA!

**See:** `BREAKTHROUGH.md` for full technical explanation.

## Quick Start

### Local (Test Validator)

```bash
# 1. Start validator with pre-built programs
solana-test-validator --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so \
  --quiet &

# 2. Deploy markets
pnpm deploy-local

# 3. Place orders
pnpm post-order
```

### Devnet

```bash
# 1. Set up wallet with SOL
solana config set --url https://api.devnet.solana.com
solana airdrop 2

# 2. Deploy markets
pnpm deploy-devnet

# 3. Place orders (uses correct OpenOrders pattern)
pnpm place-order-correct
```

## Available Scripts

### Market Creation

- `pnpm deploy-local` - Deploy tokens and markets on localnet
- `pnpm deploy-devnet` - Deploy tokens and markets on devnet
- `pnpm create-tokens-with-metadata` - Create SPL tokens with Metaplex metadata
- `pnpm create-market` - Create a new OpenBook market
- `pnpm view-markets` - View all deployed markets

### Order Placement

- `pnpm place-order-correct` - ✅ **Recommended** - Place orders on devnet (correct pattern)
- `pnpm post-order` - Place orders on localnet
- `pnpm post-order-devnet` - Legacy devnet order placement (with retries)

### Trading

- `pnpm multi-wallet-trade` - Multi-wallet trading simulation
- `pnpm trading-demo` - Trading demonstration
- `pnpm simple-trade` - Simple trade example
- `pnpm order-book` - View order book

### Utilities

- `pnpm deposit-withdraw` - Test deposit/withdraw functionality
- `pnpm indexer` - Start event indexer
- `pnpm indexer-api` - Start indexer REST API

## Example: Correct Order Placement

See `placeOrderCorrect.ts` for the working implementation:

```typescript
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { OpenBookV2Client, PlaceOrderArgs, Side } from "@openbook-dex/openbook-v2";

const authority = getKeypair("~/.config/solana/id.json");
const connection = new Connection(RPC, "confirmed");
const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
const client = new OpenBookV2Client(provider);

// 1. Load market
const market = await client.deserializeMarketAccount(MARKET);

// 2. Find OpenOrders account (CRITICAL!)
const openOrdersAccounts = await client.findOpenOrdersForMarket(
  authority.publicKey,
  MARKET
);

if (openOrdersAccounts.length === 0) {
  await client.createOpenOrders(authority, MARKET, "trader");
  // Refetch after creation...
}

const openOrdersPDA = openOrdersAccounts[openOrdersAccounts.length - 1];

// 3. Setup token accounts
const mintUtils = new MintUtils(connection, authority);
const baseAcc = await mintUtils.getOrCreateTokenAccount(market.baseMint, authority, authority.publicKey);
const quoteAcc = await mintUtils.getOrCreateTokenAccount(market.quoteMint, authority, authority.publicKey);

// 4. Place order
const buyArgs: PlaceOrderArgs = {
  side: { bid: {} } as Side,
  priceLots: new BN(95),
  maxBaseLots: new BN(5),
  maxQuoteLotsIncludingFees: new BN(50000),
  clientOrderId: new BN(Date.now()),
  orderType: { limit: {} },
  expiryTimestamp: new BN(0),
  selfTradeBehavior: { decrementTake: {} },
  limit: 10,
};

const [ix, signers] = await client.placeOrderIx(
  openOrdersPDA,     // ← Correct account from findOpenOrdersForMarket!
  MARKET,
  market,
  quoteAcc.address,
  null,
  buyArgs,
  []
);

await client.sendAndConfirmTransaction([ix], { additionalSigners: signers });
```

## Key Files

- ✅ `placeOrderCorrect.ts` - Correct order placement pattern (USE THIS!)
- 📝 `BREAKTHROUGH.md` - Technical explanation of OpenOrders system
- 🔍 `checkPDA.ts` - PDA analysis tool
- 📊 `checkIndexer.ts` - OpenOrdersIndexer inspection tool

## Environment Variables

Scripts use these environment variables (optional):

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com  # Default: http://127.0.0.1:8899
ANCHOR_WALLET=~/.config/solana/id.json        # Default: ~/.config/solana/id.json
MARKET_ADDRESS=<market_pubkey>                # Market to interact with
```

## Common Issues

### "Account verification failed"

You're probably calculating the OpenOrders PDA incorrectly. Use `client.findOpenOrdersForMarket()` instead.

### "Transaction succeeded but order not placed"

The order WAS placed! The issue is with verification, not the transaction. Check the blockchain explorer to confirm.

### "ConstraintTokenMint error"

Make sure you're passing the correct token account for the order side:
- BUY orders: use quote token account
- SELL orders: use base token account

## Troubleshooting

### Check Your OpenOrders Accounts

```bash
# Run the diagnostic script
pnpm exec ts-node checkIndexer.ts

# This shows:
# - Your OpenOrdersIndexer address
# - Created counter (how many accounts you have)
# - All your OpenOrders accounts and their markets
```

### Verify PDA Derivation

```bash
# Run the PDA analysis
pnpm exec ts-node checkPDA.ts

# This compares:
# - Old incorrect PDA (with market)
# - Correct PDAs (with indices 0-10)
# - Your actual OpenOrdersIndexer
```

## Documentation

- 🎯 [BREAKTHROUGH.md](BREAKTHROUGH.md) - Complete OpenOrders explanation
- 📘 [Main README](../../README.md) - Repository setup guide
- 📕 [OpenBook V2 SDK](https://github.com/openbook-dex/openbook-v2)

## Contributing

When adding new scripts:

1. ✅ **Always use `client.findOpenOrdersForMarket()`** for account discovery
2. ❌ **Never manually calculate OpenOrders PDAs** with market in seeds
3. Include clear comments explaining OpenBook-specific patterns
4. Test on localnet first, then devnet
5. Add script to `package.json` scripts section

---

**Questions?** See `BREAKTHROUGH.md` or check the main repository README.
