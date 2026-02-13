# OpenOrders Account Quick Reference

## The Golden Rule

**NEVER manually calculate OpenOrders PDAs. ALWAYS use the SDK.**

## ❌ NEVER DO THIS

```typescript
// WRONG! This is NOT how OpenOrders PDAs work!
const [openOrdersPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("OpenOrders"), authority.toBuffer(), MARKET.toBuffer()],
  PROGRAM_ID
);
```

## ✅ ALWAYS DO THIS

```typescript
// CORRECT! Let the SDK find the account
const openOrdersAccounts = await client.findOpenOrdersForMarket(
  authority.publicKey,
  MARKET
);

const openOrdersPDA = openOrdersAccounts[openOrdersAccounts.length - 1];
```

## How OpenOrders Works

```
User → OpenOrdersIndexer (tracks counter: 0, 1, 2, 3...)
       ├─ OpenOrders[0] (index 0) → Market A
       ├─ OpenOrders[1] (index 1) → Market A
       ├─ OpenOrders[2] (index 2) → Market B
       └─ OpenOrders[3] (index 3) → Market A
```

### PDA Derivation

```typescript
// OpenOrdersIndexer PDA
["OpenOrdersIndexer", owner]

// OpenOrders PDA (uses INDEX, not MARKET!)
["OpenOrders", owner, accountIndex]  // accountIndex is 0, 1, 2, 3...
```

### Key Points

- ✅ Multiple OpenOrders accounts can exist for the SAME market
- ✅ Account index is stored in OpenOrdersIndexer.createdCounter
- ✅ PDAs use accountIndex (number), NOT market address
- ✅ SDK handles all of this for you

## Complete Working Example

```typescript
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";

// 1. Setup client
const client = new OpenBookV2Client(provider);
const market = await client.deserializeMarketAccount(MARKET);

// 2. Find or create OpenOrders
let openOrdersAccounts = await client.findOpenOrdersForMarket(
  authority.publicKey,
  MARKET
);

if (openOrdersAccounts.length === 0) {
  console.log("Creating new OpenOrders account...");
  await client.createOpenOrders(authority, MARKET, "trader");

  // Wait and refetch
  await new Promise(r => setTimeout(r, 5000));
  openOrdersAccounts = await client.findOpenOrdersForMarket(
    authority.publicKey,
    MARKET
  );
}

const openOrdersPDA = openOrdersAccounts[openOrdersAccounts.length - 1];

// 3. Place order
const [ix, signers] = await client.placeOrderIx(
  openOrdersPDA,  // ← Account from findOpenOrdersForMarket
  MARKET,
  market,
  userTokenAccount,
  null,
  orderArgs,
  []
);

await client.sendAndConfirmTransaction([ix], { additionalSigners: signers });
```

## Diagnostic Commands

```bash
# View all your OpenOrders accounts
pnpm exec ts-node checkIndexer.ts

# Analyze PDA derivation
pnpm exec ts-node checkPDA.ts

# Place order with correct pattern
pnpm place-order-correct
```

## What If I Did It Wrong?

**Don't worry!** If you were calculating PDAs incorrectly:

1. Your `createOpenOrders()` calls DID succeed ✅
2. You just couldn't verify them (wrong address)
3. You probably created many accounts (all valid!)
4. Just switch to using `findOpenOrdersForMarket()` going forward

## Files to Reference

- `placeOrderCorrect.ts` - Working implementation
- `BREAKTHROUGH.md` - Full technical explanation
- Main README - Complete setup guide

---

**Remember:** When in doubt, use the SDK methods. They know what they're doing!
