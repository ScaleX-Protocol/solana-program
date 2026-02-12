# Shell Scripts

Automation scripts for deploying and managing OpenBook V2 DEX on Solana.

## 📁 Scripts

### `deploy.sh`
Deploys OpenBook V2 program and sets up markets with tokens.

**Features:**
- Downloads pre-built programs from devnet
- Starts local Solana test validator
- Deploys tokens with metadata (BTC, USDT, WETH)
- Creates trading markets (BTC/USDT, WETH/USDT)
- Validates deployment

**Usage:**
```bash
# Basic deployment (local)
bash shellscripts/deploy.sh

# Without resetting validator
RESET_VALIDATOR="false" bash shellscripts/deploy.sh

# Deploy to devnet
SOLANA_NETWORK="devnet" bash shellscripts/deploy.sh
```

**Environment Variables:**
- `SOLANA_RPC_URL` - RPC endpoint (default: http://127.0.0.1:8899)
- `SOLANA_NETWORK` - Network: localnet/devnet (default: localnet)
- `RESET_VALIDATOR` - Reset validator ledger (default: true)

---

### `populate-data.sh`
Populates markets with test trading activity.

**Features:**
- Places multiple test orders
- Supports buy/sell/both sides
- Shows order book after population
- Validates market state

**Usage:**
```bash
# Basic usage (10 orders, both sides)
bash shellscripts/populate-data.sh

# Place 20 orders
NUM_ORDERS=20 bash shellscripts/populate-data.sh

# Place only buy orders
ORDER_SIDE="buy" bash shellscripts/populate-data.sh

# Place only sell orders
ORDER_SIDE="sell" bash shellscripts/populate-data.sh
```

**Environment Variables:**
- `SOLANA_RPC_URL` - RPC endpoint (default: http://127.0.0.1:8899)
- `NUM_ORDERS` - Number of orders to place (default: 10)
- `ORDER_SIDE` - Order side: buy/sell/both (default: both)

---

## 🚀 Quick Start

### 1. Deploy Markets
```bash
bash shellscripts/deploy.sh
```

### 2. Populate Data
```bash
bash shellscripts/populate-data.sh
```

### 3. View Results
```bash
cd packages/scripts
pnpm view-markets
pnpm order-book
```

---

## 📋 Prerequisites

- Solana CLI 1.18.23
- Node.js ≥18
- pnpm ≥8
- Rust 1.79.0

---

## 🛠️ Advanced Usage

### Full Clean Deployment
```bash
# Stop validator, reset ledger, deploy fresh
pkill -9 -f solana-test-validator
bash shellscripts/deploy.sh
bash shellscripts/populate-data.sh
```

### Custom RPC
```bash
# Deploy to custom endpoint
SOLANA_RPC_URL="http://localhost:9000" bash shellscripts/deploy.sh
SOLANA_RPC_URL="http://localhost:9000" bash shellscripts/populate-data.sh
```

### Heavy Load Testing
```bash
# Place 100 orders
NUM_ORDERS=100 bash shellscripts/populate-data.sh
```

---

## 📊 Output Locations

- **Validator logs:** `packages/scripts/validator.log`
- **Deployment info:** Console output from `deploy.sh`
- **Market data:** Retrieved via `pnpm view-markets`

---

## ❓ Troubleshooting

### Validator won't start
```bash
pkill -9 -f solana-test-validator
bash shellscripts/deploy.sh
```

### Insufficient balance
```bash
solana airdrop 10 --url http://127.0.0.1:8899
```

### Markets not found
```bash
# Re-run deployment
RESET_VALIDATOR="true" bash shellscripts/deploy.sh
```

---

## 🔗 Related Commands

After running the scripts, use these pnpm commands in `packages/scripts`:

```bash
pnpm view-markets        # View all markets
pnpm order-book          # View order book
pnpm post-order          # Place single order
pnpm simple-trade        # Execute simple trade
pnpm trading-demo        # Run trading demo
pnpm deposit-withdraw    # Test deposit/withdraw
```
