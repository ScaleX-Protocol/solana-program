# Documentation Index

Complete documentation for the OpenBook V2 Monorepo.

## Getting Started

- 📘 **[Monorepo Setup](MONOREPO_README.md)** - Complete setup instructions for the monorepo
- 📗 **[Migration Guide](MIGRATION_COMPLETE.md)** - How the monorepo was organized

## Guides

### Deployment & Usage

- 📗 **[Deployment Summary](guides/DEPLOYMENT_SUMMARY.md)** - Overview of deployed tokens and markets
- 📕 **[Deployment Guide](guides/DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
- 📙 **[Quick Start](guides/QUICK_START.md)** - Get up and running quickly
- 📘 **[Viewing Orders](guides/VIEWING_ORDERS_GUIDE.md)** - How to view and monitor orders

### Development

- 📗 **[OpenBook Development](OPENBOOK_DEVELOPMENT.md)** - Working with OpenBook V2
- 📕 **[Token Metadata](TOKEN_METADATA_GUIDE.md)** - Creating tokens with metadata
- 📙 **[EVM to Solana](EVM_TO_SOLANA_TOKENS.md)** - Guide for EVM developers
- 📘 **[Low Level Explanation](LOW_LEVEL_EXPLANATION.md)** - Deep dive into internals

### Reference

- 📗 **[Programs Used](PROGRAMS_USED.md)** - OpenBook and Metaplex program details
- 📕 **[Using Metaplex Locally](USING_METAPLEX_LOCALLY.md)** - Local Metaplex setup
- 📙 **[Start Validator with Metaplex](START_VALIDATOR_WITH_METAPLEX.md)** - Validator configuration

## Component Documentation

### Programs

Located in `programs/openbook-v2/`

- OpenBook V2 DEX program (Rust/Anchor)
- Program ID: `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`
- See `programs/openbook-v2/README.md` for details

### Scripts

Located in `packages/scripts/`

- Deployment scripts (TypeScript)
- Market interaction utilities
- Trading demos
- See `packages/scripts/README.md` for details

### Indexer

Located in `crates/indexer/`

- Event listener and REST API (Rust)
- PostgreSQL storage
- Real-time event processing
- API documentation: `crates/indexer/API.md`
- Logging: `crates/indexer/LOGGING.md`

## Quick Links

### Common Tasks

- [Deploy markets locally](guides/DEPLOYMENT_GUIDE.md#deploy-locally)
- [View market details](guides/VIEWING_ORDERS_GUIDE.md)
- [Create custom tokens](TOKEN_METADATA_GUIDE.md)
- [Set up the indexer](../crates/indexer/README.md)

### Troubleshooting

- [Validator issues](MONOREPO_README.md#troubleshooting)
- [pnpm problems](MONOREPO_README.md#pnpm-install-fails)
- [Rust compilation](MONOREPO_README.md#rust-compilation-issues)

## Archive

Historical documentation and outdated guides are in `docs/archive/`.

## Project Structure

```
docs/
├── README.md                        ← You are here
├── MONOREPO_README.md              ← Main setup guide
├── MIGRATION_COMPLETE.md           ← Monorepo migration details
│
├── guides/                         ← User guides
│   ├── DEPLOYMENT_SUMMARY.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── QUICK_START.md
│   └── VIEWING_ORDERS_GUIDE.md
│
├── archive/                        ← Historical docs
│   ├── COMPLETE_SETUP_GUIDE.md
│   ├── SETUP_PROGRESS.md
│   └── ...
│
└── [reference docs]                ← Technical references
    ├── OPENBOOK_DEVELOPMENT.md
    ├── TOKEN_METADATA_GUIDE.md
    ├── PROGRAMS_USED.md
    └── ...
```

## Contributing to Documentation

When adding new documentation:

1. Place guides in `docs/guides/`
2. Place reference docs in `docs/`
3. Update this index
4. Link from main `README.md` if relevant

## Need Help?

- Start with the [Monorepo Setup Guide](MONOREPO_README.md)
- Check the [main README](../README.md) for quick commands
- Browse [guides](guides/) for specific tasks
