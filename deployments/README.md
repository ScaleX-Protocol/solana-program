# Deployment Addresses

This directory contains deployment addresses for different networks.

## File Structure

```
deployments/
├── devnet.json          # Devnet deployments
├── mainnet.json         # Mainnet deployments
└── localnet.json        # Local test deployments
```

## Format

Each JSON file contains:

```json
{
  "network": "devnet",
  "lastUpdated": "2026-02-13T10:00:00Z",
  "deployments": [
    {
      "timestamp": "2026-02-13T10:00:00Z",
      "commit": "abc123...",
      "deployer": "wallet_address",
      "programs": {
        "openbook_v2": "program_id",
        "metaplex_metadata": "program_id"
      },
      "markets": [
        {
          "name": "BTC/USDT",
          "address": "market_address",
          "baseMint": "token_address",
          "quoteMint": "token_address"
        }
      ],
      "status": "active"
    }
  ]
}
```

## Usage

### Read Deployment Info

```typescript
import deployments from './deployments/devnet.json';

const latestDeployment = deployments.deployments[0];
const openbookProgram = latestDeployment.programs.openbook_v2;
```

### Update Deployment (via workflow)

The CI/CD workflows automatically update these files:
- Local deployment → `localnet.json`
- Devnet deployment → `devnet.json`
- Mainnet deployment → `mainnet.json`

## Helper Script

Use the provided script to query deployment information:

```bash
# Show latest devnet deployment
./scripts/get-deployment-info.sh -n devnet -l

# Show only program ID
./scripts/get-deployment-info.sh -n mainnet -p

# Show all devnet deployments
./scripts/get-deployment-info.sh -n devnet -a

# Show markets
./scripts/get-deployment-info.sh -n devnet -m
```

### Script Options

```
-n, --network NETWORK    Network to query (devnet, mainnet, localnet)
-l, --latest             Show only latest deployment
-a, --all                Show all deployments
-p, --program-id         Show only program ID
-m, --markets            Show market addresses
-h, --help               Show help message
```

## Automated Updates

The CI/CD workflows automatically update these files:

- **Local Deployment** → Updates `localnet.json`
- **Devnet Deployment** → Updates `devnet.json` and commits
- **Mainnet Deployment** → Updates `mainnet.json` and creates PR

### Workflow Behavior

#### Devnet
- Automatically commits to the branch
- Adds `[skip ci]` to prevent re-triggering
- Keeps deployment history

#### Mainnet
- Creates a pull request for review
- Requires approval before merging
- Includes deployment summary in PR
- Labels: `deployment`, `mainnet`, `production`

## Query Examples

### Get Latest Program ID

```bash
# For scripts/automation
PROGRAM_ID=$(./scripts/get-deployment-info.sh -n devnet -p)
echo "Using program: $PROGRAM_ID"
```

### Get Market Addresses

```bash
# List all markets
./scripts/get-deployment-info.sh -n devnet -m
```

### Verify Deployment

```bash
# Get program ID and verify on-chain
PROGRAM=$(./scripts/get-deployment-info.sh -n mainnet -p)
solana program show $PROGRAM --url https://api.mainnet-beta.solana.com
```

## Security Note

- These files are committed to git for transparency
- Private keys are NEVER stored here
- Only public addresses and program IDs
- Mainnet deployments require approval before commit
