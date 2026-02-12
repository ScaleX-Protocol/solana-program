# Which Programs Are Actually Used - Simple Version

## 🎯 Three Programs, Two Transactions

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR WALLET (Payer)                       │
│                 HDsWR5v5RrNcxc2wnP4...                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Sends 2 Transactions
                           │
        ┌──────────────────┴──────────────────┐
        │                                      │
        ▼                                      ▼
┌─────────────────┐                  ┌─────────────────┐
│ Transaction 1   │                  │ Transaction 2   │
│ Create Mint     │                  │ Create Metadata │
└────────┬────────┘                  └────────┬────────┘
         │                                     │
         │ Calls                               │ Calls
         │                                     │
         ▼                                     ▼
┌─────────────────┐                  ┌─────────────────┐
│ 1️⃣ System      │                  │ 3️⃣ Metaplex    │
│    Program      │                  │    Metadata     │
│                 │                  │    Program      │
│ Creates account │                  │                 │
│ (allocates 82B) │                  │ Creates PDA     │
└────────┬────────┘                  │ Stores name/    │
         │                           │ symbol/uri      │
         │ Then calls                └─────────────────┘
         │
         ▼
┌─────────────────┐
│ 2️⃣ SPL Token   │
│    Program      │
│                 │
│ Initializes     │
│ mint data       │
│ (sets decimals) │
└────────┬────────┘
         │
         │ Results in
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ACCOUNTS CREATED                           │
├──────────────────────────────┬───────────────────────────────┤
│ Mint Account                 │ Metadata Account              │
│ EgYUYr2...Vfp7              │ [PDA-derived]                 │
├──────────────────────────────┼───────────────────────────────┤
│ Owner: SPL Token Program     │ Owner: Metaplex Program       │
│ Size: 82 bytes               │ Size: ~679 bytes              │
│                              │                               │
│ Data:                        │ Data:                         │
│  - decimals: 8               │  - name: "Bitcoin"            │
│  - supply: 0                 │  - symbol: "BTC"              │
│  - mintAuthority: wallet     │  - uri: "https://..."         │
│  - freezeAuthority: wallet   │  - mint: EgYUYr2...Vfp7       │
└──────────────────────────────┴───────────────────────────────┘
```

---

## 📋 Program Directory

### 1️⃣ System Program (Built-in)

```
Name:       System Program
Address:    11111111111111111111111111111111
Purpose:    Create accounts, transfer SOL
When used:  Transaction 1 (creates the mint account)
Like EVM:   Built-in CREATE opcode
```

**What it does:**
- Allocates storage space (82 bytes for mint)
- Pays rent (~0.00144 SOL)
- Sets owner to SPL Token Program

---

### 2️⃣ SPL Token Program (Token Standard)

```
Name:       SPL Token Program
Address:    TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
Purpose:    Initialize and manage all SPL tokens
When used:  Transaction 1 (initializes the mint)
Like EVM:   Shared ERC20 implementation (factory pattern)
```

**What it does:**
- Sets decimals (8 for BTC)
- Sets mint authority (your wallet)
- Sets freeze authority (your wallet)
- Initializes supply to 0

---

### 3️⃣ Metaplex Token Metadata Program (Metadata Standard)

```
Name:       Metaplex Token Metadata Program
Address:    metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
Purpose:    Add name, symbol, and logo to tokens
When used:  Transaction 2 (creates metadata)
Like EVM:   Token metadata extension (adds name/symbol like ERC20)
```

**What it does:**
- Derives PDA (deterministic address from mint)
- Creates metadata account
- Stores name ("Bitcoin")
- Stores symbol ("BTC")
- Stores URI ("https://logo.png")
- Links to mint account

---

## 🔄 Flow Diagram

```
User Action: Create token with metadata
│
├─► Transaction 1: Create Mint
│   │
│   ├─► Instruction 1: System Program
│   │   └─► createAccount(size: 82, owner: SPL Token Program)
│   │       └─► Result: Empty 82-byte account created
│   │
│   └─► Instruction 2: SPL Token Program
│       └─► initializeMint(decimals: 8, authority: wallet)
│           └─► Result: Mint account initialized
│
└─► Transaction 2: Create Metadata
    │
    └─► Instruction 1: Metaplex Metadata Program
        └─► createMetadataAccountV3(name, symbol, uri)
            ├─► Derives PDA from mint
            └─► Result: Metadata account created and linked
```

---

## 📊 Simple Comparison: High-Level vs Low-Level

### High-Level Code (What We Enhanced)

```typescript
// One function call (abstraction hides the details)
const mint = await mintUtils.createMintWithMetadata(
  { name: "Bitcoin", symbol: "BTC", uri: "https://..." },
  8
);
```

**Behind the scenes:**
- Calls System Program
- Calls SPL Token Program
- Calls Metaplex Program
- Creates 2 accounts
- Sends 2 transactions

---

### Low-Level Code (What Actually Happens)

```typescript
// Transaction 1: Create Mint
const tx1 = new Transaction().add(
  // Instruction 1: System Program - Create Account
  SystemProgram.createAccount({
    programId: SPL_TOKEN_PROGRAM_ID,
    space: 82,
  }),
  // Instruction 2: SPL Token - Initialize Mint
  createInitializeMintInstruction(decimals: 8)
);
await sendAndConfirmTransaction(connection, tx1, [payer, mint]);

// Transaction 2: Create Metadata
const tx2 = new Transaction().add(
  // Instruction 1: Metaplex - Create Metadata
  createCreateMetadataAccountV3Instruction({
    name: "Bitcoin",
    symbol: "BTC",
    uri: "https://...",
  })
);
await sendAndConfirmTransaction(connection, tx2, [payer]);
```

---

## 🎯 EVM Comparison

### EVM (One Program Per Token)

```solidity
// Deploy new contract (2M gas)
contract MyToken is ERC20 {
    constructor() ERC20("Bitcoin", "BTC") {
        _decimals = 8;
    }
}
```

**Result:**
- One contract deployed
- Contains ALL logic (transfer, approve, etc.)
- Contains metadata (name, symbol)
- Expensive (~$150)

---

### Solana (Shared Programs)

```typescript
// Use existing programs (0.007 SOL)
const mint = await createMintWithMetadata(...);
```

**Result:**
- Two accounts created (mint + metadata)
- Programs already deployed (SPL Token, Metaplex)
- Just data storage (no code deployment)
- Cheap (~$1.43)

---

## 💰 Cost Breakdown (Simple)

| Step | Program | Cost |
|------|---------|------|
| Create mint account | System Program | $0.29 |
| Initialize mint | SPL Token Program | $0.00001 |
| Create metadata | Metaplex Program | $1.14 |
| **Total** | | **$1.43** |

**vs EVM: $150 (100x more expensive!)**

---

## ✅ Quick Summary

**Three programs are used:**

1. **System Program** - Creates the mint account (like malloc in C)
2. **SPL Token Program** - Initializes token data (like ERC20 factory)
3. **Metaplex Program** - Adds name/symbol/logo (like metadata extension)

**Two accounts are created:**

1. **Mint Account** (82 bytes) - Stores decimals, supply, authorities
2. **Metadata Account** (~679 bytes) - Stores name, symbol, uri

**Two transactions are sent:**

1. **Transaction 1** - Create + initialize mint
2. **Transaction 2** - Create + store metadata

**Total cost: ~$1.43**

---

## 🚀 See It In Action

```bash
cd /Users/renaka/gtx/openbook/scripts-v2
npm run create-token-low-level
```

This will show you:
- Which program is called at each step
- What data is being stored
- How PDAs are derived
- Transaction signatures
- Account addresses

---

*Now you understand EXACTLY which programs are used and why!* 🎓
