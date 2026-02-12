# OpenBook V2 Monorepo

> Unified repository for OpenBook V2 DEX: smart contracts, deployment scripts, and event indexer

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start local validator with pre-built programs
solana-test-validator --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so \
  --quiet &

# 3. Deploy markets
pnpm deploy-local

# 4. View markets
pnpm view-markets
```

## Project Structure

```
openbook/
├── programs/openbook-v2/   # OpenBook V2 DEX program (Rust/Anchor)
├── packages/scripts/       # Deployment & interaction scripts (TypeScript)
├── crates/indexer/        # Event indexer with REST API (Rust)
└── docs/                  # Documentation
```

## Common Commands

### Trading & Markets

```bash
pnpm deploy-local    # Deploy tokens and create markets
pnpm view-markets    # View all deployed markets
pnpm post-order      # Post a test order
```

### Indexer

```bash
pnpm indexer:api        # Start REST API server (port 3000)
pnpm indexer:listener   # Start event listener
```

### Development

```bash
pnpm build     # Build all packages
pnpm format    # Format all code (TypeScript + Rust)
pnpm lint      # Lint all code
pnpm clean     # Clean build artifacts
```

## Prerequisites

- **Rust**: 1.79.0 (auto-managed via `rust-toolchain.toml`)
- **Solana CLI**: 1.18.23
- **Anchor CLI**: 0.28.0
- **Node.js**: ≥18
- **pnpm**: ≥8
- **PostgreSQL**: ≥14 (for indexer)

## Documentation

- 📘 [Setup Guide](docs/MONOREPO_README.md) - Complete setup instructions
- 📗 [Deployment Guide](docs/guides/DEPLOYMENT_SUMMARY.md) - Token & market deployment
- 📙 [All Guides](docs/README.md) - Full documentation index

## Components

### Programs (`programs/openbook-v2/`)

OpenBook V2 orderbook DEX program built with Anchor.

- **Program ID**: `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`
- **Build**: Use pre-built binaries from devnet (recommended)
- **Test**: `cd programs/openbook-v2 && anchor test`

### Scripts (`packages/scripts/`)

TypeScript deployment and interaction scripts.

- Create tokens with metadata
- Deploy markets (BTC/USDT, WETH/USDT, etc.)
- Place orders, view orderbooks
- Trading demos

### Indexer (`crates/indexer/`)

High-performance Rust indexer for OpenBook events.

- REST API for querying market data
- Real-time event processing
- PostgreSQL storage

## Environment Setup

### Scripts

Create `packages/scripts/.env`:
```env
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
ANCHOR_WALLET=/path/to/your/keypair.json
```

### Indexer

Create `crates/indexer/.env`:
```env
RPC_URL=http://127.0.0.1:8899
DATABASE_URL=postgresql://user:password@localhost/openbook_indexer
PORT=3000
```

## Why Pre-built Programs?

Due to Rust toolchain constraints (need 1.79.0 for BPF, but Solana 1.18.23 deps need 1.85+), we use pre-built programs from devnet:

```bash
# Download once
solana program dump opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so --url https://api.devnet.solana.com
solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so --url https://api.devnet.solana.com
```

## Troubleshooting

### Validator won't start
```bash
pkill -9 -f solana-test-validator
rm -rf test-ledger/
# Restart with fresh state
```

### Wrong Rust version
```bash
rustc --version  # Should show 1.79.0
rustup override set 1.79.0
```

### pnpm issues
```bash
pnpm store prune
rm -rf node_modules packages/*/node_modules
pnpm install
```

## Contributing

1. Fork and create a feature branch
2. Make your changes
3. Test: `pnpm test && pnpm lint`
4. Submit a pull request

## License

MIT

---

**Need help?** Check the [documentation index](docs/README.md) or [setup guide](docs/MONOREPO_README.md).
