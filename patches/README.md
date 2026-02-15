# OpenBook V2 Patches

## Stack Overflow Fix

**File**: `openbook-v2-stack-overflow-fix.patch`

**Problem**: BPF stack overflow during market creation
- Error: `Stack offset of 4360 exceeded max offset of 4096 by 264 bytes`
- Affects: `CreateMarket` instruction

**Solution**: Wrap large account structs in `Box<>` to move from stack to heap

### How to Apply

From the OpenBook V2 source directory:

```bash
cd programs/openbook-v2
patch -p1 < ../../patches/openbook-v2-stack-overflow-fix.patch
```

Or manually edit `programs/openbook-v2/src/accounts_ix/create_market.rs`:

```rust
// Change these two lines:
pub market_base_vault: Account<'info, TokenAccount>,
pub market_quote_vault: Account<'info, TokenAccount>,

// To:
pub market_base_vault: Box<Account<'info, TokenAccount>>,
pub market_quote_vault: Box<Account<'info, TokenAccount>>,
```

### Verification

After applying, rebuild and check for stack overflow warnings:

```bash
anchor build -- --features enable-gpl 2>&1 | grep -i "stack offset"
```

If the fix is applied correctly, you should see no CreateMarket stack overflow errors.
