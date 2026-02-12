# 📚 Documentation Reorganized!

All documentation has been cleaned up and reorganized for clarity.

## What Changed

### Before
- ❌ 27 markdown files scattered everywhere
- ❌ Unclear which docs are current vs outdated
- ❌ No clear entry point
- ❌ Duplicate/conflicting information

### After
- ✅ Single clear entry point: **README.md**
- ✅ Organized into guides/, archive/, and reference docs
- ✅ Comprehensive docs index: **docs/README.md**
- ✅ 12 outdated files archived
- ✅ Clean hierarchy

## New Structure

```
openbook/
├── README.md                          ← START HERE! Main entry point
│
├── docs/
│   ├── README.md                      ← Documentation index
│   │
│   ├── guides/                        ← How-to guides (5 files)
│   │   ├── DEPLOYMENT_SUMMARY.md      ← What's deployed
│   │   ├── DEPLOYMENT_GUIDE.md        ← How to deploy
│   │   ├── QUICK_START.md             ← Get started fast
│   │   ├── VIEWING_ORDERS_GUIDE.md    ← View orders
│   │   └── LOCAL_DEPLOYMENT_SUCCESS.md
│   │
│   ├── archive/                       ← Old docs (12 files)
│   │   ├── COMPLETE_SETUP_GUIDE.md    ← Old setup guide
│   │   ├── SETUP_PROGRESS.md
│   │   └── ... (historical docs)
│   │
│   └── [reference docs]               ← Technical references (9 files)
│       ├── MONOREPO_README.md         ← Monorepo setup
│       ├── MIGRATION_COMPLETE.md      ← Migration details
│       ├── OPENBOOK_DEVELOPMENT.md    ← Development guide
│       ├── TOKEN_METADATA_GUIDE.md    ← Token metadata
│       ├── EVM_TO_SOLANA_TOKENS.md    ← EVM dev guide
│       ├── PROGRAMS_USED.md
│       └── ...
```

## Where to Find What

### 🚀 Getting Started
- **[README.md](../README.md)** - Quick start, common commands
- **[docs/MONOREPO_README.md](docs/MONOREPO_README.md)** - Complete setup guide

### 📗 How-To Guides
- **Deploy markets**: [docs/guides/DEPLOYMENT_GUIDE.md](docs/guides/DEPLOYMENT_GUIDE.md)
- **View deployed assets**: [docs/guides/DEPLOYMENT_SUMMARY.md](docs/guides/DEPLOYMENT_SUMMARY.md)
- **View orders**: [docs/guides/VIEWING_ORDERS_GUIDE.md](docs/guides/VIEWING_ORDERS_GUIDE.md)

### 🔧 Technical Reference
- **Monorepo structure**: [docs/MONOREPO_README.md](docs/MONOREPO_README.md)
- **OpenBook development**: [docs/OPENBOOK_DEVELOPMENT.md](docs/OPENBOOK_DEVELOPMENT.md)
- **Token metadata**: [docs/TOKEN_METADATA_GUIDE.md](docs/TOKEN_METADATA_GUIDE.md)
- **For EVM devs**: [docs/EVM_TO_SOLANA_TOKENS.md](docs/EVM_TO_SOLANA_TOKENS.md)

### 📦 Component Docs
- **Programs**: `programs/openbook-v2/README.md`
- **Scripts**: `packages/scripts/README.md`
- **Indexer**: `crates/indexer/README.md` + `crates/indexer/API.md`

### 🗄️ Historical/Archived
- **Old setup docs**: [docs/archive/](docs/archive/)
- **Development history**: [docs/archive/SETUP_PROGRESS.md](docs/archive/SETUP_PROGRESS.md)

## Documentation Index

See **[docs/README.md](docs/README.md)** for the complete index with links to all documentation.

## Quick Reference

### Most Important Docs (in order)

1. **[README.md](../README.md)** - Start here!
2. **[docs/MONOREPO_README.md](docs/MONOREPO_README.md)** - Full setup guide
3. **[docs/guides/DEPLOYMENT_SUMMARY.md](docs/guides/DEPLOYMENT_SUMMARY.md)** - What's deployed
4. **[docs/README.md](docs/README.md)** - Find everything else

### By Use Case

**I want to...**

- **Get started quickly**: [README.md](../README.md) → Quick Start section
- **Understand the monorepo**: [docs/MONOREPO_README.md](docs/MONOREPO_README.md)
- **Deploy markets**: [docs/guides/DEPLOYMENT_GUIDE.md](docs/guides/DEPLOYMENT_GUIDE.md)
- **Use the indexer**: [crates/indexer/README.md](../crates/indexer/README.md)
- **Learn OpenBook development**: [docs/OPENBOOK_DEVELOPMENT.md](docs/OPENBOOK_DEVELOPMENT.md)
- **Come from EVM background**: [docs/EVM_TO_SOLANA_TOKENS.md](docs/EVM_TO_SOLANA_TOKENS.md)

## Summary

✅ **Single source of truth**: README.md
✅ **Organized guides**: docs/guides/
✅ **Technical references**: docs/*.md
✅ **Historical docs**: docs/archive/
✅ **Component docs**: In respective directories

🎉 No more confusion about which docs to read!

---

*Last updated: February 12, 2026*
