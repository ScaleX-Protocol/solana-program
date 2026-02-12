# OpenBook V2 Setup Progress Tracker

**Started:** 2026-02-10

---

## Setup Steps Checklist

### ✅ Prerequisites
- [x] Node.js v20.11.0+ ✅ (v20.11.0)
- [x] Solana v1.18.23+ ✅ (1.18.23)
- [x] Rust v1.75.0+ ✅ (1.88.0)
- [x] Anchor v0.29.0+ ✅ (0.32.1)

### 📦 Step 1: Build OpenBook from Source
- [x] Navigate to openbook-v2 directory ✅
- [x] Run `anchor build` ✅ (binary compiled, IDL generation skipped)
- [x] Verify `target/deploy/openbook_v2.so` exists ✅ (822K)

### ⬇️ Step 2: Download Metaplex
- [x] Download Metaplex program to `/tmp/metaplex_token_metadata.so` ✅
- [x] Verify file exists ✅ (1.2M)

### 🔑 Step 3: Get OpenBook Program ID
- [x] Extract program ID from keypair ✅
- [x] Save program ID for later use ✅
- [x] **Program ID:** `3VLLZPvXG2XgjmHweHbuda622vMDBcAz4XjXsZtGKDZX`

### 🚀 Step 4: Start Validator
- [x] Set PATH for Solana binaries ✅
- [x] Kill existing validator ✅
- [x] Start validator with OpenBook + Metaplex programs ✅
- [x] Configure Solana CLI to localhost ✅ (http://localhost:8899)
- [x] Airdrop 100 SOL ✅ (Balance: 500000100 SOL)

### ✏️ Step 5: Update Scripts
- [x] Update `scripts-v2/localDeployFixed.ts` with program ID ✅
- [x] Verify changes saved ✅

### 🏪 Step 6: Deploy Markets with Tokens
- [x] Navigate to scripts-v2 ✅
- [x] Run `npm install` (if needed) ✅
- [x] Run `npm run deploy-local-fixed` ⚠️ (partial success)
- [x] Verify BTC, USDT, WETH tokens created ✅
  - BTC: 2epDRuyYoBGJkLZBx1dthwLtT2sgAHiYntdbJpkyUahw
  - USDT: HywwgYRMv7wKKDvd944gKe3eP4gZY5thENBTeYwVL8NJ
  - WETH: 374ZwESnweKZuuve4XHauTqGSoSFWV5jPLoJivqKdQvm
- [ ] Verify BTC/USDT and WETH/USDT markets created ❌ (error 4100 - constraint violation)

### 👀 Step 7: View Markets
- [x] Run `npm run view-markets` ✅
- [ ] Verify markets are visible ❌ (no markets found)

---

## Notes
- **Current Step:** Resolved Error 4100, New Issue: BPF Stack Overflow
- **Issues Encountered:**
  1. ✅ FIXED: Error 4100 (DeclaredProgramIdMismatch) - Updated source code program ID
  2. ❌ NEW: ProgramFailedToComplete - BPF stack overflow with Rust 1.88.0
  3. IDL build failed (not critical)
- **What Works:**
  - ✅ Validator running with correctly configured OpenBook + Metaplex
  - ✅ Tokens created successfully with proper metadata
  - ✅ Program ID mismatch resolved
  - ✅ Balance: 500000100 SOL
- **Current Blocker:**
  - BPF stack overflow: Functions exceed 4096-byte limit
  - Rust 1.88.0 generates larger stack frames than older versions
  - Need to either: downgrade Rust to 1.75.0, or use pre-built OpenBook binary

---

## Completion Summary
_To be filled upon completion_
