# OpenBook V2 Monorepo

A unified repository containing OpenBook V2 smart contracts, deployment scripts, and event indexer.

## Structure

```
openbook/
├── programs/               # Solana programs (Rust/Anchor)
│   └── openbook-v2/       # OpenBook V2 DEX program
│       ├── programs/      # Program source code
│       └── lib/client/    # Rust client library
│
├── packages/              # TypeScript/JavaScript packages
│   └── scripts/          # Deployment and interaction scripts
│       ├── localDeployFixed.ts
│       ├── viewMarkets.ts
│       ├── postOrder.ts
│       └── ...
│
├── crates/               # Rust crates (non-program)
│   └── indexer/         # Event indexer with REST API
│       ├── src/
│       │   ├── bin/     # Binaries (api-server, event-listener)
│       │   ├── api/     # REST API
│       │   └── indexer/ # Event listening & processing
│       └── schema.sql   # Database schema
│
├── docs/                # Documentation
├── Cargo.toml          # Rust workspace configuration
├── package.json        # pnpm workspace configuration
└── pnpm-workspace.yaml # pnpm workspace definition
```

## Prerequisites

- **Rust**: 1.79.0 (managed via rust-toolchain.toml)
- **Solana CLI**: 1.18.23
- **Anchor CLI**: 0.28.0
- **Node.js**: ≥18
- **pnpm**: ≥8
- **PostgreSQL**: ≥14 (for indexer)

## Quick Start

### 1. Install Dependencies

```bash
# Install pnpm if needed
npm install -g pnpm

# Install all dependencies
pnpm install

# Verify Rust toolchain
rustc --version  # Should show 1.79.0
```

### 2. Start Local Validator with Pre-built Programs

```bash
# Download pre-built programs from devnet (one-time setup)
solana program dump opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so --url https://api.devnet.solana.com
solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so --url https://api.devnet.solana.com

# Start validator
pkill -9 -f solana-test-validator
solana-test-validator --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so \
  --quiet &
```

### 3. Deploy Markets

```bash
# Deploy tokens and create markets
pnpm deploy-local

# View deployed markets
pnpm view-markets

# Post a test order
pnpm post-order
```

### 4. Run Indexer (Optional)

```bash
# Set up PostgreSQL database
createdb openbook_indexer
psql openbook_indexer < crates/indexer/schema.sql

# Configure environment
cp crates/indexer/.env.example crates/indexer/.env
# Edit .env with your database credentials

# Start API server
pnpm indexer:api

# In another terminal, start event listener
pnpm indexer:listener
```

## Available Commands

### Root Commands

```bash
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm clean          # Clean all build artifacts
pnpm format         # Format all code (TypeScript + Rust)
pnpm lint           # Lint all code
```

### Scripts Package Commands

```bash
pnpm --filter scripts deploy-local-fixed   # Deploy markets locally
pnpm --filter scripts view-markets         # View market details
pnpm --filter scripts post-order           # Post a test order
pnpm --filter scripts create-market        # Create a new market
pnpm --filter scripts trading-demo         # Run trading demo
```

### Indexer Commands

```bash
cargo run --bin api-server      # Start REST API server
cargo run --bin event-listener  # Start event listener
```

### Program Development

```bash
# Build programs (Note: Use pre-built binaries for deployment)
cd programs/openbook-v2
anchor build

# Run program tests
anchor test
```

## Environment Configuration

### Scripts Package

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

## Development Notes

### Why Use Pre-built Programs?

Due to toolchain conflicts (Rust 1.79.0 required for BPF compilation, but Solana 1.18.23 requires edition2024 which needs Rust 1.85+), we use pre-built programs from devnet for local development. This is the recommended approach.

### Program Addresses

- **OpenBook V2**: `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`
- **Metaplex Token Metadata**: `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`

## Documentation

- [Complete Setup Guide](COMPLETE_SETUP_GUIDE.md)
- [Deployment Summary](DEPLOYMENT_SUMMARY.md)
- [Original README](README.md)
- [API Documentation](docs/)

## Troubleshooting

### Validator Won't Start

```bash
# Kill any existing validators
pkill -9 -f solana-test-validator

# Remove test ledger
rm -rf test-ledger/

# Restart with fresh state
solana-test-validator --reset --bpf-program ...
```

### pnpm Install Fails

```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules packages/*/node_modules
pnpm install
```

### Rust Compilation Issues

```bash
# Verify correct Rust version
rustc --version  # Should be 1.79.0

# Force rustup to use toolchain file
rustup override set 1.79.0

# Clean and rebuild
cargo clean
cargo build
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting: `pnpm test && pnpm lint`
4. Submit a pull request

## License

MIT
