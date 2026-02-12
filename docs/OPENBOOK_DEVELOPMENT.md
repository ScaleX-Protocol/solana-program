# OpenBook Development - Compiling and Modifying

If you want to **modify OpenBook** (not just use it), follow this guide.

---

## 🎯 Development Setup

### Prerequisites

```bash
# Check Rust version (needs 1.75+)
rustc --version

# Check Anchor version
anchor --version  # Should be 0.29.0+

# Check Solana version
solana --version  # Should be 1.18.23
```

---

## 🔨 Compiling OpenBook from Source

### Step 1: Build the Program

```bash
cd /Users/renaka/gtx/openbook/openbook-v2

# Clean previous builds
anchor clean

# Build the program (takes 10-15 minutes first time)
anchor build

# Output: target/deploy/openbook_v2.so
```

**What this does:**
- Compiles Rust code in `programs/openbook-v2/src/`
- Creates BPF (Berkeley Packet Filter) binary
- Generates IDL (Interface Definition Language)
- Outputs to `target/deploy/`

---

### Step 2: Get the Program ID

```bash
# Check program ID
solana address -k target/deploy/openbook_v2-keypair.json
```

**Important:** This will be a **different address** than devnet's OpenBook!

**Two options:**

#### Option A: Use New Program ID (Easier)
- Your modified OpenBook will have a new address
- Update your code to use the new program ID
- Independent from production OpenBook

#### Option B: Keep Same Program ID (Advanced)
- Replace the keypair with devnet's keypair
- Requires the upgrade authority (you don't have it)
- Only works for testing locally

**Recommended: Option A (use new program ID)**

---

## 🚀 Deploying Your Modified OpenBook

### Method 1: Using Anchor Test (Recommended)

```bash
cd openbook-v2

# This will:
# 1. Start a local validator
# 2. Deploy your program
# 3. Run tests
anchor test
```

**What happens:**
- Starts fresh validator
- Deploys your compiled program
- Runs test suite
- Shuts down validator when done

---

### Method 2: Manual Deployment

```bash
# Step 1: Start validator
solana-test-validator --reset &
sleep 10
solana config set --url localhost

# Step 2: Deploy your program
anchor deploy

# Step 3: Get the program ID
solana address -k target/deploy/openbook_v2-keypair.json

# Example output: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

---

### Method 3: Load into Validator at Startup

```bash
# Build first
cd openbook-v2
anchor build

# Start validator with your program
solana-test-validator \
  --reset \
  --bpf-program $(solana address -k target/deploy/openbook_v2-keypair.json) \
    target/deploy/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    /tmp/metaplex_token_metadata.so \
  &
```

---

## 🔧 Development Workflow

### Making Changes

```bash
# 1. Edit Rust code
vim openbook-v2/programs/openbook-v2/src/lib.rs

# 2. Rebuild
anchor build

# 3. Test
anchor test

# 4. If tests pass, deploy to local validator
anchor deploy
```

---

## 📝 Updating Your Scripts

After compiling, update your deployment scripts to use the new program ID:

```typescript
// scripts-v2/localDeployFixed.ts

// OLD (devnet OpenBook)
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

// NEW (your compiled OpenBook)
const PROGRAM_ID = new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
//                                 ↑ Use your program ID from keypair
```

Get your program ID:
```bash
solana address -k openbook-v2/target/deploy/openbook_v2-keypair.json
```

---

## 🎯 Key Differences

### Using Devnet Binary vs Compiling

| Aspect | Devnet Binary | Compiled from Source |
|--------|---------------|----------------------|
| **Speed** | 1 minute download | 10-15 min compile |
| **Program ID** | `opnb2LAfJ...` (fixed) | New random ID |
| **Modify code** | ❌ Can't change | ✅ Full control |
| **Production-ready** | ✅ Tested | ⚠️ Your responsibility |
| **Updates** | Manual re-download | Rebuild after changes |

---

## 🔄 Hybrid Approach (Recommended)

**For most development:**

1. **Start with devnet binary** (fast, stable)
   - Build your UI/bots
   - Test integrations
   - Learn the system

2. **Switch to source when needed**
   - When you need custom features
   - When you hit limitations
   - When you want to contribute

---

## 🛠️ Common Modifications

### Example 1: Change Fee Structure

```rust
// programs/openbook-v2/src/state/market.rs

pub struct Market {
    // ...
    pub maker_fee: i64,  // Change this
    pub taker_fee: i64,  // Or this
    // ...
}
```

After changing:
```bash
anchor build
anchor test
anchor deploy
```

---

### Example 2: Add Custom Validation

```rust
// programs/openbook-v2/src/instructions/place_order.rs

pub fn place_order(ctx: Context<PlaceOrder>, args: PlaceOrderArgs) -> Result<()> {
    // Add your custom logic here
    require!(args.price > 0, ErrorCode::InvalidPrice);

    // ... existing code
}
```

---

## 🧪 Testing Your Changes

### Run All Tests

```bash
cd openbook-v2
anchor test
```

### Run Specific Test

```bash
anchor test -- --test place_order
```

### Write New Tests

```typescript
// tests/openbook-v2.ts

it("places order with custom validation", async () => {
  // Your test code
});
```

---

## 📦 Building for Production

When ready to deploy to devnet/mainnet:

```bash
# Build optimized
anchor build --verifiable

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Or mainnet
anchor deploy --provider.cluster mainnet
```

---

## 🎯 Quick Decision Guide

**Use devnet binary if:**
- ✅ Building on top of OpenBook (UI, bots, integrations)
- ✅ Don't need to change OpenBook code
- ✅ Want fast iteration
- ✅ Testing production behavior

**Compile from source if:**
- ✅ Modifying OpenBook logic
- ✅ Adding custom features
- ✅ Contributing to OpenBook
- ✅ Research/experimentation with the code

---

## 🚀 Your Development Script

Create `start-validator-dev.sh`:

```bash
#!/bin/bash

echo "🔨 Building OpenBook from source..."
cd /Users/renaka/gtx/openbook/openbook-v2
anchor build

echo "🔑 Getting program ID..."
PROGRAM_ID=$(solana address -k target/deploy/openbook_v2-keypair.json)
echo "Program ID: $PROGRAM_ID"

echo "🚀 Starting validator with your program..."
solana-test-validator \
  --reset \
  --bpf-program $PROGRAM_ID \
    target/deploy/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    /tmp/metaplex_token_metadata.so \
  --quiet &

sleep 10

echo "💰 Funding account..."
solana config set --url localhost
solana airdrop 100

echo "✅ Ready for development!"
echo ""
echo "Program ID: $PROGRAM_ID"
echo "Update your scripts with this program ID!"
```

Make it executable:
```bash
chmod +x start-validator-dev.sh
```

---

## ✅ Summary

**For modifying OpenBook:**

1. ✅ Use `anchor build` to compile from source
2. ✅ Deploy with `anchor test` or `anchor deploy`
3. ✅ Update scripts with new program ID
4. ✅ Test your changes locally
5. ✅ Deploy to devnet when ready

**Current setup (using devnet binary) is for:**
- Using OpenBook as-is
- Building integrations
- Fast development

**Switch to source compilation when you need to:**
- Modify OpenBook logic
- Add features
- Customize behavior

---

*Choose your path based on your goals!* 🎯
