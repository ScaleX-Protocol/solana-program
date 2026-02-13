# OpenBook CI/CD Quick Start Guide

## 🚀 Quick Deploy Commands

### Local Development
```bash
# Push to trigger local deployment
git push origin main

# Or manually trigger
# GitHub Actions → Local Development Deployment → Run workflow
```

### Devnet Deployment
```bash
# Create and push devnet branch
git checkout -b devnet-deployment
git push origin devnet-deployment

# Or manually trigger
# GitHub Actions → Devnet Deployment → Run workflow
```

### Mainnet Deployment
```bash
# ⚠️ PRODUCTION - Manual only
# 1. Go to: GitHub Actions → Mainnet Deployment → Run workflow
# 2. Enter: "DEPLOY_TO_MAINNET"
# 3. Provide program buffer address
# 4. Click: Run workflow
```

## 📋 Pre-Deployment Checklist

### For Devnet
- [ ] Code pushed to devnet-deployment branch
- [ ] CI tests passing
- [ ] SOLANA_DEPLOYER_PRIVATE_KEY secret configured
- [ ] Sufficient devnet SOL (2+ SOL)

### For Mainnet
- [ ] All tests passing on devnet
- [ ] Security audit completed
- [ ] Team approval received
- [ ] MAINNET_DEPLOYER_PRIVATE_KEY configured
- [ ] Sufficient mainnet SOL (10+ SOL)
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

## 🔑 Required Secrets

Add these in: `Settings → Secrets and variables → Actions`

```bash
# Devnet (required)
SOLANA_DEPLOYER_PRIVATE_KEY=[your,devnet,key,array]

# Mainnet (required for production)
MAINNET_DEPLOYER_PRIVATE_KEY=[your,mainnet,key,array]
MAINNET_UPGRADE_AUTHORITY_KEY=[upgrade,authority,key]
```

## 🏃 Self-Hosted Runner Setup

### Install Runner
```bash
# Download runner
mkdir ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Configure (get token from GitHub Settings → Actions → Runners)
./config.sh --url https://github.com/YOUR_ORG/openbook --token YOUR_TOKEN

# Add labels
./config.sh --labels solana,solana-dev

# Start runner
./run.sh
```

### Install Dependencies
```bash
# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.23/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default 1.79.0

# Anchor
cargo install --git https://github.com/coral-xyz/anchor \
  --tag v0.28.0 anchor-cli --locked

# Node.js & pnpm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm@8
```

## 🔧 Troubleshooting

### Issue: Low Balance
```bash
# Devnet airdrop
solana airdrop 2 --url https://api.devnet.solana.com

# Check balance
solana balance --url https://api.devnet.solana.com
```

### Issue: Build Fails
```bash
# Clean build
cargo clean
anchor clean

# Rebuild
anchor build
```

### Issue: Validator Won't Start
```bash
# Kill existing
pkill -9 -f solana-test-validator

# Restart
solana-test-validator --reset
```

### Issue: Workflow Stuck
```bash
# Check runner
cd ~/actions-runner
./run.sh

# View logs
tail -f ~/actions-runner/_diag/Runner_*.log
```

## 📊 Monitoring Deployments

### View Status
```bash
# Devnet program
solana program show opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb \
  --url https://api.devnet.solana.com

# Mainnet program
solana program show YOUR_PROGRAM_ID \
  --url https://api.mainnet-beta.solana.com
```

### View Logs
```bash
# Local validator
solana logs --url http://localhost:8899

# Devnet
solana logs --url https://api.devnet.solana.com
```

### Check Markets
```bash
cd packages/scripts

# View deployed markets
pnpm run view-markets

# Get market details
pnpm run get-markets
```

## 🚨 Emergency Procedures

### Rollback Mainnet Deployment
```bash
# 1. Get previous program buffer
solana program show YOUR_PROGRAM_ID --buffers

# 2. Upgrade to previous version
solana program deploy --program-id YOUR_PROGRAM_ID \
  --buffer PREVIOUS_BUFFER \
  --upgrade-authority AUTHORITY_KEYPAIR

# 3. Verify
solana program show YOUR_PROGRAM_ID
```

### Stop All Workflows
```bash
# Go to: GitHub Actions
# Click: Cancel workflow run (on each running workflow)
```

### Emergency Contacts
- DevOps Team: [Contact Info]
- Solana RPC Issues: [RPC Provider Support]
- GitHub Actions Support: [GitHub Support]

## 📈 Success Metrics

### Healthy Deployment Signs
- ✅ Build time: < 10 minutes
- ✅ Deployment time: < 5 minutes
- ✅ Test pass rate: 100%
- ✅ No security warnings
- ✅ Balance sufficient after deployment

### Warning Signs
- ⚠️ Build warnings
- ⚠️ Test failures
- ⚠️ Security vulnerabilities
- ⚠️ Low balance warnings
- ⚠️ Long deployment times

## 🎯 Common Workflows

### Daily Development
```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "Add feature"

# 3. Push and create PR
git push origin feature/my-feature

# 4. CI runs automatically
# 5. After approval, merge to main
# 6. Local deployment runs automatically
```

### Release to Devnet
```bash
# 1. Ensure main is stable
# 2. Create devnet deployment
git checkout -b devnet-deployment
git merge main
git push origin devnet-deployment

# 3. Workflow runs automatically
# 4. Verify deployment
cd packages/scripts
pnpm run view-markets
```

### Production Release
```bash
# 1. Test thoroughly on devnet
# 2. Get team approval
# 3. Build program locally
anchor build --verifiable

# 4. Create buffer
solana program write-buffer target/deploy/openbook_v2.so

# 5. Trigger mainnet workflow
# GitHub Actions → Mainnet → Run workflow
# - Enter: "DEPLOY_TO_MAINNET"
# - Enter: buffer address
# - Click: Run

# 6. Monitor deployment
# 7. Run smoke tests
# 8. Announce to community
```

## 📚 Resources

- [Full Documentation](./README.md)
- [OpenBook Docs](../../docs/)
- [Solana Docs](https://docs.solana.com)
- [Anchor Docs](https://www.anchor-lang.com)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

**Need Help?** Check the [full README](./README.md) or contact the DevOps team.
