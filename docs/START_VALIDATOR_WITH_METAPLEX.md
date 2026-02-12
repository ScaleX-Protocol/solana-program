# Starting Local Validator with Metaplex

## 🎯 The Problem

Your local validator doesn't have Metaplex Token Metadata program by default!

You need to load it, just like you loaded OpenBook.

---

## 📥 Step 1: Download Metaplex Program from Devnet

```bash
# Navigate to temp directory
cd /tmp

# Download Metaplex Token Metadata program from devnet
solana program dump \
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so \
  --url https://api.devnet.solana.com

# This will take a minute - the program is ~1.5MB
```

**Expected output:**
```
Wrote program to /tmp/metaplex_token_metadata.so
```

---

## 🚀 Step 2: Start Validator with BOTH Programs

Now start your validator with **two** programs: OpenBook + Metaplex

```bash
# Set PATH
export PATH="$HOME/.local/share/solana/install/solana-release/bin:$PATH"

# Navigate to OpenBook directory
cd /Users/renaka/gtx/openbook/openbook-v2

# Kill existing validator (if running)
pkill -9 -f solana-test-validator

# Start validator with BOTH programs
solana-test-validator \
  --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
    /tmp/openbook_v2_devnet.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    /tmp/metaplex_token_metadata.so \
  --quiet &

# Wait for validator to start
sleep 10
```

**Key points:**
- `--bpf-program` flag can be used **multiple times**
- First one: OpenBook program
- Second one: Metaplex program
- Both programs are now loaded!

---

## ✅ Step 3: Verify Programs Are Loaded

```bash
# Configure Solana CLI
solana config set --url http://localhost:8899

# Check OpenBook program
solana account opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb

# Check Metaplex program
solana account metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
```

**Expected output:**
```
Public Key: opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb
Balance: 0.5 SOL
Owner: BPFLoaderUpgradeab1e11111111111111111111111
Executable: true
...

Public Key: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
Balance: 0.5 SOL
Owner: BPFLoaderUpgradeab1e11111111111111111111111
Executable: true
...
```

If you see "Executable: true", the programs are loaded! ✅

---

## 💰 Step 4: Fund Your Account

```bash
solana airdrop 100
solana balance
```

---

## 🚀 Step 5: Deploy Tokens with Metadata

Now you can run your deployment script:

```bash
cd /Users/renaka/gtx/openbook/scripts-v2
npm run deploy-local-fixed
```

This will work because:
- ✅ SPL Token program (built-in, always there)
- ✅ OpenBook program (loaded from devnet)
- ✅ Metaplex program (loaded from devnet)

---

## 📝 Complete Startup Script

Save this as `start-validator-full.sh`:

```bash
#!/bin/bash

echo "🚀 Starting Local Validator with OpenBook + Metaplex"
echo ""

# Set PATH
export PATH="$HOME/.local/share/solana/install/solana-release/bin:$PATH"

# Kill existing validator
echo "Stopping existing validator..."
pkill -9 -f solana-test-validator
sleep 2

# Download programs if not exists
if [ ! -f /tmp/openbook_v2_devnet.so ]; then
    echo "📥 Downloading OpenBook program..."
    solana program dump \
      opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
      /tmp/openbook_v2_devnet.so \
      --url https://api.devnet.solana.com
fi

if [ ! -f /tmp/metaplex_token_metadata.so ]; then
    echo "📥 Downloading Metaplex program..."
    solana program dump \
      metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
      /tmp/metaplex_token_metadata.so \
      --url https://api.devnet.solana.com
fi

# Start validator
echo ""
echo "🚀 Starting validator..."
cd /Users/renaka/gtx/openbook/openbook-v2

solana-test-validator \
  --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
    /tmp/openbook_v2_devnet.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    /tmp/metaplex_token_metadata.so \
  --quiet > /tmp/validator.log 2>&1 &

echo "⏳ Waiting for validator to start..."
sleep 10

# Configure and fund
echo "⚙️  Configuring Solana CLI..."
solana config set --url http://localhost:8899

echo "💰 Requesting airdrop..."
solana airdrop 100

# Verify
echo ""
echo "✅ Validator started successfully!"
echo ""
echo "📋 Programs loaded:"
echo "   OpenBook:  opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
echo "   Metaplex:  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
echo ""
echo "💡 Next steps:"
echo "   cd /Users/renaka/gtx/openbook/scripts-v2"
echo "   npm run deploy-local-fixed"
echo ""
```

Make it executable:
```bash
chmod +x start-validator-full.sh
./start-validator-full.sh
```

---

## 🎯 What This Does

1. **Downloads programs** (if not already downloaded)
   - OpenBook: `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`
   - Metaplex: `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`

2. **Starts validator** with both programs loaded

3. **Funds your account** with 100 SOL

4. **Ready to deploy** tokens with metadata!

---

## 🔍 Troubleshooting

### Problem: "Program account not found"

**Cause:** Metaplex program not loaded

**Solution:**
```bash
# Verify program is downloaded
ls -lh /tmp/metaplex_token_metadata.so

# If not, download it:
solana program dump \
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so \
  --url https://api.devnet.solana.com

# Restart validator with the program
```

### Problem: "Invalid account data for instruction"

**Cause:** Wrong program version or corrupted download

**Solution:**
```bash
# Re-download the program
rm /tmp/metaplex_token_metadata.so
solana program dump \
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so \
  --url https://api.devnet.solana.com
```

---

## 💡 EVM Comparison

**In EVM:**
```
Local testnet (Ganache/Hardhat) = Empty chain
You need to deploy ALL contracts yourself
```

**In Solana:**
```
Local validator = Minimal chain (only System Program, SPL Token)
You need to load other programs from devnet/mainnet
```

**Think of it like:**
- Downloading a npm package vs installing it
- The program is "installed" on devnet
- You "download" it and "load" it into your local validator

---

## ✅ Summary

**To use Metaplex on local validator:**

1. Download program from devnet: `solana program dump`
2. Load it when starting validator: `--bpf-program`
3. Verify it's loaded: `solana account`
4. Deploy tokens with metadata: `npm run deploy-local-fixed`

**Programs you need:**
- ✅ System Program (built-in)
- ✅ SPL Token Program (built-in)
- ✅ OpenBook Program (download from devnet)
- ✅ Metaplex Program (download from devnet)

---

*Now your local validator has everything needed for token creation with metadata!* 🎉
