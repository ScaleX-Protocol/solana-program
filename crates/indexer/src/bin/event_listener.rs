use futures::StreamExt;
use solana_client::{
    nonblocking::pubsub_client::PubsubClient,
    nonblocking::rpc_client::RpcClient,
    rpc_config::{RpcTransactionConfig, RpcTransactionLogsConfig, RpcTransactionLogsFilter},
};
use solana_sdk::{commitment_config::CommitmentConfig, pubkey::Pubkey, signature::Signature};
use solana_transaction_status::UiTransactionEncoding;
use std::str::FromStr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time;
use tracing::{error, info, warn};

/// Parse events from transaction logs
fn parse_events_from_logs(logs: &[String]) -> Vec<&str> {
    let mut found_events = Vec::new();

    for log_line in logs.iter() {
        if log_line.contains("Instruction: PlaceOrder") {
            found_events.push("PlaceOrder");
        } else if log_line.contains("Instruction: FillEvent")
            || log_line.contains("Instruction: Fill")
        {
            found_events.push("Fill");
        } else if log_line.contains("Instruction: CancelOrder") {
            found_events.push("CancelOrder");
        } else if log_line.contains("Instruction: SettleFunds") {
            found_events.push("SettleFunds");
        } else if log_line.contains("Instruction: ConsumeEvents") {
            found_events.push("ConsumeEvents");
        } else if log_line.contains("Instruction: CreateOpenOrdersAccount") {
            found_events.push("CreateOpenOrdersAccount");
        } else if log_line.contains("Instruction: CreateOpenOrdersIndexer") {
            found_events.push("CreateOpenOrdersIndexer");
        } else if log_line.contains("Instruction: CreateMarket") {
            found_events.push("CreateMarket");
        }
    }

    found_events
}

/// Backfill historical transactions
async fn backfill_history(
    rpc_client: &RpcClient,
    program_id: &Pubkey,
    events_processed: &Arc<AtomicU64>,
    db: &solana_openbook_indexer::Database,
) -> Result<u64, Box<dyn std::error::Error>> {
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("📜 Starting Historical Backfill");
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let backfill_start = Instant::now();
    let mut total_transactions = 0u64;
    let mut total_events = 0u64;
    let mut before_signature: Option<Signature> = None;
    let batch_size = 100;

    loop {
        // Get next batch of signatures
        let sigs = if let Some(before) = before_signature {
            rpc_client
                .get_signatures_for_address_with_config(
                    program_id,
                    solana_client::rpc_client::GetConfirmedSignaturesForAddress2Config {
                        before: Some(before),
                        until: None,
                        limit: Some(batch_size),
                        commitment: Some(CommitmentConfig::confirmed()),
                    },
                )
                .await?
        } else {
            rpc_client
                .get_signatures_for_address_with_config(
                    program_id,
                    solana_client::rpc_client::GetConfirmedSignaturesForAddress2Config {
                        before: None,
                        until: None,
                        limit: Some(batch_size),
                        commitment: Some(CommitmentConfig::confirmed()),
                    },
                )
                .await?
        };

        if sigs.is_empty() {
            info!("✅ Reached end of transaction history");
            break;
        }

        info!("📦 Processing batch of {} transactions...", sigs.len());

        // Process each signature in the batch
        for sig_info in &sigs {
            let sig = Signature::from_str(&sig_info.signature)?;

            // Fetch the transaction with support for versioned transactions
            let tx_config = RpcTransactionConfig {
                encoding: Some(UiTransactionEncoding::Json),
                commitment: Some(CommitmentConfig::confirmed()),
                max_supported_transaction_version: Some(0),
            };

            match rpc_client
                .get_transaction_with_config(&sig, tx_config)
                .await
            {
                Ok(tx) => {
                    total_transactions += 1;

                    // Extract logs from the transaction
                    if let Some(ref meta) = tx.transaction.meta {
                        // OptionSerializer wraps the value - need to extract it
                        let log_messages: Option<Vec<String>> = meta.log_messages.clone().into();
                        if let Some(logs) = log_messages {
                            // Log first few log lines for debugging
                            if !logs.is_empty() {
                                info!(
                                    "  📄 Tx {} has {} log lines",
                                    &sig_info.signature[..8],
                                    logs.len()
                                );
                                // Print first 5 log lines to see what we're getting
                                for (i, log_line) in logs.iter().take(5).enumerate() {
                                    info!("    L{}: {}", i + 1, log_line);
                                }
                            }

                            let events = parse_events_from_logs(&logs);

                            if !events.is_empty() {
                                total_events += events.len() as u64;
                                info!("  ⚡ Found events: {}", events.join(", "));

                                // Store events in database
                                let timestamp = sig_info.block_time.unwrap_or(0) * 1000; // Convert to ms
                                let slot = sig_info.slot;

                                for event_type in &events {
                                    // Log raw event
                                    if let Err(e) = db
                                        .log_event(
                                            event_type,
                                            None, // market_id - would need to parse from logs
                                            None, // user_address - would need to parse from logs
                                            &sig_info.signature,
                                            slot as i64,
                                            timestamp,
                                        )
                                        .await
                                    {
                                        warn!("Failed to log event: {}", e);
                                    }

                                    // Process event to extract structured data
                                    if let Err(e) =
                                        solana_openbook_indexer::event_processor::process_event(
                                            event_type,
                                            &tx,
                                            &sig_info.signature,
                                            slot,
                                            timestamp,
                                            &db,
                                        )
                                        .await
                                    {
                                        warn!("Failed to process event {}: {}", event_type, e);
                                    }
                                }

                                events_processed.fetch_add(events.len() as u64, Ordering::Relaxed);
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("⚠️  Failed to fetch transaction {}: {}", sig, e);
                }
            }

            // Rate limiting - small delay between transactions
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        // Update progress
        let elapsed = backfill_start.elapsed();
        let rate = total_transactions as f64 / elapsed.as_secs_f64();
        info!(
            "⏱️  Backfill progress: {} txs, {} events ({:.1} tx/sec)",
            total_transactions, total_events, rate
        );

        // Set up for next batch
        before_signature = Some(Signature::from_str(&sigs.last().unwrap().signature)?);

        // Small delay between batches to avoid overwhelming RPC
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let total_time = backfill_start.elapsed();
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("✅ Backfill Complete!");
    info!("📊 {} transactions processed", total_transactions);
    info!("⚡ {} events indexed", total_events);
    info!("⏱️  Total time: {:.1}s", total_time.as_secs_f64());
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    Ok(total_transactions)
}

#[tokio::main]
async fn main() {
    // Initialize tracing with detailed formatting
    tracing_subscriber::fmt()
        .with_target(false)
        .with_thread_ids(true)
        .with_line_number(true)
        .with_level(true)
        .init();

    dotenv::dotenv().ok();

    let rpc_url =
        std::env::var("SOLANA_RPC_URL").unwrap_or_else(|_| "http://localhost:8899".to_string());

    let ws_url =
        std::env::var("SOLANA_WS_URL").unwrap_or_else(|_| "ws://localhost:8900".to_string());

    let program_id = std::env::var("OPENBOOK_PROGRAM_ID")
        .unwrap_or_else(|_| "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb".to_string());

    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("🎧 Solana OpenBook Event Listener");
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("📡 RPC URL: {}", rpc_url);
    info!("🔌 WebSocket: {}", ws_url);
    info!("🔧 Program ID: {}", program_id);
    info!("🔍 Logging: Block-by-block tracking enabled");
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let pubkey = Pubkey::from_str(&program_id).expect("Invalid program ID");
    let rpc_client = Arc::new(RpcClient::new(rpc_url));

    // Counters for statistics
    let events_processed = Arc::new(AtomicU64::new(0));
    let blocks_indexed = Arc::new(AtomicU64::new(0));
    let current_slot = Arc::new(AtomicU64::new(0));

    // Spawn statistics logger
    let events_clone = events_processed.clone();
    let blocks_clone = blocks_indexed.clone();
    let slot_clone = current_slot.clone();
    let rpc_clone = rpc_client.clone();
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(10));
        loop {
            interval.tick().await;
            let events = events_clone.load(Ordering::Relaxed);
            let blocks = blocks_clone.load(Ordering::Relaxed);
            let slot = slot_clone.load(Ordering::Relaxed);

            // Get current chain slot for comparison
            let chain_slot = rpc_clone.get_slot().await.unwrap_or(0);
            let lag = if chain_slot > slot && slot > 0 {
                format!(" (lag: {} slots)", chain_slot - slot)
            } else {
                String::new()
            };

            info!(
                "📊 STATS: Block {} | {} blocks indexed | {} events processed{}",
                slot, blocks, events, lag
            );
        }
    });

    // Get initial slot
    match rpc_client.get_slot().await {
        Ok(slot) => {
            info!("✅ Connected to Solana");
            info!("🎯 Current slot: {}", slot);
            info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            current_slot.store(slot, Ordering::Relaxed);
        }
        Err(e) => {
            error!("❌ Failed to connect to Solana: {}", e);
            return;
        }
    }

    // Initialize database connection
    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:postgres@localhost:15432/openbook_indexer".to_string()
    });

    info!("💾 Connecting to database...");
    let db = match solana_openbook_indexer::Database::new(&database_url).await {
        Ok(db) => {
            info!("✅ Database connected");
            db
        }
        Err(e) => {
            error!("❌ Failed to connect to database: {}", e);
            error!("⚠️  Events will not be stored!");
            return;
        }
    };

    // First, scan and index all existing markets from on-chain data
    info!("");
    info!("🔍 Step 1: Scanning for existing OpenBook markets on-chain...");
    match solana_openbook_indexer::market_scanner::index_markets(&rpc_client, &pubkey, &db).await {
        Ok(count) => {
            info!("✅ Market scan complete: {} markets indexed", count);
        }
        Err(e) => {
            error!("❌ Market scan failed: {}", e);
            error!("⚠️  This may cause issues with order indexing!");
        }
    }
    info!("");

    // Backfill historical data
    info!("🔍 Step 2: Backfilling historical transactions...");
    match backfill_history(&rpc_client, &pubkey, &events_processed, &db).await {
        Ok(tx_count) => {
            info!("🎉 Historical backfill complete: {} transactions", tx_count);
        }
        Err(e) => {
            error!("❌ Backfill failed: {}", e);
            error!("⚠️  Continuing with real-time indexing only...");
        }
    }
    info!("");

    // Connect to WebSocket
    let client = match PubsubClient::new(&ws_url).await {
        Ok(c) => c,
        Err(e) => {
            error!("❌ Failed to connect to WebSocket: {}", e);
            return;
        }
    };

    let config = RpcTransactionLogsConfig {
        commitment: Some(CommitmentConfig::confirmed()),
    };

    let filter = RpcTransactionLogsFilter::Mentions(vec![pubkey.to_string()]);

    let (mut stream, _unsubscribe) = match client.logs_subscribe(filter, config).await {
        Ok(s) => s,
        Err(e) => {
            error!("❌ Failed to subscribe to logs: {}", e);
            return;
        }
    };

    info!("✅ Subscribed to OpenBook program logs");
    info!("🚀 Indexer is now running...");
    info!("");

    let mut last_slot: Option<u64> = None;
    let mut events_in_current_block = 0;
    let start_time = Instant::now();

    while let Some(log) = stream.next().await {
        let signature = log.value.signature;
        let slot = log.context.slot;

        // Update current slot tracker
        current_slot.store(slot, Ordering::Relaxed);

        // Check if we moved to a new block/slot
        if last_slot != Some(slot) {
            if let Some(prev_slot) = last_slot {
                if events_in_current_block > 0 {
                    info!(
                        "✅ BLOCK {} indexed - {} events processed",
                        prev_slot, events_in_current_block
                    );
                }
                blocks_indexed.fetch_add(1, Ordering::Relaxed);
            }

            // Log new block
            info!("🔷 NEW BLOCK: Slot {}", slot);
            last_slot = Some(slot);
            events_in_current_block = 0;
        }

        events_in_current_block += 1;
        events_processed.fetch_add(1, Ordering::Relaxed);

        // Log individual transaction
        info!("  📦 Transaction: {}", signature);

        // Parse logs for OpenBook events
        let logs = &log.value.logs;
        let found_events = parse_events_from_logs(logs);

        if !found_events.is_empty() {
            info!("    ⚡ Events: {}", found_events.join(", "));

            // Fetch full transaction to process events
            let sig = Signature::from_str(&signature).ok();
            if let Some(sig) = sig {
                let tx_config = RpcTransactionConfig {
                    encoding: Some(UiTransactionEncoding::Json),
                    commitment: Some(CommitmentConfig::confirmed()),
                    max_supported_transaction_version: Some(0),
                };

                match rpc_client
                    .get_transaction_with_config(&sig, tx_config)
                    .await
                {
                    Ok(tx) => {
                        let timestamp = tx.block_time.unwrap_or(0) * 1000;

                        // Log raw events
                        for event_type in &found_events {
                            if let Err(e) = db
                                .log_event(
                                    event_type,
                                    None,
                                    None,
                                    &signature,
                                    slot as i64,
                                    timestamp,
                                )
                                .await
                            {
                                warn!("Failed to log event: {}", e);
                            }

                            // Process event to extract structured data
                            if let Err(e) = solana_openbook_indexer::event_processor::process_event(
                                event_type, &tx, &signature, slot, timestamp, &db,
                            )
                            .await
                            {
                                warn!("Failed to process event {}: {}", event_type, e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to fetch transaction {}: {}", signature, e);
                    }
                }
            }
        }

        // Show periodic progress
        let total_events = events_processed.load(Ordering::Relaxed);
        if total_events % 100 == 0 {
            let elapsed = start_time.elapsed();
            let rate = total_events as f64 / elapsed.as_secs_f64();
            info!("");
            info!(
                "⏱️  PROGRESS: {} events in {:.1}s ({:.1} events/sec)",
                total_events,
                elapsed.as_secs_f64(),
                rate
            );
            info!("");
        }
    }

    warn!("⚠️  Stream ended unexpectedly");
}
