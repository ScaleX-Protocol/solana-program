# OpenBook V2 Local Development

Complete local development environment for OpenBook V2 DEX on Solana with token metadata support.

---

## 🚀 Quick Start

```bash
# 1. Build OpenBook + Download Metaplex
./start-validator-dev.sh

# 2. Update program ID in scripts-v2/localDeployFixed.ts
#    (Script shows your program ID)

# 3. Deploy markets
cd scripts-v2 && npm run deploy-local-fixed
```

**What this does:**
- ✅ Compiles OpenBook from source (you can modify it)
- ✅ Downloads Metaplex for token metadata
- ✅ Starts local validator with both programs
- ✅ Ready for development!

**→ See [COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md) for detailed instructions**

---

## 📚 Documentation

**→ [COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md)** - Everything you need (start here!)

### Additional Resources

- **For EVM developers**: See [COMPLETE_SETUP_GUIDE.md → For EVM Developers](./COMPLETE_SETUP_GUIDE.md#-for-evm-developers)
- **Understanding programs**: See [COMPLETE_SETUP_GUIDE.md → Programs Used](./COMPLETE_SETUP_GUIDE.md#-programs-used)
- **More documentation**: See [`docs/`](./docs/) folder for reference guides and development history

---

## 🛠️ What This Includes

### Infrastructure
- ✅ Local Solana validator
- ✅ OpenBook V2 DEX program
- ✅ Metaplex Token Metadata program
- ✅ 3 tokens with names, symbols, and logos
- ✅ 2 trading markets (BTC/USDT, WETH/USDT)

### Scripts
```bash
npm run deploy-local-fixed          # Deploy everything
npm run view-markets                # View markets
npm run create-tokens-with-metadata # Create custom tokens
npm run post-order                  # Place an order
```

---

## 🎯 Key Concepts

### Programs (Like Smart Contracts)

Your validator runs 4 programs:

1. **System Program** (built-in) - Creates accounts
2. **SPL Token** (built-in) - Manages tokens
3. **OpenBook** (loaded) - DEX functionality
4. **Metaplex** (loaded) - Token metadata

### Token with Metadata

```typescript
// Creates token with name, symbol, and logo
const mint = await createMintWithMetadata(
  {
    name: "Bitcoin",
    symbol: "BTC",
    uri: "https://logo.png"
  },
  8 // decimals
);
```

**Result:**
- Mint account (stores decimals, supply)
- Metadata account (stores name, symbol, logo)
- Visible in wallets with proper name and icon

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection refused | `./start-validator-full.sh` |
| Program not found | Download programs (see guide) |
| No SOL | `solana airdrop 100` |
| TypeScript errors | `cd scripts-v2 && npm install` |

See [COMPLETE_SETUP_GUIDE.md → Troubleshooting](./COMPLETE_SETUP_GUIDE.md#-troubleshooting) for more.

---

## 📁 Project Structure

```
openbook/
├── README.md                      ← You are here
├── COMPLETE_SETUP_GUIDE.md        ← Main guide (read this!)
├── start-validator-dev.sh         ← Development startup script
│
├── openbook-v2/                   ← OpenBook program source
│   ├── programs/                  ← Rust code (modify here!)
│   └── ts/                        ← TypeScript client
│
└── scripts-v2/                    ← Your deployment scripts
    ├── localDeployFixed.ts        ← Main deployment (with metadata)
    ├── viewMarkets.ts             ← Market viewer
    ├── mint_utils.ts              ← Token utilities
    └── package.json               ← NPM scripts
```

---

## 💰 Cost Comparison

| Operation | Ethereum | Solana |
|-----------|----------|--------|
| Deploy ERC20 | ~$150 | N/A (shared program) |
| Create token + metadata | Included | ~$2 |
| **Savings** | - | **98% cheaper!** |

---

## 🎓 Learning Resources

- **Solana Docs**: https://docs.solana.com
- **OpenBook V2**: https://github.com/openbook-dex/openbook-v2
- **Metaplex**: https://docs.metaplex.com

---

## ✅ What You Can Do Now

1. ✅ Create tokens with professional metadata
2. ✅ Deploy trading markets locally
3. ✅ Place and match orders
4. ✅ Build trading bots
5. ✅ Develop UIs for your DEX
6. ✅ Test strategies risk-free

---

## 🚀 Next Steps

**Build something!**

- Place your first order: `npm run post-order`
- Create a market maker bot
- Build a trading UI
- Test arbitrage strategies
- Deploy to devnet when ready

---

**Happy building on Solana! 🎉**

---

*For complete documentation, see [COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md)*
