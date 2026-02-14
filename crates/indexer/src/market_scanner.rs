use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use solana_account_decoder::UiAccountEncoding;
use solana_client::rpc_config::RpcAccountInfoConfig;
use solana_client::rpc_config::RpcProgramAccountsConfig;
use solana_client::rpc_filter::{RpcFilterType, Memcmp, MemcmpEncodedBytes};
use tracing::{info, warn};

/// OpenBook V2 Market account discriminator
/// First 8 bytes from actual market account on devnet
const MARKET_DISCRIMINATOR: [u8; 8] = [219, 190, 213, 55, 0, 227, 198, 154];

/// Market account structure (simplified - just what we need for indexing)
#[derive(Debug)]
pub struct MarketAccount {
    pub address: String,
    pub base_mint: String,
    pub quote_mint: String,
    pub name: String,
    pub base_decimals: i32,
    pub quote_decimals: i32,
}

/// Scan for all OpenBook V2 market accounts
pub async fn scan_markets(
    rpc_client: &RpcClient,
    program_id: &Pubkey,
) -> Result<Vec<MarketAccount>, Box<dyn std::error::Error>> {
    info!("🔍 Scanning for OpenBook V2 market accounts...");
    info!("   Program ID: {}", program_id);
    info!("   Discriminator (hex): {:02x?}", MARKET_DISCRIMINATOR);

    // First try: Get ALL program accounts without filters to see if we can fetch anything
    info!("🔍 Step 1: Fetching ALL program accounts (no filters)...");
    let all_accounts = rpc_client.get_program_accounts(program_id).await?;
    info!("✅ Total accounts owned by program: {}", all_accounts.len());

    if all_accounts.is_empty() {
        warn!("⚠️  No accounts found for this program at all!");
        return Ok(Vec::new());
    }

    // Log first few account sizes to debug
    for (i, (pubkey, account)) in all_accounts.iter().take(5).enumerate() {
        info!("   Account {}: {} - size: {} bytes, first 8 bytes: {:02x?}",
            i, pubkey, account.data.len(),
            if account.data.len() >= 8 { &account.data[0..8] } else { &[] });
    }

    // Now try with discriminator filter only (no data size filter)
    info!("");
    info!("🔍 Step 2: Filtering by discriminator only...");
    let filters = vec![
        RpcFilterType::Memcmp(Memcmp::new_base58_encoded(
            0, // offset: discriminator is at the start
            &MARKET_DISCRIMINATOR,
        )),
        // Removed DataSize filter to debug
    ];

    let config = RpcProgramAccountsConfig {
        filters: Some(filters),
        account_config: RpcAccountInfoConfig {
            encoding: Some(UiAccountEncoding::Base64),
            data_slice: None,
            commitment: None,
            min_context_slot: None,
        },
        with_context: None,
    };

    // Fetch all market accounts
    let accounts = rpc_client
        .get_program_accounts_with_config(program_id, config)
        .await?;

    info!("✅ Found {} accounts matching discriminator", accounts.len());

    let mut markets = Vec::new();

    for (pubkey, account) in accounts {
        // Verify the account is owned by the OpenBook program
        if account.owner != *program_id {
            warn!(
                "⚠️  Skipping {} - not owned by OpenBook program (owner: {})",
                pubkey, account.owner
            );
            continue;
        }

        // Parse market data
        match parse_market_account(&account.data, &pubkey.to_string()) {
            Ok(market) => {
                info!(
                    "  📊 Market: {} - {} (base: {}, quote: {})",
                    pubkey.to_string(),
                    market.name,
                    &market.base_mint[..8],
                    &market.quote_mint[..8]
                );
                markets.push(market);
            }
            Err(e) => {
                warn!("⚠️  Failed to parse market {}: {}", pubkey, e);
            }
        }
    }

    info!("✅ Successfully parsed {} markets", markets.len());
    Ok(markets)
}

/// Parse market account data
fn parse_market_account(
    data: &[u8],
    address: &str,
) -> Result<MarketAccount, Box<dyn std::error::Error>> {
    // OpenBook V2 Market structure (simplified offsets based on the Rust struct):
    // - 8 bytes: discriminator
    // - 32 bytes: admin
    // - 32 bytes: market_authority (PDA)
    // - 32 bytes: bids (pubkey)
    // - 32 bytes: asks (pubkey)
    // - 32 bytes: event_heap (pubkey)
    // - 8 bytes: oracle_a (Option<Pubkey> - 1 byte enum + 32 bytes if Some)
    // - 8 bytes: oracle_b
    // - 32 bytes: collect_fee_admin
    // - 32 bytes: open_orders_admin (Option)
    // - 32 bytes: consume_events_admin (Option)
    // - 32 bytes: close_market_admin (Option)
    // - 16 bytes: name (fixed array)
    // - 32 bytes: base_mint
    // - 32 bytes: quote_mint
    // ... more fields

    if data.len() < 500 {
        return Err("Account data too small to be a market".into());
    }

    // Verify discriminator
    if &data[0..8] != MARKET_DISCRIMINATOR {
        return Err("Invalid market discriminator".into());
    }

    // Parse name at offset ~400 (after all the pubkeys and options)
    // The actual offset depends on the exact struct layout
    // For OpenBook V2, the name is 16 bytes at a specific offset
    let name_offset = 8 + // discriminator
        32 + // admin
        32 + // market_authority
        32 + // bids
        32 + // asks
        32 + // event_heap
        33 + // oracle_a (Option<Pubkey>: 1 + 32)
        33 + // oracle_b
        33 + // collect_fee_admin (Option)
        33 + // open_orders_admin (Option)
        33 + // consume_events_admin (Option)
        33; // close_market_admin (Option)

    let name_bytes = if data.len() > name_offset + 16 {
        &data[name_offset..name_offset + 16]
    } else {
        &[0u8; 16]
    };

    let name = String::from_utf8_lossy(name_bytes)
        .trim_end_matches('\0')
        .to_string();

    // Base mint is after name
    let base_mint_offset = name_offset + 16;
    let base_mint = if data.len() > base_mint_offset + 32 {
        Pubkey::try_from(&data[base_mint_offset..base_mint_offset + 32])
            .map(|p| p.to_string())
            .unwrap_or_else(|_| "unknown".to_string())
    } else {
        "unknown".to_string()
    };

    // Quote mint is after base mint
    let quote_mint_offset = base_mint_offset + 32;
    let quote_mint = if data.len() > quote_mint_offset + 32 {
        Pubkey::try_from(&data[quote_mint_offset..quote_mint_offset + 32])
            .map(|p| p.to_string())
            .unwrap_or_else(|_| "unknown".to_string())
    } else {
        "unknown".to_string()
    };

    Ok(MarketAccount {
        address: address.to_string(),
        base_mint,
        quote_mint,
        name: if name.is_empty() {
            format!("Market-{}", &address[..8])
        } else {
            name
        },
        base_decimals: 8, // Default - could fetch from token mint
        quote_decimals: 6, // Default - could fetch from token mint
    })
}

/// Index all markets into the database
pub async fn index_markets(
    rpc_client: &RpcClient,
    program_id: &Pubkey,
    db: &crate::Database,
) -> Result<usize, Box<dyn std::error::Error>> {
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("📊 Market Scanner - Indexing Real OpenBook Markets");
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let markets = scan_markets(rpc_client, program_id).await?;

    if markets.is_empty() {
        info!("⚠️  No markets found on-chain");
        return Ok(0);
    }

    info!("");
    info!("💾 Storing {} markets in database...", markets.len());

    let mut indexed_count = 0;
    let timestamp = chrono::Utc::now().timestamp_millis();

    for market in markets {
        match db
            .upsert_market(
                &market.address,
                &market.base_mint,
                &market.quote_mint,
                &market.name,
                market.base_decimals,
                market.quote_decimals,
                timestamp,
            )
            .await
        {
            Ok(_) => {
                indexed_count += 1;
                info!("  ✅ {} - {}", market.name, market.address);
            }
            Err(e) => {
                warn!("  ❌ Failed to store {}: {}", market.address, e);
            }
        }
    }

    info!("");
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("✅ Market Indexing Complete");
    info!("📊 {} markets indexed successfully", indexed_count);
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    Ok(indexed_count)
}
