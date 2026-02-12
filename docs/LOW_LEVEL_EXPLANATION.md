# Low-Level Explanation - Which Programs Are Actually Used

## 🎯 For EVM Developers Who Want to Understand the Details

This document explains **exactly** which programs are used and what they do, with minimal abstractions.

---

## 📍 Three Programs Are Used

### 1️⃣ **System Program** (Built-in)

```
Program ID: 11111111111111111111111111111111
Purpose:    Creates accounts, transfers SOL
Like EVM:   Built-in, similar to CREATE opcode
```

**What it does:**
- Allocates storage space on-chain
- Transfers SOL to pay for rent
- Assigns account ownership to other programs

**EVM Comparison:**
```solidity
// In EVM, you do this:
new MyContract();  // Creates contract at new address

// In Solana, System Program does:
SystemProgram.createAccount({
  space: 82,           // How much storage
  lamports: rentCost,  // Payment for storage
  programId: owner     // Who owns this account
});
```

---

### 2️⃣ **SPL Token Program** (Token Standard)

```
Program ID: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
Purpose:    Manages all SPL tokens (mints, accounts, transfers)
Like EVM:   Like ERC20 standard, but shared by ALL tokens
```

**What it does:**
- Initializes token mints (creates new tokens)
- Creates token accounts (like ERC20 balances)
- Handles transfers, approvals, etc.

**EVM Comparison:**
```solidity
// In EVM, each token is a separate contract:
contract TokenA is ERC20 { ... }  // One contract
contract TokenB is ERC20 { ... }  // Another contract

// In Solana, ONE program handles ALL tokens:
SPL_TOKEN_PROGRAM {
  // Handles TokenA
  // Handles TokenB
  // Handles ALL tokens (shared logic)
}
```

**Why this is better:**
- Deploy once, use forever (no gas to deploy token contracts)
- All tokens behave consistently
- Cheaper to create new tokens

---

### 3️⃣ **Metaplex Token Metadata Program** (Metadata Standard)

```
Program ID: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
Purpose:    Adds name, symbol, logo to tokens
Like EVM:   Like adding name() and symbol() to ERC20
```

**What it does:**
- Creates metadata accounts (name, symbol, uri)
- Links metadata to token mints via PDA
- Allows updating metadata

**EVM Comparison:**
```solidity
// In EVM, metadata is in the token contract:
contract Token is ERC20 {
    string public name = "Bitcoin";
    string public symbol = "BTC";
}

// In Solana, metadata is in a SEPARATE account:
MetadataAccount {
    name: "Bitcoin",
    symbol: "BTC",
    uri: "https://logo.png"
}
// Linked to mint via PDA (deterministic address)
```

---

## 🔄 Transaction Flow (Low-Level)

### Creating a Token WITH Metadata

```
┌─────────────────────────────────────────────────────────────┐
│ Transaction 1: Create Mint                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Instruction 1: System Program                              │
│  ├─ Action: Create Account                                  │
│  ├─ Size: 82 bytes                                          │
│  ├─ Owner: SPL Token Program                                │
│  └─ Result: Empty account created                           │
│                                                              │
│  Instruction 2: SPL Token Program                           │
│  ├─ Action: Initialize Mint                                 │
│  ├─ Data: decimals = 8                                      │
│  └─ Result: Mint account initialized                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Transaction 2: Create Metadata                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Instruction 1: Metaplex Metadata Program                   │
│  ├─ Action: Create Metadata Account V3                      │
│  ├─ Derives: PDA from ["metadata", PROGRAM_ID, mint]        │
│  ├─ Data: name="Bitcoin", symbol="BTC", uri="https://..."   │
│  └─ Result: Metadata account created and linked             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Account Structure (What Gets Created)

### Mint Account (Created by SPL Token Program)

```
Account Address: EgYUYr2ceQmF7hNxfZ3TwJGjGwv4SR7PG16dL2eFVfp7
Owner: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (SPL Token Program)
Size: 82 bytes

Data Layout:
  Bytes 0-3:    mintAuthorityOption (0 = None, 1 = Some)
  Bytes 4-35:   mintAuthority (PublicKey, 32 bytes)
  Bytes 36-43:  supply (u64, 8 bytes)
  Bytes 44:     decimals (u8, 1 byte)
  Bytes 45:     isInitialized (bool, 1 byte)
  Bytes 46-49:  freezeAuthorityOption
  Bytes 50-81:  freezeAuthority (PublicKey, 32 bytes)
```

**EVM Comparison:**
```solidity
contract Token {
    address public mintAuthority;  // bytes 4-35
    uint256 public supply;         // bytes 36-43
    uint8 public decimals;         // byte 44
    bool public isInitialized;     // byte 45
    address public freezeAuthority; // bytes 50-81
}
```

---

### Metadata Account (Created by Metaplex Program)

```
Account Address: [PDA derived from mint]
Owner: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s (Metaplex Program)
Size: ~679 bytes

Data Layout:
  Bytes 0-31:   updateAuthority (PublicKey)
  Bytes 32-63:  mint (PublicKey, link to mint account)
  Bytes 64-95:  name (String, max 32 bytes)
  Bytes 96-105: symbol (String, max 10 bytes)
  Bytes 106-305: uri (String, max 200 bytes)
  Bytes 306-307: sellerFeeBasisPoints (u16)
  ... (more fields for NFT-specific data)
```

**EVM Comparison:**
```solidity
contract Metadata {
    address public updateAuthority;  // bytes 0-31
    address public mint;             // bytes 32-63 (link to token)
    string public name;              // bytes 64-95
    string public symbol;            // bytes 96-105
    string public uri;               // bytes 106-305
}
```

---

## 💻 Low-Level Code Breakdown

### Step 1: Create Mint Account

```typescript
// ====================================
// PROGRAM: System Program
// ACTION: Create Account
// ====================================
const instruction1 = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,           // Who pays
  newAccountPubkey: mintKeypair.publicKey, // New mint address
  space: 82,                             // 82 bytes for mint data
  lamports: rentAmount,                  // Rent payment (~0.002 SOL)
  programId: SPL_TOKEN_PROGRAM_ID,       // Owner: SPL Token Program
});

// ====================================
// PROGRAM: SPL Token Program
// ACTION: Initialize Mint
// ====================================
const instruction2 = {
  keys: [
    { pubkey: mint, isSigner: false, isWritable: true },     // The mint
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent info
  ],
  programId: SPL_TOKEN_PROGRAM_ID,
  data: Buffer.from([
    0,        // Instruction: 0 = InitializeMint
    8,        // Decimals
    ...payer.publicKey.toBytes(),  // Mint authority (32 bytes)
    1,        // Has freeze authority
    ...payer.publicKey.toBytes(),  // Freeze authority (32 bytes)
  ]),
};

// Send both instructions in one transaction
await sendAndConfirmTransaction(connection, [instruction1, instruction2], [payer, mintKeypair]);
```

**EVM Comparison:**
```solidity
// In EVM, deploying a token:
Token token = new Token{value: 0}();
token.initialize(decimals: 8, authority: msg.sender);

// Creates contract at new address with constructor
```

---

### Step 2: Create Metadata Account

```typescript
// ====================================
// DERIVE PDA (like CREATE2 in EVM)
// ====================================
const [metadataPDA, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("metadata"),           // Seed 1
    METADATA_PROGRAM_ID.toBuffer(),    // Seed 2
    mint.toBuffer(),                   // Seed 3: mint address
  ],
  METADATA_PROGRAM_ID
);
// Result: Deterministic address linked to mint

// ====================================
// PROGRAM: Metaplex Token Metadata Program
// ACTION: Create Metadata Account V3
// ====================================
const instruction = {
  keys: [
    { pubkey: metadataPDA, isSigner: false, isWritable: true },      // Metadata account
    { pubkey: mint, isSigner: false, isWritable: false },            // Mint
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },  // Mint authority
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },   // Payer
    { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // Update authority
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false }, // System Program
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent
  ],
  programId: METADATA_PROGRAM_ID,
  data: Buffer.from([
    33,       // Instruction: 33 = CreateMetadataAccountV3
    // ... name, symbol, uri data (serialized)
  ]),
};

await sendAndConfirmTransaction(connection, [instruction], [payer]);
```

**EVM Comparison:**
```solidity
// In EVM, like deploying metadata contract at CREATE2 address:
address metadataAddr = address(uint160(uint256(
  keccak256(abi.encodePacked(
    bytes1(0xff),
    address(this),
    keccak256(abi.encodePacked("metadata", address(token))),
    keccak256(type(Metadata).creationCode)
  ))
)));

Metadata metadata = new Metadata{salt: ...}("Bitcoin", "BTC");
```

---

## 🔍 PDA Derivation (Program Derived Address)

### What is a PDA?

**PDA = Deterministic address that NO ONE has the private key for**

Like EVM's CREATE2, but the address is "owned" by a program instead of being a contract.

### How it works:

```typescript
// Input: Seeds + Program ID
const [pda, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("metadata"),           // Seed 1: constant string
    METADATA_PROGRAM_ID.toBuffer(),    // Seed 2: program ID
    mint.toBuffer(),                   // Seed 3: mint address
  ],
  METADATA_PROGRAM_ID                  // Program that owns this PDA
);

// Output: Deterministic address
// - Same inputs = same address (always!)
// - No one has private key (safe for program to control)
// - Given a mint, ANYONE can derive its metadata address
```

**EVM Comparison:**
```solidity
// CREATE2: Deterministic contract address
address predicted = address(uint160(uint256(
  keccak256(abi.encodePacked(
    bytes1(0xff),
    factory,
    salt,
    keccak256(bytecode)
  ))
)));
```

**Key Difference:**
- EVM CREATE2: Deploys a contract at that address
- Solana PDA: Creates a data account at that address (owned by program)

---

## 📊 Cost Breakdown

### Transaction 1: Create Mint

| Operation | Program | Cost |
|-----------|---------|------|
| Create account (82 bytes) | System Program | ~0.00144 SOL (rent) |
| Initialize mint | SPL Token | ~0.000005 SOL (compute) |
| **Total** | | **~0.00145 SOL** (~$0.29) |

### Transaction 2: Create Metadata

| Operation | Program | Cost |
|-----------|---------|------|
| Create metadata account (~679 bytes) | Metaplex | ~0.00568 SOL (rent) |
| Write metadata | Metaplex | ~0.000010 SOL (compute) |
| **Total** | | **~0.00569 SOL** (~$1.14) |

### **Grand Total: ~0.00714 SOL (~$1.43)**

**EVM Comparison:**
- Ethereum: Deploy ERC20 ≈ 2M gas ≈ 0.05 ETH ≈ **$150**
- Solana: Create token with metadata ≈ **$1.43**
- **Solana is 100x cheaper!**

---

## 🎯 Summary

### Three Programs:

1. **System Program** - Creates accounts (like EVM's CREATE)
2. **SPL Token Program** - Manages tokens (like shared ERC20)
3. **Metaplex Metadata Program** - Adds name/symbol/logo

### Two Transactions:

1. **Transaction 1** - Creates mint account (82 bytes)
   - System Program: Allocate space
   - SPL Token Program: Initialize mint data

2. **Transaction 2** - Creates metadata account (~679 bytes)
   - Metaplex Program: Create PDA and store name/symbol/uri

### Result:

```
Mint Account (SPL Token Program)
  ├─ decimals: 8
  ├─ supply: 0
  └─ authorities: wallet

Metadata Account (Metaplex Program)
  ├─ name: "Bitcoin"
  ├─ symbol: "BTC"
  └─ uri: "https://logo.png"
```

---

## 🚀 Run the Low-Level Script

```bash
# Install dependencies (if not done)
cd /Users/renaka/gtx/openbook/scripts-v2
npm install

# Run low-level script (shows exactly which programs are used)
npm run create-token-low-level
```

This will show you step-by-step which programs are called and what they do!

---

*This is the REAL low-level explanation. No abstractions, just pure Solana instructions!*
