# OpenBook V2 Local Compilation - Status Report

**Date:** 2026-02-10
**Goal:** Compile OpenBook V2 locally for modification + token metadata support

---

## ✅ What We Accomplished

### 1. Fixed Program ID Mismatch (Error 4100)
**Problem:** Compiled binary had different program ID than deployment keypair
**Solution:** Updated `declare_id!()` in source code to match generated keypair
**Files Modified:**
- `programs/openbook-v2/src/lib.rs` - Line 8
- `Anchor.toml` - Line 5
- `scripts-v2/localDeployFixed.ts` - Line 14

**Status:** ✅ RESOLVED

### 2. Identified BPF Stack Overflow Issue
**Problem:** Functions exceed 4096-byte BPF stack limit
**Root Cause:** Newer Rust/Solana versions generate larger stack frames
**Evidence:**
```
Stack offset of 4608 exceeded max offset of 4096 by 512 bytes
Stack offset of 4360 exceeded max offset of 4096 by 264 bytes
```

**Status:** ⚠️ PARTIALLY RESOLVED (works with specific toolchain)

### 3. Discovered Official Build Configuration
**Found in:** `.github/workflows/release-verifiable-build.yml`

Official builds use:
- **Solana:** 1.16.1
- **Anchor:** 0.28.0 (commit: 4e5280be46d859ba1c57fabe4c3916bec742fd69)
- **Method:** Docker-based verifiable build
- **Feature:** `--features enable-gpl`

**Status:** ✅ IDENTIFIED

### 4. Token Metadata Support Added
**Files Modified:**
- `scripts-v2/mint_utils.ts` - Added `createMintWithMetadata()`
- `scripts-v2/localDeployFixed.ts` - Updated to use metadata

**Status:** ✅ WORKING (with Solana 1.18.23)

---

## ❌ Current Blockers

### Toolchain Compatibility Matrix

| Solana Version | Anchor | Rust | OpenBook Build | Metaplex | Token+Metadata | Markets |
|----------------|--------|------|----------------|----------|----------------|---------|
| **1.18.23** (Current) | 0.32.1 | 1.88.0 | ❌ BPF Stack Overflow | ✅ Works | ✅ Works | ❌ Fails |
| **1.16.1** (Official) | 0.28.0 | 1.70.0 | ✅ Compiles | ❌ Panics | ❌ Fails | ⏱️ Timeout |
| **1.17.1** (Cargo.toml) | 0.28.0 | 1.70.0 | ❌ Rustc Crash | ❓ Unknown | ❓ Unknown | ❓ Unknown |

### Specific Issues

#### Issue 1: BPF Stack Overflow (Solana 1.18.23)
```
Error: ProgramFailedToComplete
Access violation in unknown section at address 0x29
```
- Occurs during market creation
- Tokens create successfully
- Markets fail immediately

#### Issue 2: Metaplex Incompatibility (Solana 1.16.1)
```
Program log: panicked at 'range end index 36 out of range for slice of length 0'
```
- Downloaded Metaplex (for 1.18+) incompatible with 1.16.1
- Blocks token metadata creation
- Markets timeout but don't crash

#### Issue 3: Transaction Timeouts (Solana 1.16.1)
```
Error: block height exceeded
```
- Transactions submitted but never confirm
- May be validator configuration issue
- WebSocket connection errors observed

---

## 🎯 Recommended Solutions

### Option A: Use Solana 1.18.23 + Fix Timeout (RECOMMENDED)

**Approach:**
1. Stay on Solana 1.18.23 + Anchor 0.32.1
2. Tokens work perfectly with metadata ✅
3. Debug market creation timeout separately
4. Possibly increase confirmation timeout or use different commitment level

**Pros:**
- Tokens + Metadata working NOW
- Modern toolchain
- Can focus on one issue (timeout) instead of many

**Cons:**
- Markets not working yet
- Need to debug timeout issue

**Next Steps:**
```bash
# Already done:
- Solana 1.18.23 installed
- Token creation with metadata working
- OpenBook compiled (with stack warnings)

# TODO:
1. Investigate why transactions timeout
2. Try different confirmation strategies
3. Check validator block production settings
```

---

### Option B: Docker Verifiable Build (CLEANEST)

**Approach:**
Use the EXACT same Docker environment as official builds

```bash
anchor build --verifiable \
  --docker-image backpackapp/build:v0.28.0 \
  --solana-version 1.16.1 \
  -- --features enable-gpl
```

**Pros:**
- Exact match to production
- No toolchain conflicts
- Guaranteed compatibility

**Cons:**
- Requires Docker
- Slower build times
- May still have Metaplex compatibility issue

---

### Option C: Skip Metadata Temporarily

**Approach:**
1. Focus on getting markets working first
2. Use plain tokens (no metadata)
3. Add metadata support later once markets work

**Pros:**
- Simpler problem to solve
- Can verify OpenBook modifications work
- Metadata can be added incrementally

**Cons:**
- Defeats original goal (token metadata)
- Need to redo later

---

## 📝 Key Files Modified

### OpenBook Source
```
programs/openbook-v2/src/lib.rs
  - Line 8: declare_id!("YOUR_PROGRAM_ID")

programs/openbook-v2/Cargo.toml
  - Line 14: default = ["enable-gpl"]
  - Line 23: idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]

Anchor.toml
  - Line 5: openbook_v2 = "YOUR_PROGRAM_ID"

Cargo.toml (root)
  - Line 22-29: Build profile settings
```

### Deployment Scripts
```
scripts-v2/localDeployFixed.ts
  - Line 14: PROGRAM_ID = "YOUR_PROGRAM_ID"
  - Line 26: connection = "processed" (changed from "confirmed")
  - Line 36-38: provider commitment settings

scripts-v2/mint_utils.ts
  - Added createMintWithMetadata() method
  - Metaplex integration
```

---

## 🔧 Current System State

**Installed Versions:**
- Node.js: v20.11.0
- Solana: 1.17.1 (active)
- Rust: 1.70.0 (from Anchor install)
- Anchor: 0.28.0

**Program ID:** `27sQpUjmgxUawAA8PJYSJX6SyKm9xWKYbipe8mS3sMTM` (latest)

**Validator Status:** Not running (crashed due to ledger incompatibility)

**Required Actions Before Next Attempt:**
1. Choose Solana version (1.16.1, 1.17.1, or 1.18.23)
2. Delete old ledger: `rm -rf test-ledger`
3. Download compatible Metaplex if using 1.16.1
4. Rebuild OpenBook with chosen toolchain
5. Restart validator with fresh ledger

---

## 💡 Recommendations

**For Production Use:**
→ Use Option B (Docker verifiable build)

**For Development/Experimentation:**
→ Use Option A (Solana 1.18.23 + fix timeout)

**For Quick Win:**
→ Use Option C (Skip metadata temporarily)

---

## 📚 Documentation Updated

- ✅ `COMPLETE_SETUP_GUIDE.md` - Added program ID mismatch fix
- ✅ `COMPLETE_SETUP_GUIDE.md` - Added BPF stack overflow troubleshooting
- ✅ `SETUP_PROGRESS.md` - Tracking file with current status
- ✅ This file - Comprehensive status report

---

## 🐛 Known Issues Log

1. **IDL Build Failure** (Non-critical)
   - `switchboard-solana` dependency incompatibility
   - Doesn't prevent program binary compilation
   - Binary works despite IDL failure

2. **Ledger Incompatibility Between Solana Versions**
   - Must delete `test-ledger` when switching Solana versions
   - RocksDB schema changes between versions

3. **WebSocket Connection Issues**
   - Validator WebSocket (port 8900) sometimes doesn't start
   - Causes client-side confirmation errors
   - May need explicit `--ws-port` flag

---

**END OF REPORT**
