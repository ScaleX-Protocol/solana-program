# OpenBook V2 - Quick Start Guide

## Essential Commands

### 🔨 Build & Test
```bash
cd /Users/renaka/gtx/openbook/openbook-v2

# Build the program
just build

# Run all tests
just test-all

# Run specific test (e.g., test_expired_order)
just test test_expired_order

# Lint code
just lint
```

### 📦 TypeScript Client
```bash
cd /Users/renaka/gtx/openbook/openbook-v2

# Build TypeScript client (already done)
yarn build

# Format code
yarn format

# Run linter
yarn lint
```

### 🔧 Solana Commands
```bash
# Check Solana version
solana --version

# Create a new keypair (if needed)
solana-keygen new

# Set cluster (devnet/testnet/mainnet)
solana config set --url devnet
solana config set --url testnet
solana config set --url https://api.mainnet-beta.solana.com

# Check config
solana config get

# Check balance
solana balance
```

### 📝 Example Scripts
```bash
cd /Users/renaka/gtx/openbook/scripts-v2

# Run the main script
npm run main
```

## 🔍 Verify Setup

Run these to confirm everything is installed:
```bash
node --version      # v20.11.0
npm --version       # v10.2.4
yarn --version      # v1.22.22
rustc --version     # v1.88.0
just --version      # v1.46.0
solana --version    # v1.18.23
```

## 📂 Key Files

- **Main Program**: `programs/openbook-v2/src/lib.rs`
- **TypeScript Client**: `ts/client/src/index.ts`
- **IDL**: `idl/openbook_v2.json`
- **Tests**: `tests/`
- **Build Commands**: `Justfile`

## 🌐 Deployed Versions

| Network | Program ID |
|---------|-----------|
| Mainnet | `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb` |
| Devnet  | `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb` |
| Testnet | `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb` |

## 🐛 Troubleshooting

### PATH Issues
If Solana commands not found:
```bash
export PATH="$HOME/.local/share/solana/install/solana-release/bin:$PATH"
```

Or permanently add to `~/.zshrc`:
```bash
echo 'export PATH="$HOME/.local/share/solana/install/solana-release/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Clean Build
If build issues occur:
```bash
cd /Users/renaka/gtx/openbook/openbook-v2
cargo clean
just build
```

### Update Dependencies
```bash
cd /Users/renaka/gtx/openbook/openbook-v2
yarn install
```

## 📚 Resources

- **GitHub**: https://github.com/openbook-dex/openbook-v2
- **Solana Docs**: https://docs.solana.com
- **Anchor Docs**: https://www.anchor-lang.com
- **OpenBook Docs**: Check the GitHub repo for latest documentation

## 🎯 Common Development Workflow

1. **Make changes** to the Rust program in `programs/openbook-v2/src/`
2. **Build**: `just build`
3. **Test**: `just test-all` or `just test <test_name>`
4. **Lint**: `just lint`
5. **Build TypeScript**: `yarn build` (if you changed IDL or types)
6. **Run scripts**: Test integration with scripts in `scripts-v2/`

---

**Status**: ✅ Your environment is fully set up and ready for development!
