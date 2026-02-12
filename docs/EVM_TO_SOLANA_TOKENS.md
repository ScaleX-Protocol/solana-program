# Token Metadata: EVM vs Solana - Complete Explanation

## 🎯 For EVM Developers

Coming from Ethereum? Here's how Solana tokens work differently and what we changed.

---

## 📊 Core Concept Comparison

### EVM (Ethereum/BSC/Polygon)

```solidity
// ERC20 contract has metadata BUILT INTO the contract
contract MyToken is ERC20 {
    string public name = "Bitcoin";      // ← Stored in contract
    string public symbol = "BTC";        // ← Stored in contract
    uint8 public decimals = 18;          // ← Stored in contract

    mapping(address => uint256) public balanceOf;
    // ... transfer logic, etc.
}
```

**Key Points:**
- ✅ One smart contract per token
- ✅ Name, symbol, decimals are contract storage variables
- ✅ All token logic (transfer, approve, etc.) in ONE contract
- ✅ Contract address = token address

---

### Solana (Before Our Enhancement)

```typescript
// SPL Token: NO name, NO symbol, just a mint account!
const mint = await createMint(
  connection,
  payer,
  mintAuthority,    // Who can mint tokens
  freezeAuthority,  // Who can freeze accounts
  decimals,         // ← ONLY metadata stored
);
// Result: Just a mint address, no name/symbol!
```

**Key Points:**
- ❌ **No name stored**
- ❌ **No symbol stored**
- ✅ Only decimals stored
- ✅ Token program is SHARED (like a factory contract)
- ✅ Each token is just an "account" (like a struct instance)

---

## 🔍 The Problem We Solved

### In EVM
```solidity
// When you create an ERC20, metadata is automatic
MyToken token = new MyToken("Bitcoin", "BTC", 18);
// ✅ Name: token.name() returns "Bitcoin"
// ✅ Symbol: token.symbol() returns "BTC"
// ✅ Decimals: token.decimals() returns 18
```

### In Solana BEFORE
```typescript
const mint = await createMint(..., 8);  // Just decimals
// ❌ No name() function
// ❌ No symbol() function
// ✅ Only decimals stored in mint account
// Result: Wallets show: "EgYUYr2...Vfp7" (just the address!)
```

### In Solana AFTER (Our Enhancement)
```typescript
const mint = await createMintWithMetadata(
  { name: "Bitcoin", symbol: "BTC", uri: "..." },
  8
);
// ✅ Name stored in separate metadata account
// ✅ Symbol stored in separate metadata account
// ✅ Logo URL stored
// Result: Wallets show: "Bitcoin (BTC)" with logo!
```

---

## 🏗️ Architecture Comparison

### EVM Architecture

```
┌─────────────────────────────┐
│   ERC20 Token Contract      │
│  (0x123...abc)              │
├─────────────────────────────┤
│ Storage:                    │
│  - name: "Bitcoin"          │
│  - symbol: "BTC"            │
│  - decimals: 18             │
│  - totalSupply: 1000        │
│  - balances: mapping        │
│                             │
│ Functions:                  │
│  - transfer()               │
│  - approve()                │
│  - balanceOf()              │
│  - name()                   │
│  - symbol()                 │
└─────────────────────────────┘
```

**Everything in ONE contract!**

---

### Solana Architecture (BEFORE Enhancement)

```
┌─────────────────────────────┐
│   SPL Token Program         │
│   (Shared by ALL tokens)    │
│   Like a "Factory Contract" │
└─────────────────────────────┘
          │
          ├─── Creates
          ↓
┌─────────────────────────────┐
│   Token Mint Account        │
│   EgYUYr2...Vfp7           │
├─────────────────────────────┤
│ Data:                       │
│  - decimals: 8              │
│  - supply: 0                │
│  - mintAuthority: wallet    │
│  - freezeAuthority: wallet  │
│                             │
│ ❌ NO name                  │
│ ❌ NO symbol                │
│ ❌ NO logo                  │
└─────────────────────────────┘
```

**Minimal data, no metadata!**

---

### Solana Architecture (AFTER Enhancement)

```
┌─────────────────────────────┐
│   SPL Token Program         │
│   (Shared by ALL tokens)    │
└─────────────────────────────┘
          │
          ├─── Creates
          ↓
┌─────────────────────────────┐         ┌──────────────────────────────┐
│   Token Mint Account        │         │  Metaplex Metadata Program   │
│   [mint-address]            │         │  (Shared by ALL tokens)      │
├─────────────────────────────┤         └──────────────────────────────┘
│ Data:                       │                      │
│  - decimals: 8              │                      ├─── Creates
│  - supply: 0                │                      ↓
│  - mintAuthority: wallet    │         ┌──────────────────────────────┐
│  - freezeAuthority: wallet  │◄────────┤  Metadata PDA Account        │
└─────────────────────────────┘ Linked  │  (Derived from mint)         │
                                to      ├──────────────────────────────┤
                                        │ Data:                        │
                                        │  ✅ name: "Bitcoin"          │
                                        │  ✅ symbol: "BTC"            │
                                        │  ✅ uri: "https://..."       │
                                        │  - mint: [mint-address]     │
                                        │  - updateAuthority: wallet   │
                                        └──────────────────────────────┘
```

**Two accounts working together!**

---

## 🔄 Code Changes Explained (EVM Perspective)

### BEFORE: Like creating an ERC20 with no name()

```typescript
// mint_utils.ts - BEFORE
async createMint(decimals = 6): Promise<PublicKey> {
  return await splToken.createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals  // ← Only this, like: new Token(18) with no name/symbol
  );
}
```

**EVM Equivalent:**
```solidity
// Imagine if ERC20 had NO name/symbol!
contract BareMintToken {
    uint8 public decimals = 18;
    // ❌ No name
    // ❌ No symbol
    mapping(address => uint256) public balanceOf;
}
```

---

### AFTER: Like creating ERC20 with name, symbol, AND logo

```typescript
// mint_utils.ts - AFTER
async createMintWithMetadata(
  metadata: { name: string, symbol: string, uri: string },
  decimals = 6
): Promise<PublicKey> {
  // Step 1: Create the mint (like deploying basic token)
  const mint = await splToken.createMint(..., decimals);

  // Step 2: Derive metadata account address (deterministic!)
  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer()
    ],
    METADATA_PROGRAM_ID
  );

  // Step 3: Create metadata account with name, symbol, uri
  const instruction = createCreateMetadataAccountV3Instruction({
    metadata: metadataAddress,
    mint: mint,
    // ...
  }, {
    data: {
      name: metadata.name,      // ← Like token.name()
      symbol: metadata.symbol,  // ← Like token.symbol()
      uri: metadata.uri,        // ← NEW! Logo/metadata JSON URL
    }
  });

  await sendAndConfirmTransaction(connection, transaction, [payer]);
  return mint;
}
```

**EVM Equivalent:**
```solidity
// Like creating a full ERC20 with metadata
contract FullToken is ERC20 {
    string public name = "Bitcoin";
    string public symbol = "BTC";
    uint8 public decimals = 18;
    string public logoURI = "https://...";  // ← Extra metadata!
}

// Or even better: like ERC721 with tokenURI!
contract NFT is ERC721 {
    function tokenURI(uint256 id) returns (string) {
        return "https://metadata.json";  // ← Same concept as Solana's URI
    }
}
```

---

## 🤔 Why Separate Accounts? (vs EVM's Single Contract)

### EVM Approach
- **One contract per token** = Expensive to deploy
- Each token contract costs ~2M gas to deploy
- Duplicate code for every token (transfer, approve, etc.)

### Solana Approach
- **Shared program** = Deploy once, use forever
- Creating a token = Just creating 2 accounts (mint + metadata)
- Same program handles ALL tokens (like a singleton)
- Cheaper and more efficient!

**Think of it like:**
- EVM: `new ERC20Contract()` every time (full contract deployment)
- Solana: `Factory.createToken()` (just data, reuse logic)

---

## 🎨 What's a PDA? (Program Derived Address)

### In EVM
```solidity
// Deterministic address calculation
address predictedAddress = address(uint160(uint256(
    keccak256(abi.encodePacked(
        bytes1(0xff),
        factory,
        salt,
        keccak256(bytecode)
    ))
)));
// Used for: CREATE2, counterfactual addresses
```

### In Solana
```typescript
// PDA = Deterministic address from seeds
const [metadataAddress, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("metadata"),  // seed 1
    METADATA_PROGRAM_ID,      // seed 2
    mint.toBuffer()           // seed 3: the token mint address
  ],
  METADATA_PROGRAM_ID  // Program that "owns" this PDA
);
// Used for: Linking metadata to tokens deterministically
```

**Key Similarity:**
- Both create **deterministic** addresses
- Given the same inputs, always get the same address
- No need to store the link anywhere!

**Key Difference:**
- EVM CREATE2: For deploying contracts at predictable addresses
- Solana PDA: For creating "owned accounts" (data storage) at predictable addresses

---

## 📝 What Changed in Our Code

### File 1: `mint_utils.ts`

```typescript
// Added interface (like a struct)
export interface TokenMetadata {
  name: string;     // Like ERC20.name
  symbol: string;   // Like ERC20.symbol
  uri: string;      // Like ERC721.tokenURI - points to JSON/image
}

// Added new function
async createMintWithMetadata(
  metadata: TokenMetadata,
  decimals = 6
): Promise<PublicKey> {
  // 1. Create SPL token mint
  const mint = await splToken.createMint(...);

  // 2. Derive metadata PDA (like CREATE2 address calculation)
  const [metadataAddress] = PublicKey.findProgramAddressSync([...]);

  // 3. Call Metaplex program to create metadata account
  const instruction = createCreateMetadataAccountV3Instruction({
    // Pass name, symbol, uri
  });

  // 4. Send transaction
  await sendAndConfirmTransaction(...);

  return mint;
}
```

**EVM Mental Model:**
```solidity
// Step 1: Deploy basic token
Token token = new Token(decimals);

// Step 2: Calculate where metadata will be stored
address metadataAddr = computeMetadataAddress(address(token));

// Step 3: Deploy metadata contract at that address
MetadataContract metadata = new MetadataContract{salt: ...}(
    "Bitcoin",
    "BTC",
    "https://logo.png"
);

// Now: token.metadataAddress() returns metadata
```

---

### File 2: `localDeployFixed.ts`

```typescript
// BEFORE
const btcMint = await mintUtils.createMint(8);

// AFTER
const btcMint = await mintUtils.createMintWithMetadata(
  {
    name: "Bitcoin",
    symbol: "BTC",
    uri: "https://raw.githubusercontent.com/.../logo.png"
  },
  8
);
```

**EVM Mental Model:**
```solidity
// BEFORE: Like deploying a token with no metadata
Token btc = new BareToken(18);

// AFTER: Like deploying a full ERC20 with metadata
Token btc = new FullToken("Bitcoin", "BTC", 18);
// And setting logoURI too!
```

---

## 🔗 The Metadata URI (Like ERC721 tokenURI)

### What's the URI?

```typescript
uri: "https://raw.githubusercontent.com/.../logo.png"
```

Can point to:
1. **Direct image** (like above) - Simple logo
2. **Metadata JSON** (like ERC721) - Full metadata

### Metadata JSON Format (ERC721-style)

```json
{
  "name": "Bitcoin",
  "symbol": "BTC",
  "description": "Bitcoin on Solana",
  "image": "https://example.com/btc-logo.png",
  "external_url": "https://bitcoin.org",
  "attributes": [
    {"trait_type": "Type", "value": "Currency"}
  ],
  "properties": {
    "files": [
      {
        "uri": "https://example.com/btc-logo.png",
        "type": "image/png"
      }
    ],
    "category": "currency"
  }
}
```

**EVM Comparison:**
```solidity
// ERC721 NFT metadata
contract NFT is ERC721URIStorage {
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        return "https://metadata.json";  // ← Same concept!
    }
}
```

---

## 🔄 Transaction Flow Comparison

### EVM: Deploy ERC20 with Metadata

```javascript
// 1. Deploy contract (ONE transaction)
const tx = await factory.deploy("Bitcoin", "BTC", 18);
await tx.wait();

// Contract now has:
// - name: "Bitcoin"
// - symbol: "BTC"
// - decimals: 18
// All in ONE contract!
```

### Solana: Create Token with Metadata (Our Enhanced Code)

```typescript
// 1. Create mint account (calls SPL Token Program)
const mint = await createMint(connection, payer, authority, authority, 8);

// 2. Create metadata account (calls Metaplex Metadata Program)
const metadataIx = createCreateMetadataAccountV3Instruction({
  metadata: metadataAddress,  // PDA derived from mint
  mint: mint,
  // ... name, symbol, uri
});
await sendAndConfirmTransaction(connection, [metadataIx], [payer]);

// Now TWO accounts exist:
// - Mint account: decimals, supply, authorities
// - Metadata account: name, symbol, uri
```

---

## 📊 Storage Comparison

### EVM Storage Layout

```
Token Contract (0x123...abc)
│
├─ Storage Slot 0: name = "Bitcoin"
├─ Storage Slot 1: symbol = "BTC"
├─ Storage Slot 2: decimals = 18
├─ Storage Slot 3: totalSupply = 1000
└─ Storage Slot 4+: balances mapping
```

**One contract, all data together**

---

### Solana Account Layout

```
Mint Account (EgYU...Vfp7)
│
├─ byte 0-31: mintAuthority
├─ byte 32-39: supply (u64)
├─ byte 40: decimals (u8)
├─ byte 41: isInitialized (bool)
└─ byte 42-73: freezeAuthority

Metadata Account ([PDA-address])
│
├─ byte 0-31: updateAuthority
├─ byte 32-63: mint (link to mint account)
├─ byte 64-95: name = "Bitcoin"
├─ byte 96-127: symbol = "BTC"
└─ byte 128+: uri = "https://..."
```

**Two accounts, linked by PDA derivation**

---

## 💡 Key Takeaways for EVM Devs

| Concept | EVM | Solana |
|---------|-----|--------|
| **Token Standard** | ERC20 contract | SPL Token (shared program) |
| **Metadata** | Built into contract | Separate account (Metaplex) |
| **Name/Symbol** | Contract storage | Metadata PDA |
| **Logo/Image** | Not standard | URI field (like ERC721) |
| **Deployment** | ~2M gas | ~0.01 SOL (~$5k gas cheaper!) |
| **Transfer Logic** | Per-contract code | Shared program |
| **Account Model** | One contract = Everything | Multiple accounts = Composable |

---

## 🎯 What We Built: The Complete Picture

### Before (Like Bare ERC20)
```typescript
// Just a mint, no metadata
const mint = createMint(decimals: 8)
// Result: ❌ No name, ❌ No symbol
```

### After (Like Full ERC20 + ERC721 URI)
```typescript
// Mint + Metadata in one call
const mint = createMintWithMetadata({
  name: "Bitcoin",        // ← Like ERC20.name
  symbol: "BTC",          // ← Like ERC20.symbol
  uri: "https://..."      // ← Like ERC721.tokenURI
}, decimals: 8)
// Result: ✅ Full metadata, ✅ Professional token
```

---

## 🚀 Bottom Line

**What we did:**
- Added token name and symbol (which SPL Token doesn't have by default)
- Used Metaplex (the "standard" for Solana token metadata)
- Made your tokens display properly in wallets (like ENS for token names!)

**In EVM terms:**
- We upgraded from a bare `Token` contract to a full `ERC20` with `name()`, `symbol()`, and even `logoURI()`

**Cost:**
- EVM: Deploy ERC20 ≈ 2M gas (~0.05 ETH or ~$150)
- Solana: Create token + metadata ≈ 0.01 SOL (~$2)

---

## ❓ Questions EVM Devs Usually Ask

### Q: Why two accounts instead of one contract?
**A:** Solana's "shared program" model is more efficient than deploying contracts. Think of it like a singleton factory vs deploying a new contract each time.

### Q: How do wallets know where the metadata is?
**A:** They derive the metadata PDA from the mint address (deterministic, like CREATE2). No storage needed!

### Q: Can I update the metadata later?
**A:** Yes! The `updateAuthority` field (like `owner` in ERC20) can update it.

### Q: Is this like ERC20 + ERC721?
**A:** Kind of! SPL Token = ERC20 functionality, Metaplex Metadata = ERC721-style tokenURI.

### Q: What if I don't add metadata?
**A:** Token still works, but wallets show the address instead of "Bitcoin (BTC)".

---

Hope this makes sense! Let me know if you want me to explain any specific part in more detail. 🚀
