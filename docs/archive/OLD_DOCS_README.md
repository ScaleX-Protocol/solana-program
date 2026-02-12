# Documentation Archive

This directory contains additional documentation and guides that provide more detail or document the development history.

---

## 📚 What's Here

### Reference Documentation

**LOCAL_DEPLOYMENT_SUCCESS.md**
- Documents the initial successful deployment
- Contains addresses and configuration details
- Useful as a reference for what was deployed

**LOW_LEVEL_EXPLANATION.md**
- Deep technical dive into how programs work
- Shows byte-level account structures
- Explains instruction building

**EVM_TO_SOLANA_TOKENS.md**
- Comprehensive guide for EVM developers
- Maps Solana concepts to Ethereum equivalents
- Architecture comparisons

---

### Development History

**DEPLOYMENT_GUIDE.md**
- Original deployment guide (before enhancements)

**QUICK_START.md**
- Original quick start guide

**SETUP_COMPLETE.md**
- Setup completion notes

**SETUP_STATUS.md**
- Initial setup status

---

### Enhancement Documentation

**ENHANCEMENT_SUMMARY.md**
- Summary of metadata enhancements made

**BEFORE_AFTER_COMPARISON.md**
- Code comparison before/after adding metadata

**TOKEN_METADATA_GUIDE.md**
- Technical guide to token metadata

---

### Concept Explanations

**START_VALIDATOR_WITH_METAPLEX.md**
- How to load Metaplex on local validator

**USING_METAPLEX_LOCALLY.md**
- Using Metaplex program concepts

**PROGRAMS_USED.md**
- Visual guide to programs used

**QUICK_VISUAL_SUMMARY.md**
- Visual diagrams and comparisons

**FILE_GUIDE.md**
- Guide to organizing documentation files

---

### Old Scripts

**deploy-local.sh**
- Original deployment script (before enhancements)
- Use `start-validator-full.sh` in root instead

---

## 🎯 What to Read

**For setup:** Go to root directory and read:
- `README.md` (quick reference)
- `COMPLETE_SETUP_GUIDE.md` (everything you need)

**For deep understanding:**
- `LOW_LEVEL_EXPLANATION.md` - How programs work at low level
- `EVM_TO_SOLANA_TOKENS.md` - For Ethereum developers

**For reference:**
- `LOCAL_DEPLOYMENT_SUCCESS.md` - Your deployment details

**Everything else:** Historical/supplementary documentation

---

## ✅ Organization

```
openbook/
├── README.md                    ← Start here!
├── COMPLETE_SETUP_GUIDE.md      ← Main guide
├── start-validator-full.sh      ← Startup script
│
├── docs/                        ← You are here
│   ├── README.md                ← This file
│   ├── LOCAL_DEPLOYMENT_SUCCESS.md
│   ├── LOW_LEVEL_EXPLANATION.md
│   ├── EVM_TO_SOLANA_TOKENS.md
│   └── ... (other reference docs)
│
├── openbook-v2/                 ← OpenBook source
└── scripts-v2/                  ← Your scripts
```

---

*Most users don't need to read files in this directory. The main README and COMPLETE_SETUP_GUIDE have everything you need!*
