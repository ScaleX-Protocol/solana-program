# Using Metaplex on Local Validator - Quick Guide

## 🎯 The Key Concept

**On Solana, programs are deployed once and shared by everyone.**

- **Devnet/Mainnet**: Metaplex is already deployed at `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`
- **Local validator**: Empty! You need to load it yourself

---

## 🚀 Quick Start (3 Steps)

### Step 1: Download Metaplex Program

```bash
# Download from devnet (one time, ~1.5MB)
solana program dump \
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so \
  --url https://api.devnet.solana.com
```

### Step 2: Start Validator with Programs

```bash
# Use the startup script
cd /Users/renaka/gtx/openbook
./start-validator-full.sh
```

**Or manually:**
```bash
solana-test-validator \
  --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
    /tmp/openbook_v2_devnet.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    /tmp/metaplex_token_metadata.so \
  &
```

### Step 3: Deploy Tokens

```bash
cd /Users/renaka/gtx/openbook/scripts-v2
npm run deploy-local-fixed
```

---

## 📊 What Programs Are Loaded?

```
Local Validator
│
├─ System Program (built-in)
│  └─ Creates accounts, transfers SOL
│
├─ SPL Token Program (built-in)
│  └─ Manages token mints and accounts
│
├─ OpenBook Program (loaded from devnet)
│  └─ DEX order book and matching
│
└─ Metaplex Metadata Program (loaded from devnet)
   └─ Token name, symbol, logo
```

---

## 🔍 How It Works

### 1. Download Program Binary

```bash
solana program dump <program-id> <output-file> --url <network>
```

**What this does:**
- Connects to devnet/mainnet
- Downloads the compiled program (`.so` file)
- Saves it locally

**EVM Comparison:**
```javascript
// Like downloading bytecode from Etherscan
const bytecode = await provider.getCode(contractAddress);
fs.writeFileSync('contract.bin', bytecode);
```

---

### 2. Load Program into Validator

```bash
solana-test-validator --bpf-program <program-id> <program-file>
```

**What this does:**
- Starts local validator
- Creates account at `<program-id>`
- Loads `<program-file>` as executable
- Sets account as executable program

**EVM Comparison:**
```javascript
// Like forking mainnet with specific contracts
hardhat.fork({
  url: "https://mainnet.infura.io",
  contracts: {
    "0x123...": bytecode  // Load specific contract
  }
});
```

---

### 3. Use Program

```typescript
// Your code calls the program
const instruction = createCreateMetadataAccountV3Instruction({
  // ... data
});

// Solana runtime routes to the loaded program
// Program executes and creates metadata account
```

---

## 💡 Key Differences from EVM

| Aspect | EVM | Solana |
|--------|-----|--------|
| **Programs** | Deploy per-network | Deploy once, share forever |
| **Local dev** | Deploy all contracts | Load programs from devnet |
| **Storage** | Contract storage | Separate accounts |
| **Upgrades** | Proxy patterns | Built-in (if upgrade authority set) |

---

## 🎯 Programs Needed for Token with Metadata

```
┌─────────────────────────────────────────────────────┐
│                  Your Local Validator                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Built-in Programs (always present):                │
│  ├─ System Program                                  │
│  └─ SPL Token Program                               │
│                                                      │
│  Loaded Programs (you add):                         │
│  ├─ OpenBook Program      (for DEX)                 │
│  └─ Metaplex Program      (for metadata)            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Error: "Program account not found"

**Problem:** Metaplex not loaded

**Solution:**
```bash
# Check if file exists
ls -lh /tmp/metaplex_token_metadata.so

# If not, download it
solana program dump \
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so \
  --url https://api.devnet.solana.com
```

### Error: "Invalid program id"

**Problem:** Wrong program ID or validator not running

**Solution:**
```bash
# Verify validator is running
solana cluster-version

# Verify program is loaded
solana account metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
```

### Metadata Not Showing in Wallet

**Problem:** Wallet not reading local validator

**Solution:**
- Most wallets (Phantom, Solflare) don't support custom RPC for localhost
- For testing, use Solana Explorer: `solana account <metadata-pda>`
- Or build custom UI that reads from localhost:8899

---

## 📋 Complete Workflow

```bash
# 1. Download programs (one time)
solana program dump opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
  /tmp/openbook_v2_devnet.so --url https://api.devnet.solana.com

solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so --url https://api.devnet.solana.com

# 2. Start validator with programs
./start-validator-full.sh

# 3. Deploy tokens
cd scripts-v2
npm run deploy-local-fixed

# 4. Verify
npm run view-markets
```

---

## ✅ Summary

**To use Metaplex locally:**

1. ✅ Download Metaplex program from devnet
2. ✅ Load it when starting validator (`--bpf-program`)
3. ✅ Use it like normal (it's now available at the program ID)

**Think of it as:**
- Devnet = npm registry
- Local validator = Your project
- `solana program dump` = `npm install`
- `--bpf-program` = Importing the package

**Now you can:**
- Create tokens with metadata
- Test locally without deploying to devnet
- Develop faster with instant confirmations

---

*Your local validator is now a full-featured Solana development environment!* 🎉
