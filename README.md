# OpenBook V2 Monorepo

> Unified repository for OpenBook V2 DEX: smart contracts, deployment scripts, and event indexer

## Quick Start (Already Set Up)

If you already have everything installed:

```bash
pnpm deploy-local    # Deploy markets
pnpm view-markets    # View markets
pnpm post-order      # Place order
```

**First time?** See [Complete Setup](#complete-setup) below.

## Complete Setup

### 1. Install Prerequisites

<details>
<summary><b>macOS</b></summary>

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js and pnpm
brew install node
npm install -g pnpm

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.23/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.28.0
avm use 0.28.0

# Install Docker (for indexer PostgreSQL)
brew install --cask docker
# Open Docker.app to start Docker daemon
```
</details>

<details>
<summary><b>Linux</b></summary>

```bash
# Install Node.js and pnpm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install dependencies
sudo apt-get update
sudo apt-get install -y pkg-config build-essential libudev-dev libssl-dev

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.23/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.28.0
avm use 0.28.0

# Install Docker (for indexer PostgreSQL)
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER  # Log out and back in after this
```
</details>

**Verify installation:**
```bash
node --version        # Should be ≥18
pnpm --version        # Should be ≥8
rustc --version       # Should show 1.79.0 (auto-set by rust-toolchain.toml)
solana --version      # Should be 1.18.23
anchor --version      # Should be 0.28.0
docker --version      # For indexer database
```

### 2. Download Pre-built Programs

```bash
# Create tmp directory if it doesn't exist
mkdir -p /tmp

# Download OpenBook V2 program
solana program dump opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
  /tmp/openbook_v2.so \
  --url https://api.devnet.solana.com

# Download Metaplex Token Metadata program
solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  /tmp/metaplex_token_metadata.so \
  --url https://api.devnet.solana.com

# Verify downloads
ls -lh /tmp/*.so
```

**Why pre-built?** Due to Rust toolchain constraints (need 1.79.0 for BPF, but Solana 1.18.23 deps need 1.85+), we use pre-built programs from devnet.

### 3. Set Up Wallet

```bash
# Create a new wallet (or use existing)
solana-keygen new --outfile ~/.config/solana/id.json

# Set Solana config to localhost
solana config set --url http://localhost:8899

# Verify wallet
solana address
```

### 4. Install Project Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

### 5. Start Local Validator & Deploy

```bash
# Start validator with pre-built programs
solana-test-validator --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so \
  --quiet &

# Wait for validator to start (5-10 seconds)
sleep 10

# Airdrop SOL to your wallet
solana airdrop 100

# Deploy tokens and markets
pnpm deploy-local

# View deployed markets
pnpm view-markets
```

**Verify setup:**
```bash
# Check validator is running
solana cluster-version

# Check balance
solana balance

# View markets
pnpm view-markets

# Place a test order
pnpm post-order
```

### 6. Set Up Indexer (Optional)

<details>
<summary><b>Click to expand indexer setup</b></summary>

#### Start PostgreSQL Database

```bash
# Start PostgreSQL 17 in Docker
docker run -d \
  --name postgres-database \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=openbook_indexer \
  -p 5436:5432 \
  postgres:17

# Verify container is running
docker ps | grep postgres-database
```

#### Apply Database Schema

```bash
# Apply schema to the database
PGPASSWORD=postgres psql -h localhost -p 5436 -U postgres -d openbook_indexer < crates/indexer/schema.sql

# Verify tables were created
PGPASSWORD=postgres psql -h localhost -p 5436 -U postgres -d openbook_indexer -c "\dt"
```

#### Configure Environment

```bash
# Create .env file for indexer
cat > crates/indexer/.env << EOF
RPC_URL=http://127.0.0.1:8899
DATABASE_URL=postgresql://postgres:postgres@localhost:5436/openbook_indexer
PORT=3000
LOG_LEVEL=info
EOF
```

**Database Connection Details:**
- Host: `localhost`
- Port: `5436` (mapped from container's 5432)
- Database: `openbook_indexer`
- User: `postgres`
- Password: `postgres`
- Container: `postgres-database`
- Image: `postgres:17`

#### Start Indexer Services

```bash
# Terminal 1: Start API server
pnpm indexer:api

# Terminal 2: Start event listener
pnpm indexer:listener
```

#### Verify Indexer

```bash
# Check API health
curl http://localhost:3000/health

# View indexed markets
curl http://localhost:3000/markets

# Check database contents
PGPASSWORD=postgres psql -h localhost -p 5436 -U postgres -d openbook_indexer -c "
SELECT
  (SELECT COUNT(*) FROM markets) as markets,
  (SELECT COUNT(*) FROM orders) as orders,
  (SELECT COUNT(*) FROM trades) as trades,
  (SELECT COUNT(*) FROM events) as events;
"

# Or access database directly
docker exec -it postgres-database psql -U postgres -d openbook_indexer
```

#### Stop/Restart Database

```bash
# Stop database
docker stop postgres-database

# Start existing database
docker start postgres-database

# Remove database (WARNING: deletes all data)
docker rm -f postgres-database
```

</details>

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

## Prerequisites Summary

| Tool | Version | Required For |
|------|---------|--------------|
| Node.js | ≥18 | Scripts |
| pnpm | ≥8 | Package management |
| Rust | 1.79.0 | Building (auto-managed) |
| Solana CLI | 1.18.23 | Validator & deployment |
| Anchor CLI | 0.28.0 | Smart contracts |
| Docker | Latest | Indexer database (optional) |

See [Complete Setup](#complete-setup) for installation instructions.

## Documentation

- 📘 **This README** - Complete setup and usage guide
- 📗 [Local Docs](docs/README.md) - Additional guides and references (local only, not in git)
- 📕 [Component READMEs](#components) - Detailed docs for each component

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

## Environment Configuration

### Scripts (Optional)

By default, scripts use `http://localhost:8899` and `~/.config/solana/id.json`.

To customize, create `packages/scripts/.env`:
```env
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
ANCHOR_WALLET=/path/to/your/keypair.json
```

### Indexer (If Using)

See [Set Up Indexer](#6-set-up-indexer-optional) in Complete Setup section.

## Troubleshooting

### Validator Issues

**Validator won't start:**
```bash
# Kill any existing validators
pkill -9 -f solana-test-validator

# Remove old ledger
rm -rf test-ledger/

# Restart with fresh state
solana-test-validator --reset \
  --bpf-program opnb2LAfJYbRMAHHvqjCwqxanZn7ReEHp1k81EohpZb /tmp/openbook_v2.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /tmp/metaplex_token_metadata.so \
  --quiet &
```

**Connection refused:**
```bash
# Check validator is running
solana cluster-version

# Check Solana config
solana config get

# Should show: RPC URL: http://localhost:8899
```

**No SOL in wallet:**
```bash
solana airdrop 100
```

### Deployment Issues

**Program not found:**
```bash
# Verify programs exist
ls -lh /tmp/*.so

# Re-download if missing (see Complete Setup)
```

**Transaction fails:**
```bash
# Check balance
solana balance

# Airdrop more SOL if needed
solana airdrop 100
```

### Indexer Issues

**Database connection fails:**
```bash
# Check Docker container is running
docker ps | grep postgres-database

# Restart container
docker restart postgres-database

# Check logs
docker logs postgres-database
```

**Schema not applied:**
```bash
# Reapply schema
PGPASSWORD=postgres psql -h localhost -p 5436 -U postgres -d openbook_indexer < crates/indexer/schema.sql
```

**Wrong database port:**
```bash
# Make sure you're using port 5436, not 5432!
# Correct: postgresql://postgres:postgres@localhost:5436/openbook_indexer
# Wrong:   postgresql://postgres:postgres@localhost:5432/openbook_indexer
```

**Can't connect to RPC:**
```bash
# Verify validator is running and RPC URL is correct in .env
curl http://localhost:8899 -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

### Build Issues

**Wrong Rust version:**
```bash
rustc --version  # Should show 1.79.0

# Force correct version
rustup override set 1.79.0
```

**pnpm install fails:**
```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules packages/*/node_modules
pnpm install
```

**Cargo build fails:**
```bash
# Clean and rebuild
cargo clean
cargo build
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
