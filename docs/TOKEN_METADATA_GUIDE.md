# Token Metadata Guide - Understanding Token Symbols on Solana

## 🔍 Current Situation

Your existing tokens **DO NOT have symbols** stored on-chain. Here's what you have:

### What Your Current Tokens Have

```typescript
// In localDeployFixed.ts
const btcMint = await mintUtils.createMint(8);   // ✅ Has: decimals
                                                 // ❌ No: name, symbol, logo
```

| Property | Status | Notes |
|----------|--------|-------|
| **Mint Address** | ✅ Exists | `EgYUYr2ceQmF7hNxfZ3TwJGjGwv4SR7PG16dL2eFVfp7` |
| **Decimals** | ✅ Set to 8 | Stored on-chain |
| **Name** | ❌ None | Not on-chain |
| **Symbol** | ❌ None | Not on-chain |
| **Logo** | ❌ None | Not on-chain |

### Where "BTC" Appears (But Isn't Stored)

1. **Console logs** - Just for display:
   ```typescript
   console.log("✅ BTC (8 decimals):", btcMint.toString());
   ```

2. **Market names** - Used in OpenBook market creation:
   ```typescript
   client.createMarketIx(
     authority.publicKey,
     "BTC/USDT",  // ← This is the market name, not token symbol
     usdtMint,
     btcMint,
     // ...
   );
   ```

---

## 🆕 What Is Token Metadata?

**Token Metadata** is additional on-chain data managed by the **Metaplex Token Metadata Program** that gives tokens:

- ✅ **Name** (e.g., "Bitcoin")
- ✅ **Symbol** (e.g., "BTC")
- ✅ **Logo/Image** (URL to image)
- ✅ **Description**
- ✅ Additional properties (creators, royalties, etc.)

### Why It Matters

Without metadata:
- ❌ Wallets show only the mint address
- ❌ Explorers can't display token names
- ❌ No logo appears
- ❌ Users see: `EgYUYr...Vfp7` instead of "BTC"

With metadata:
- ✅ Wallets show "Bitcoin (BTC)"
- ✅ Explorers display full token info
- ✅ Logo appears everywhere
- ✅ Professional appearance

---

## 🛠️ How to Create Tokens With Metadata

### Step 1: Install Dependencies

```bash
cd /Users/renaka/gtx/openbook/scripts-v2
npm install
```

This installs `@metaplex-foundation/mpl-token-metadata` which I've added to package.json.

### Step 2: Run the New Script

```bash
npm run create-tokens-with-metadata
```

### Step 3: What It Does

The new `createTokenWithMetadata.ts` script:

1. **Creates SPL Token Mint** (same as before)
2. **Creates Metadata Account** (new!)
   - Stores name, symbol, URI on-chain
   - Uses Metaplex Token Metadata Program
   - Creates a Program Derived Address (PDA) linked to the mint

### Expected Output

```
🚀 Creating Tokens with Metadata

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 Authority: HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt

📦 Creating BTC token with metadata...
✅ Mint created: [new-address]
✅ Metadata created!
   TX: [signature]
   Metadata Account: [PDA-address]

📦 Creating USDT token with metadata...
✅ Mint created: [new-address]
✅ Metadata created!
   TX: [signature]
   Metadata Account: [PDA-address]

📦 Creating WETH token with metadata...
✅ Mint created: [new-address]
✅ Metadata created!
   TX: [signature]
   Metadata Account: [PDA-address]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Tokens Created with Metadata!

Token Addresses:
  BTC:  [new-mint]
  USDT: [new-mint]
  WETH: [new-mint]

Metadata Accounts:
  BTC:  [PDA]
  USDT: [PDA]
  WETH: [PDA]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Now these tokens will show proper names and symbols in:
   - Phantom wallet
   - Solana Explorer
   - Any dApp that reads token metadata
```

---

## 📊 Comparison: With vs Without Metadata

### Without Metadata (Current)

```typescript
// mint_utils.ts
async createMint(nb_decimals = 6): Promise<PublicKey> {
  return await splToken.createMint(
    this.conn,
    this.authority,
    this.authority.publicKey,
    this.authority.publicKey,
    nb_decimals,  // Only sets decimals
  );
}
```

**Result:** Basic SPL token with no name/symbol/image

### With Metadata (New)

```typescript
// createTokenWithMetadata.ts
async function createTokenWithMetadata(
  connection: Connection,
  payer: Keypair,
  name: string,       // ← "Bitcoin"
  symbol: string,     // ← "BTC"
  uri: string,        // ← URL to metadata JSON / image
  decimals: number
) {
  // 1. Create mint (same as before)
  const mint = await createMint(...);

  // 2. Create metadata account (NEW!)
  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );

  // 3. Store name, symbol, URI on-chain
  const instruction = createCreateMetadataAccountV3Instruction({
    metadata: metadataAddress,
    mint: mint,
    // ...
  }, {
    data: {
      name: name,
      symbol: symbol,
      uri: uri,
      // ...
    }
  });

  await sendAndConfirmTransaction(...);
}
```

**Result:** Professional token with name, symbol, and logo visible everywhere

---

## 🏗️ How It Works Technically

### 1. Token Mint (What You Already Have)

```
Token Mint Account
├── Authority: HDsWR5v...
├── Decimals: 8
├── Supply: 0
└── Freeze Authority: HDsWR5v...
```

### 2. Metadata Account (What's Added)

```
Metadata PDA Account (derived from mint address)
├── Name: "Bitcoin"
├── Symbol: "BTC"
├── URI: "https://..."  ← Points to JSON with logo
├── Mint: [token-mint-address]
├── Update Authority: HDsWR5v...
└── Primary Sale: false
```

### 3. The URI Points To (Off-Chain)

```json
{
  "name": "Bitcoin",
  "symbol": "BTC",
  "description": "Bitcoin wrapped on Solana",
  "image": "https://example.com/bitcoin-logo.png",
  "properties": {
    "files": [
      {
        "uri": "https://example.com/bitcoin-logo.png",
        "type": "image/png"
      }
    ],
    "category": "currency"
  }
}
```

---

## 🎯 Next Steps

### Option 1: Keep Current Tokens (Simpler)

If you're just testing locally and don't need proper names/symbols:
- ✅ Continue using current tokens
- ✅ No changes needed
- ❌ But wallets won't show nice names

### Option 2: Add Metadata (Recommended for Production)

If you want professional tokens:

1. **Start fresh validator:**
   ```bash
   pkill -9 -f solana-test-validator
   cd /Users/renaka/gtx/openbook/openbook-v2
   solana-test-validator --reset \
     --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
     /tmp/openbook_v2_devnet.so &
   sleep 10
   ```

2. **Create tokens WITH metadata:**
   ```bash
   cd /Users/renaka/gtx/openbook/scripts-v2
   npm install  # Install Metaplex dependency
   npm run create-tokens-with-metadata
   ```

3. **Use new token addresses in market creation:**
   - Update `localDeployFixed.ts` to use the new mint addresses
   - Or modify it to call `createTokenWithMetadata()` instead of `createMint()`

---

## 🔧 Integrating Metadata into localDeployFixed.ts

To update your deployment script to create tokens with metadata:

1. **Import Metaplex:**
   ```typescript
   import {
     createCreateMetadataAccountV3Instruction,
     PROGRAM_ID as METADATA_PROGRAM_ID,
   } from "@metaplex-foundation/mpl-token-metadata";
   ```

2. **Replace `createMint()` calls:**
   ```typescript
   // Old (no metadata)
   const btcMint = await mintUtils.createMint(8);

   // New (with metadata)
   const btcResult = await createTokenWithMetadata(
     connection,
     authority,
     "Bitcoin",
     "BTC",
     "https://...", // Logo URL
     8
   );
   const btcMint = btcResult.mint;
   ```

---

## 📚 Resources

- **Metaplex Docs**: https://docs.metaplex.com/programs/token-metadata/
- **SPL Token**: https://spl.solana.com/token
- **Token List Standard**: https://github.com/solana-labs/token-list

---

## ✅ Summary

| Feature | Current Setup | With Metadata |
|---------|--------------|---------------|
| **Mint Address** | ✅ Yes | ✅ Yes |
| **Decimals** | ✅ Yes (8, 6, 9) | ✅ Yes |
| **Name** | ❌ No | ✅ Yes ("Bitcoin") |
| **Symbol** | ❌ No | ✅ Yes ("BTC") |
| **Logo** | ❌ No | ✅ Yes (URL) |
| **Wallet Display** | Address only | "Bitcoin (BTC)" + logo |
| **Explorer Display** | Basic info | Full token info |
| **Professional** | Testing only | Production ready |

**Bottom Line:** Your current tokens work fine for local testing, but adding metadata makes them look professional and function properly in wallets and explorers.

---

*Need help implementing this? Just ask!*
