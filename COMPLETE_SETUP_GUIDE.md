# OpenBook V2 Local Setup - Complete Guide

**Everything you need to run OpenBook V2 locally with token metadata support.**

---

## 📋 Table of Contents

1. [Choose Your Path](#choose-your-path)
2. [Quick Start (Using OpenBook)](#quick-start-using-openbook)
3. [Development Path (Modifying OpenBook)](#development-path-modifying-openbook)
4. [Understanding the Architecture](#understanding-the-architecture)
5. [Programs Used](#programs-used)
6. [Creating Tokens with Metadata](#creating-tokens-with-metadata)
7. [Available Scripts](#available-scripts)
8. [Troubleshooting](#troubleshooting)
9. [For EVM Developers](#for-evm-developers)

---

## 🚀 Quick Start

### Prerequisites

Ensure these are installed:
```bash
node --version      # v20.11.0+
solana --version    # v1.18.23+
rustc --version     # v1.75.0+
anchor --version    # v0.29.0+
```

### Step 1: Build OpenBook from Source

```bash
cd /Users/renaka/gtx/openbook/openbook-v2

# IMPORTANT: First time setup - Fix Program ID Mismatch
# Get the program ID from the generated keypair
GENERATED_PROGRAM_ID=$(solana address -k target/deploy/openbook_v2-keypair.json)
echo "Your Program ID: $GENERATED_PROGRAM_ID"

# Update the declare_id in the source code to match your keypair
# Edit programs/openbook-v2/src/lib.rs and replace the declare_id line:
# FROM: declare_id!("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
# TO:   declare_id!("YOUR_GENERATED_PROGRAM_ID");

# Update Anchor.toml to match
# Edit Anchor.toml and update [programs.localnet]:
# FROM: openbook_v2 = "opnbkNkqux64GppQhwbyEVc3axhssFhVYuwar8rDHCu"
# TO:   openbook_v2 = "YOUR_GENERATED_PROGRAM_ID"

# Build OpenBook (first time takes 10-15 minutes)
anchor build

# Output: target/deploy/openbook_v2.so
```

**⚠️ CRITICAL: Program ID Mismatch Fix**

When compiling locally, Anchor generates a random keypair, but the source code has the original developer's program ID hardcoded. You MUST update both:

1. **programs/openbook-v2/src/lib.rs** (line 8): Update `declare_id!()` macro
2. **Anchor.toml** (line 5): Update `openbook_v2` program ID

If these don't match your keypair, you'll get **Error 4100: DeclaredProgramIdMismatch**.

This compiles your own version of OpenBook that you can modify and customize.

### Step 2: Download Metaplex (Token Metadata Program)

```bash
# Download Metaplex (we don't need to modify this)
solana program dump \
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so \
  --url https://api.devnet.solana.com
```

**Why download Metaplex?**
- ✅ Only needed for token metadata (name, symbol, logo)
- ✅ No need to modify it
- ✅ Faster than compiling

### Step 3: Get Your OpenBook Program ID

```bash
# Get the program ID from your compiled version
cd /Users/renaka/gtx/openbook/openbook-v2
solana address -k target/deploy/openbook_v2-keypair.json

# Example output: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

**Save this program ID** - you'll need it for your scripts!

### Step 4: Start Validator

```bash
export PATH="$HOME/.local/share/solana/install/solana-release/bin:$PATH"

# Kill existing validator
pkill -9 -f solana-test-validator

# Get your OpenBook program ID
cd /Users/renaka/gtx/openbook/openbook-v2
OPENBOOK_PROGRAM_ID=$(solana address -k target/deploy/openbook_v2-keypair.json)

# Start validator with YOUR compiled OpenBook + downloaded Metaplex
solana-test-validator \
  --reset \
  --bpf-program $OPENBOOK_PROGRAM_ID \
    target/deploy/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    /tmp/metaplex_token_metadata.so \
  --quiet &

sleep 10
solana config set --url http://localhost:8899
solana airdrop 100

echo "✅ Validator running!"
echo "Your OpenBook Program ID: $OPENBOOK_PROGRAM_ID"
```

### Step 5: Update Your Scripts

Update `scripts-v2/localDeployFixed.ts` with your OpenBook program ID:

```typescript
// Find this line (around line 14):
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

// Replace with YOUR program ID from Step 3:
const PROGRAM_ID = new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
//                                ↑ Use your actual program ID
```

### Step 6: Deploy Markets with Tokens

```bash
cd /Users/renaka/gtx/openbook/scripts-v2
npm install  # First time only
npm run deploy-local-fixed
```

**Expected output:**
```
🚀 Local OpenBook V2 Deployment

📦 Creating Tokens with Metadata...
✅ BTC (8 decimals): [address]
✅ USDT (6 decimals): [address]
✅ WETH (9 decimals): [address]

🏪 Creating Markets...
✅ BTC/USDT created!
✅ WETH/USDT created!

✅ Tokens created with metadata:
   - Names: Bitcoin, Tether USD, Wrapped Ethereum
   - Symbols: BTC, USDT, WETH
   - Logos: ✅ Included
```

### Step 7: View Your Markets

```bash
npm run view-markets
```

**Done! You now have a local DEX with YOUR compiled OpenBook!** 🎉

---

## 🔄 Development Workflow

Now that you're set up, here's how to modify OpenBook:

### Making Changes

```bash
# 1. Edit OpenBook code
cd /Users/renaka/gtx/openbook/openbook-v2
vim programs/openbook-v2/src/lib.rs

# 2. Rebuild
anchor build

# 3. Test your changes
anchor test

# 4. Restart validator with new binary
pkill -9 -f solana-test-validator
# Then run Step 4 again to start validator
```

### Example Modifications

**Change fee structure:**
```rust
// openbook-v2/programs/openbook-v2/src/state/market.rs
pub struct Market {
    pub maker_fee: i64,  // Modify this
    pub taker_fee: i64,  // Or this
    // ...
}
```

**Add custom validation:**
```rust
// openbook-v2/programs/openbook-v2/src/instructions/place_order.rs
pub fn place_order(ctx: Context<PlaceOrder>, args: PlaceOrderArgs) -> Result<()> {
    // Add your custom logic
    require!(args.price > min_price, ErrorCode::PriceTooLow);
    // ...
}
```

After changes:
```bash
anchor build
anchor test
```

---

## 🏗️ Understanding the Architecture

### Solana vs EVM

**EVM (Ethereum):**
```solidity
// One contract per token
contract BTC is ERC20 {
    string public name = "Bitcoin";
    string public symbol = "BTC";
    uint8 public decimals = 8;
    // All logic in one contract
}
```

**Solana:**
```
Token = Multiple Accounts + Shared Programs

Mint Account (82 bytes)           Metadata Account (679 bytes)
├─ decimals: 8           ←───────── name: "Bitcoin"
├─ supply: 0                       ├─ symbol: "BTC"
└─ authorities                     └─ uri: "https://logo.png"

         ↓                                  ↓
   SPL Token Program              Metaplex Program
   (Shared by ALL tokens)         (Shared metadata)
```

**Key Differences:**

| Aspect | EVM | Solana |
|--------|-----|--------|
| **Programs** | One contract per token | Shared programs |
| **Metadata** | In contract storage | Separate account |
| **Cost** | ~$150 to deploy | ~$2 to create |
| **Local dev** | Deploy contracts | Load programs from devnet |

---

## 📍 Programs Used

Your local validator runs **4 programs**:

### 1. System Program (Built-in)
```
Address: 11111111111111111111111111111111
Purpose: Create accounts, transfer SOL
Status:  ✅ Always present
```

### 2. SPL Token Program (Built-in)
```
Address: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
Purpose: Manage all SPL tokens
Status:  ✅ Always present
```

### 3. OpenBook Program (Compiled)
```
Address: YOUR-PROGRAM-ID (from anchor build)
Purpose: DEX order book and matching
Status:  🔨 Compiled from source
```

### 4. Metaplex Token Metadata Program (Downloaded)
```
Address: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
Purpose: Token name, symbol, logo
Status:  ⬇️ Downloaded from devnet
```

---

### Why This Approach?

**OpenBook: Compiled from source**
- ✅ Full control - modify any code
- ✅ Add custom features
- ✅ Change fees, validation, logic
- ✅ Your own program ID

**Metaplex: Downloaded from devnet**
- ✅ No need to modify
- ✅ Only used for token metadata
- ✅ Fast - no compilation
- ✅ Production-tested

**Think of it as:**
- OpenBook = Your application (you're building and can modify it)
- Metaplex = External library (using as-is for token metadata)

---

## 🪙 Creating Tokens with Metadata

### What Changed (Before vs After)

**BEFORE (No Metadata):**
```typescript
// Old code
const btcMint = await mintUtils.createMint(8);
// Result: Token with NO name, NO symbol
```

**AFTER (With Metadata):**
```typescript
// New code
const btcMint = await mintUtils.createMintWithMetadata(
  {
    name: "Bitcoin",
    symbol: "BTC",
    uri: "https://raw.githubusercontent.com/.../logo.png"
  },
  8
);
// Result: Token with name, symbol, and logo!
```

### How It Works

Two transactions are sent:

**Transaction 1: Create Mint**
```
Instruction 1: System Program
  └─ Create account (82 bytes)

Instruction 2: SPL Token Program
  └─ Initialize mint (set decimals, authorities)
```

**Transaction 2: Create Metadata**
```
Instruction 1: Metaplex Program
  └─ Create metadata PDA
  └─ Store name, symbol, uri
```

**Result:**
```
Mint Account                    Metadata Account (PDA)
├─ decimals: 8         ←────────── name: "Bitcoin"
├─ supply: 0                       ├─ symbol: "BTC"
└─ authorities                     └─ uri: "https://..."
```

### What is a PDA?

**PDA (Program Derived Address) = Deterministic address with no private key**

```typescript
// Derive metadata address from mint
const [metadataPDA, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("metadata"),
    METADATA_PROGRAM_ID,
    mint.toBuffer()
  ],
  METADATA_PROGRAM_ID
);
```

**Like EVM's CREATE2:**
- Same inputs = same address (always!)
- Anyone can derive the metadata address from mint address
- No need to store the link anywhere

---

## 📝 Available Scripts

All in `/Users/renaka/gtx/openbook/scripts-v2/`:

### Deployment & Management

| Command | Description |
|---------|-------------|
| `npm run deploy-local-fixed` | Deploy BTC/USDT + WETH/USDT markets with metadata |
| `npm run view-markets` | View all markets with details |
| `npm run get-markets` | List markets (simple) |
| `npm run create-market` | Create custom market |
| `npm run post-order` | Place an order |

### Token Creation

| Command | Description |
|---------|-------------|
| `npm run create-tokens-with-metadata` | Create standalone tokens |
| `npm run create-token-low-level` | Low-level token creation (educational) |

### Files

```
scripts-v2/
├── localDeployFixed.ts        # Main deployment (enhanced with metadata)
├── viewMarkets.ts              # Market viewer
├── createTokenWithMetadata.ts  # Standalone token creator
├── createTokenLowLevel.ts      # Educational low-level code
├── mint_utils.ts               # Token utilities (enhanced)
└── package.json                # NPM scripts
```

---

## 🔧 Troubleshooting

### Problem: "Program account not found"

**Symptom:** Error when creating metadata

**Cause:** Metaplex program not loaded

**Solution:**
```bash
# Check if program file exists
ls -lh /tmp/metaplex_token_metadata.so

# If not, download it
solana program dump \
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so \
  --url https://api.devnet.solana.com

# Restart validator with the program
./start-validator-full.sh
```

### Problem: Connection refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:8899`

**Cause:** Validator not running

**Solution:**
```bash
# Check if validator is running
ps aux | grep solana-test-validator

# If not running, start it
./start-validator-full.sh
```

### Problem: "Insufficient funds"

**Symptom:** Transaction fails with insufficient funds

**Solution:**
```bash
solana config set --url http://localhost:8899
solana airdrop 100
solana balance
```

### Problem: Error 4100 - DeclaredProgramIdMismatch

**Symptom:** `AnchorError occurred. Error Code: DeclaredProgramIdMismatch. Error Number: 4100. Error Message: The declared program id does not match the actual program id.`

**Cause:** The program ID in your source code doesn't match your keypair

**Solution:**
```bash
# 1. Get your generated program ID
cd /Users/renaka/gtx/openbook/openbook-v2
PROGRAM_ID=$(solana address -k target/deploy/openbook_v2-keypair.json)
echo "Your Program ID: $PROGRAM_ID"

# 2. Update programs/openbook-v2/src/lib.rs
# Change: declare_id!("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
# To:     declare_id!("YOUR_PROGRAM_ID");

# 3. Update Anchor.toml [programs.localnet] section
# Change: openbook_v2 = "opnbkNkqux64GppQhwbyEVc3axhssFhVYuwar8rDHCu"
# To:     openbook_v2 = "YOUR_PROGRAM_ID"

# 4. Rebuild
anchor build

# 5. Restart validator
pkill -9 -f solana-test-validator
solana-test-validator --reset \
  --bpf-program $PROGRAM_ID target/deploy/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so \
  --quiet &
```

### Problem: "ProgramFailedToComplete" or "Access violation"

**Symptom:** `Program failed to complete`, `Access violation in unknown section`, or during build: `Stack offset exceeded max offset`

**Cause:** BPF stack overflow - functions exceed 4096-byte stack limit. This happens with newer Rust versions (1.80+) due to code generation changes.

**Root Cause:**
- Rust 1.88.0 generates code with larger stack frames
- OpenBook has complex functions that exceed BPF's 4096-byte stack limit
- Compilation errors show: `Stack offset of 4608 exceeded max offset of 4096`

**Solutions:**

**Option 1: Use Pre-Built OpenBook (Recommended for non-dev use)**
```bash
# Download official OpenBook instead of compiling
solana program dump \
  opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
  /tmp/openbook_v2.so \
  --url https://api.devnet.solana.com

# Use with official program ID
PROGRAM_ID=opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb
```

**Option 2: Downgrade Rust (For local compilation)**
```bash
# Install Rust 1.75.0 (known to work with OpenBook)
rustup install 1.75.0
rustup default 1.75.0
rustc --version  # Should show 1.75.0

# Rebuild
cd /Users/renaka/gtx/openbook/openbook-v2
cargo clean
anchor build
```

**Option 3: Use solana-bpf-tools (Alternative toolchain)**
```bash
# Install BPF SDK
sh -c "$(curl -sSfL https://release.solana.com/v1.17.28/install)"
cargo install --git https://github.com/solana-labs/cargo-build-sbf --tag v1.17.28 cargo-build-sbf

# Build with BPF tools instead of cargo
cargo-build-sbf
```

### Problem: TypeScript errors

**Symptom:** Module not found errors

**Solution:**
```bash
cd /Users/renaka/gtx/openbook/scripts-v2
rm -rf node_modules package-lock.json
npm install
```

### Problem: Markets not found after restart

**Cause:** Validator was reset (--reset flag)

**Solution:** Redeploy markets
```bash
npm run deploy-local-fixed
```

---

## 💡 For EVM Developers

### Key Concepts Mapped

| Solana | EVM Equivalent |
|--------|----------------|
| **Program** | Smart contract (but shared) |
| **Account** | Storage slot or struct |
| **PDA** | CREATE2 deterministic address |
| **Instruction** | Function call |
| **Transaction** | Transaction (can have multiple instructions) |
| **Rent** | Gas for storage (paid once) |
| **Signer** | msg.sender or authorized account |

### Architecture Comparison

**EVM: Each token = One contract**
```
TokenA Contract (0x123...)
├─ name()
├─ symbol()
├─ transfer()
├─ balanceOf()
└─ ...

TokenB Contract (0x456...)
├─ name()
├─ symbol()
├─ transfer()
├─ balanceOf()
└─ ...
```

**Solana: All tokens share programs**
```
SPL Token Program
├─ Handles TokenA mint
├─ Handles TokenB mint
└─ Handles ALL tokens

Metaplex Program
├─ Metadata for TokenA
├─ Metadata for TokenB
└─ Metadata for ALL tokens
```

### Cost Comparison

| Operation | EVM (Ethereum) | Solana |
|-----------|----------------|--------|
| Deploy ERC20 | ~2M gas (~$150) | N/A (use shared program) |
| Create token | N/A | ~0.002 SOL (~$0.40) |
| Add metadata | Included | ~0.008 SOL (~$1.60) |
| **Total** | **~$150** | **~$2** |

**Solana is 75x cheaper!**

### Code Comparison

**EVM:**
```solidity
// Deploy full contract
contract Token is ERC20 {
    constructor() ERC20("Bitcoin", "BTC") {
        _decimals = 8;
    }
}
```

**Solana:**
```typescript
// Create account + metadata
const mint = await createMintWithMetadata(
  { name: "Bitcoin", symbol: "BTC", uri: "..." },
  8
);
```

---

## 📊 What You Have Now

### Deployed Infrastructure

**3 Tokens:**
- BTC (8 decimals) with name "Bitcoin"
- USDT (6 decimals) with name "Tether USD"
- WETH (9 decimals) with name "Wrapped Ethereum"

**2 Markets:**
- BTC/USDT
- WETH/USDT

**4 Programs:**
- System Program (built-in)
- SPL Token Program (built-in)
- OpenBook Program (loaded)
- Metaplex Program (loaded)

### Next Steps

1. **Place Orders**
   ```bash
   # Edit postOrder.ts with your parameters
   npm run post-order
   ```

2. **Build Trading UI**
   - Connect to http://localhost:8899
   - Use OpenBook V2 TypeScript client
   - Display order books and trades

3. **Create More Markets**
   ```bash
   # Edit createMarket.ts
   npm run create-market
   ```

4. **Develop Trading Strategies**
   - Market making bots
   - Arbitrage
   - Order matching

---

## 🎯 Summary

**What this setup gives you:**

✅ Local Solana validator with OpenBook V2
✅ Token creation with proper metadata (name, symbol, logo)
✅ Trading markets (BTC/USDT, WETH/USDT)
✅ Fast iteration (instant confirmations)
✅ Free testing (unlimited airdrops)
✅ Production-ready token infrastructure

**Key files:**
- `start-validator-full.sh` - Start everything
- `scripts-v2/localDeployFixed.ts` - Main deployment
- `scripts-v2/mint_utils.ts` - Token utilities (with metadata)
- `scripts-v2/package.json` - All available commands

**Commands to remember:**
```bash
# Start validator
./start-validator-full.sh

# Deploy markets
cd scripts-v2 && npm run deploy-local-fixed

# View markets
npm run view-markets

# Check balance
solana balance
```

---

## 📚 Documentation Files

If you need more details:

- **This file** - Complete setup guide
- `LOCAL_DEPLOYMENT_SUCCESS.md` - Previous deployment details
- `LOW_LEVEL_EXPLANATION.md` - Deep technical dive
- `EVM_TO_SOLANA_TOKENS.md` - EVM developer guide

---

**You're all set! Happy building on Solana! 🚀**

*Last updated: February 10, 2026*
