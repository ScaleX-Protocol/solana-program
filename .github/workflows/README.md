# OpenBook CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing and deployment of the OpenBook V2 project, following the patterns from the clob-indexer base-sepolia workflow.

## 📋 Available Workflows

### 1. **CI Tests** (`openbook-ci-tests.yml`)

**Trigger:** Pull requests and pushes to `main`, `develop`, `devnet-deployment`

**Purpose:** Automated testing and code quality checks

**Jobs:**
- 🔍 **Rust Lint & Format Check** - Ensures code follows Rust formatting standards
- ✅ **Rust Tests** - Runs unit and doc tests
- 🔨 **Build Rust Programs** - Verifies programs compile successfully
- 📝 **TypeScript Lint & Format** - Type checking and code style
- ✅ **TypeScript Tests** - Runs TypeScript test suite
- 🔒 **Security Audit** - Scans for known vulnerabilities
- 🔗 **Integration Tests** - Full stack tests with local validator

**Usage:**
```bash
# Automatically runs on PR creation
# No manual intervention needed
```

### 2. **Local Development Deployment** (`openbook-local-deployment.yml`)

**Trigger:** Pushes to `main` or `develop`, or manual dispatch

**Purpose:** Deploy to local Solana test validator for development

**Features:**
- Downloads pre-built programs from devnet
- Starts local validator with OpenBook programs
- Deploys markets and tokens
- Runs integration tests
- Keeps validator running for development

**Requirements:**
- Self-hosted runner with label: `solana-dev`
- Solana CLI installed
- Rust toolchain 1.79.0

**Usage:**
```bash
# Runs automatically on push to main/develop
# Or trigger manually from GitHub Actions UI
```

**After Deployment:**
```bash
# Connect to the local validator
solana config set --url http://localhost:8899

# View deployed markets
cd packages/scripts && pnpm run view-markets

# Place test orders
pnpm run post-order
```

### 3. **Devnet Deployment** (`openbook-devnet-deployment.yml`)

**Trigger:** Push to `devnet-deployment` branch, or manual dispatch

**Purpose:** Deploy OpenBook programs and markets to Solana devnet

**Features:**
- Configurable build mode (use pre-built or build from source)
- Automatic airdrop for low balance
- Program deployment to devnet
- Market creation and setup
- Comprehensive deployment verification
- Generates deployment summary

**Required Secrets:**
- `SOLANA_DEPLOYER_PRIVATE_KEY` - Wallet private key (JSON array format)

**Manual Trigger Options:**
- `skip_build`: Choose to use pre-built programs or build from source

**Usage:**
```bash
# 1. Push to devnet-deployment branch
git checkout -b devnet-deployment
git push origin devnet-deployment

# 2. Or trigger manually from GitHub Actions UI
# Navigate to: Actions → OpenBook - Devnet Deployment → Run workflow
```

**Deployment Flow:**
1. ✅ Setup Rust (1.79.0) and Solana CLI (1.18.23)
2. ✅ Configure wallet and check balance
3. ✅ Download or build OpenBook programs
4. ✅ Deploy programs to devnet
5. ✅ Deploy markets and tokens
6. ✅ Verify deployment
7. ✅ Run post-deployment tests
8. ✅ Generate deployment summary

### 4. **Mainnet Deployment** (`openbook-mainnet-deployment.yml`)

**Trigger:** Manual dispatch only (with confirmation)

**Purpose:** Production deployment to Solana mainnet-beta

**⚠️ IMPORTANT SECURITY FEATURES:**
- Requires explicit confirmation: `"DEPLOY_TO_MAINNET"`
- Mandatory program buffer address
- Optional upgrade authority configuration
- Pre-flight security checks
- Verifiable builds
- Security audit before deployment
- Protected by GitHub environment: `mainnet`

**Required Secrets:**
- `MAINNET_DEPLOYER_PRIVATE_KEY` - Mainnet wallet (JSON format)
- `MAINNET_UPGRADE_AUTHORITY_KEY` - Upgrade authority (optional)

**Required Inputs:**
- `confirm_mainnet`: Must type `"DEPLOY_TO_MAINNET"`
- `program_buffer`: Program buffer address from build
- `upgrade_authority`: Upgrade authority address (optional)

**Pre-Deployment Checklist:**
1. ✅ Code reviewed and approved
2. ✅ Tests passing on all environments
3. ✅ Security audit completed
4. ✅ Sufficient SOL balance (>10 SOL recommended)
5. ✅ Backup of current program state
6. ✅ Rollback plan documented
7. ✅ Team notification sent
8. ✅ Monitoring systems ready

**Usage:**
```bash
# 1. Build the program locally first
cd programs/openbook-v2
anchor build --verifiable

# 2. Deploy buffer to mainnet
solana program deploy target/deploy/openbook_v2.so \
  --buffer /tmp/buffer-keypair.json \
  --url https://api.mainnet-beta.solana.com

# 3. Get the buffer address
# (Output from previous command)

# 4. Go to GitHub Actions → Mainnet Deployment → Run workflow
# - Enter: "DEPLOY_TO_MAINNET"
# - Enter buffer address
# - Enter upgrade authority (optional)
# - Click "Run workflow"
```

**Post-Deployment:**
1. Monitor program for 24 hours
2. Run smoke tests
3. Update documentation
4. Announce to community
5. Archive deployment record

## 🔧 Setup Instructions

### Prerequisites

1. **Self-Hosted Runners:**
   - `solana`: For devnet and mainnet deployments
   - `solana-dev`: For local development

2. **Required Tools on Runners:**
   ```bash
   # Solana CLI
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.23/install)"

   # Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default 1.79.0

   # Anchor
   cargo install --git https://github.com/coral-xyz/anchor --tag v0.28.0 anchor-cli --locked

   # Node.js and pnpm
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   npm install -g pnpm@8
   ```

3. **GitHub Secrets:**
   ```bash
   # Devnet deployment
   SOLANA_DEPLOYER_PRIVATE_KEY=[your,private,key,array]

   # Mainnet deployment (additional)
   MAINNET_DEPLOYER_PRIVATE_KEY=[your,mainnet,private,key]
   MAINNET_UPGRADE_AUTHORITY_KEY=[upgrade,authority,key]
   ```

### Setting Up Secrets

1. Generate a keypair:
   ```bash
   solana-keygen new --outfile ~/deployer-keypair.json
   ```

2. Get the private key:
   ```bash
   cat ~/deployer-keypair.json
   # Copy the array: [123,45,67,...]
   ```

3. Add to GitHub:
   - Go to: Settings → Secrets and variables → Actions
   - Click: New repository secret
   - Name: `SOLANA_DEPLOYER_PRIVATE_KEY`
   - Value: Paste the key array
   - Click: Add secret

### Configuring GitHub Environment

For mainnet protection, create a `mainnet` environment:

1. Go to: Settings → Environments
2. Click: New environment
3. Name: `mainnet`
4. Configure protection rules:
   - ✅ Required reviewers (select team members)
   - ✅ Wait timer: 5 minutes
   - ✅ Deployment branches: Only `main`

## 📊 Workflow Comparison with Base-Sepolia

| Feature | Base-Sepolia Indexer | OpenBook Workflows |
|---------|---------------------|-------------------|
| **Platform** | EVM (Ethereum L2) | Solana |
| **Language** | TypeScript/Ponder | Rust/TypeScript |
| **Deployment Target** | Docker containers | Solana programs |
| **Network Types** | Base Sepolia testnet | Localnet/Devnet/Mainnet |
| **Infrastructure** | Shared (PostgreSQL, Redis) | Solana validator |
| **Build Process** | Docker build | Anchor build/cargo |
| **Verification** | Container health checks | Program account checks |
| **Pre-built Option** | ✅ | ✅ |

## 🔄 Workflow Dependencies

```
CI Tests (on PR)
    ↓
Local Deployment (on merge to develop)
    ↓
Devnet Deployment (on devnet branch)
    ↓
Mainnet Deployment (manual, protected)
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Insufficient Balance**
```bash
# Solution: Airdrop SOL on devnet
solana airdrop 2 --url https://api.devnet.solana.com
```

#### 2. **Program Build Failure**
```bash
# Solution: Check Rust version
rustup default 1.79.0
rustup update

# Clean and rebuild
cargo clean
anchor build
```

#### 3. **Validator Not Starting**
```bash
# Solution: Kill existing validator
pkill -9 -f solana-test-validator

# Restart with reset
solana-test-validator --reset
```

#### 4. **Runner Connection Issues**
```bash
# Check runner status
cd ~/actions-runner
./run.sh

# View runner logs
tail -f ~/actions-runner/_diag/Runner_*.log
```

### Debug Mode

Enable debug logging in workflows:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

## 📈 Monitoring

### Deployment Metrics

Each workflow generates metrics:
- Build time
- Deployment duration
- Test pass rate
- Security audit results
- Gas/SOL costs

### Logs Location

- **CI Logs**: GitHub Actions UI
- **Deployment Records**: `DEVNET_DEPLOYMENT_*.md` / `MAINNET_DEPLOYMENT_*.md`
- **Local Validator**: `solana logs --url http://localhost:8899`

## 🔐 Security Best Practices

1. **Never commit private keys** - Always use GitHub Secrets
2. **Use separate wallets** - Different keys for devnet and mainnet
3. **Limit permissions** - Minimal access for deployment keys
4. **Enable 2FA** - For GitHub account and secrets access
5. **Review before merge** - All PRs require approval
6. **Audit regularly** - Run security audits on dependencies
7. **Monitor deployments** - Set up alerts for mainnet changes

## 📚 Additional Resources

- [Solana Program Deployment](https://docs.solana.com/cli/deploy-a-program)
- [Anchor Framework](https://www.anchor-lang.com/)
- [GitHub Actions Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [OpenBook V2 Documentation](../docs/)

## 🤝 Contributing

To add or modify workflows:

1. Test locally first
2. Create PR with workflow changes
3. Test on a separate branch
4. Document changes in this README
5. Get review from DevOps team

## 📝 Workflow Maintenance

### Regular Tasks

- **Weekly**: Review workflow run times
- **Monthly**: Update dependencies (Solana CLI, Anchor)
- **Quarterly**: Security audit of workflows
- **As Needed**: Update runner configurations

### Version Updates

When updating versions, update in:
1. Workflow `env` sections
2. This README
3. Project README
4. Documentation

---

**Last Updated:** 2026-02-13
**Maintainer:** DevOps Team
**Based on:** clob-indexer/base-sepolia workflow pattern
