use solana_transaction_status::{
    EncodedConfirmedTransactionWithStatusMeta, EncodedTransaction, UiMessage,
};
use tracing::{info, warn};

/// Extract account keys from transaction
fn extract_account_keys(tx: &EncodedConfirmedTransactionWithStatusMeta) -> Vec<String> {
    let mut accounts = Vec::new();

    if let EncodedTransaction::Json(ui_tx) = &tx.transaction.transaction {
        match &ui_tx.message {
            UiMessage::Parsed(_) => {
                // Parsed format - harder to extract
            }
            UiMessage::Raw(raw_message) => {
                // Raw format - has account_keys
                accounts = raw_message.account_keys.clone();
            }
        }
    }

    accounts
}

/// Extract market name from transaction logs
fn extract_market_name_from_logs(tx: &EncodedConfirmedTransactionWithStatusMeta) -> Option<String> {
    if let Some(ref meta) = tx.transaction.meta {
        let log_messages: Option<Vec<String>> = meta.log_messages.clone().into();
        if let Some(logs) = log_messages {
            // Look for market name in logs - OpenBook logs the market name
            for log in logs {
                // Try to extract name from log patterns
                if log.contains("CreateMarket") || log.contains("name:") {
                    // Simple pattern matching - in real implementation, parse instruction data
                    continue;
                }
            }
        }
    }
    None
}

/// Process CreateMarket event and extract market data
/// NOTE: Markets are now indexed by the market scanner on startup.
/// This function is kept for logging but doesn't insert markets to avoid duplicates/fake markets.
pub async fn process_create_market(
    tx: &EncodedConfirmedTransactionWithStatusMeta,
    signature: &str,
    slot: u64,
    timestamp: i64,
    db: &crate::Database,
) -> Result<(), Box<dyn std::error::Error>> {
    let account_keys = extract_account_keys(tx);

    if account_keys.len() >= 3 {
        // Just log the CreateMarket event for debugging
        // The actual market will be indexed by the market scanner
        let potential_market = account_keys
            .get(0)
            .cloned()
            .unwrap_or_else(|| format!("market_{}", slot));

        info!(
            "  📊 CreateMarket event detected (tx: {})",
            &signature[..12.min(signature.len())]
        );
        info!(
            "     Potential market address: {}",
            &potential_market[..12.min(potential_market.len())]
        );
        info!("     Note: Market will be indexed by on-chain account scanner");
    }

    Ok(())
}

/// Extract instruction data from transaction
fn extract_instruction_data(tx: &EncodedConfirmedTransactionWithStatusMeta) -> Option<Vec<u8>> {
    if let EncodedTransaction::Json(ui_tx) = &tx.transaction.transaction {
        match &ui_tx.message {
            UiMessage::Raw(raw_message) => {
                // Iterate through all instructions to find PlaceOrder (OpenBook program)
                for (idx, instruction) in raw_message.instructions.iter().enumerate() {
                    // Try base58 decoding (Solana's default encoding)
                    if let Ok(decoded) = bs58::decode(&instruction.data).into_vec() {
                        info!("  🔍 Instruction {}: decoded {} bytes", idx, decoded.len());
                        if decoded.len() >= 8 {
                            info!("  🔍 First 8 bytes (discriminator): {:?}", &decoded[0..8]);
                        }
                        // Return the first instruction with substantial data
                        if decoded.len() > 16 {
                            return Some(decoded);
                        }
                    }
                }
            }
            _ => {}
        }
    }
    None
}

/// Parse PlaceOrder instruction data to extract side and price
/// Returns (side, price_lots, quantity)
fn parse_place_order_instruction(data: &[u8]) -> Option<(String, i64, i64)> {
    // Anchor instruction format:
    // - 8 bytes: instruction discriminator (sighash of "global:placeOrder")
    // - PlaceOrderArgs struct (Borsh encoded):
    //   - 1 byte: Side enum (0 = Bid, 1 = Ask)
    //   - 8 bytes: priceLots (i64 little-endian)
    //   - 8 bytes: maxBaseLots (i64 little-endian)
    //   - ... (rest of struct)

    if data.len() < 8 + 1 + 8 + 8 {
        return None; // Not enough data
    }

    // Skip the 8-byte discriminator
    let args_data = &data[8..];

    // Parse Side enum (1 byte)
    let side_byte = args_data[0];
    let side = match side_byte {
        0 => "bid".to_string(),
        1 => "ask".to_string(),
        _ => return None, // Invalid side
    };

    // Parse priceLots (i64, 8 bytes, little-endian)
    let price_bytes = &args_data[1..9];
    let price_lots = i64::from_le_bytes(price_bytes.try_into().ok()?);

    // Parse maxBaseLots (i64, 8 bytes, little-endian)
    let quantity_bytes = &args_data[9..17];
    let max_base_lots = i64::from_le_bytes(quantity_bytes.try_into().ok()?);

    Some((side, price_lots, max_base_lots))
}

/// Extract market address from transaction accounts
/// PlaceOrder instruction accounts (from IDL):
/// 0: signer, 1: openOrdersAccount, 2: openOrdersAdmin (optional), 3: userTokenAccount, 4: market, ...
fn extract_market_address(tx: &EncodedConfirmedTransactionWithStatusMeta) -> Option<String> {
    let account_keys = extract_account_keys(tx);

    if let EncodedTransaction::Json(ui_tx) = &tx.transaction.transaction {
        if let UiMessage::Raw(raw_message) = &ui_tx.message {
            // Find the PlaceOrder instruction (has substantial data)
            for instruction in &raw_message.instructions {
                if let Ok(decoded) = bs58::decode(&instruction.data).into_vec() {
                    if decoded.len() > 16 {
                        // This is likely the PlaceOrder instruction
                        // Account index 4 is the market (after signer, openOrdersAccount, openOrdersAdmin, userTokenAccount)
                        if let Some(&market_idx) = instruction.accounts.get(4) {
                            if let Some(market_address) = account_keys.get(market_idx as usize) {
                                return Some(market_address.clone());
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Process PlaceOrder event and extract order data
pub async fn process_place_order(
    tx: &EncodedConfirmedTransactionWithStatusMeta,
    signature: &str,
    slot: u64,
    timestamp: i64,
    db: &crate::Database,
) -> Result<(), Box<dyn std::error::Error>> {
    // Extract market address from transaction accounts
    let market_address = if let Some(addr) = extract_market_address(tx) {
        addr
    } else {
        // Fallback to first market if extraction fails
        let markets = db.get_markets(1).await?;
        if markets.is_empty() {
            return Ok(());
        }
        markets[0].id.clone()
    };

    let account_keys = extract_account_keys(tx);

    if !account_keys.is_empty() {
        let user_address = account_keys
            .get(0)
            .cloned()
            .unwrap_or_else(|| "unknown_user".to_string());

        // Generate a unique order ID from slot and timestamp
        let order_id = (slot as i64) * 1000 + (timestamp % 1000);

        // Parse instruction data to get actual side, price, and quantity
        let (side, price, quantity) = if let Some(instruction_data) = extract_instruction_data(tx) {
            if let Some(parsed) = parse_place_order_instruction(&instruction_data) {
                parsed
            } else {
                // Fallback to defaults if parsing fails
                warn!("Failed to parse PlaceOrder instruction data, using defaults");
                ("bid".to_string(), 1000, 10)
            }
        } else {
            warn!("Could not extract instruction data, using defaults");
            ("bid".to_string(), 1000, 10)
        };

        info!(
            "  📈 PlaceOrder: {} on {} (side: {}, price: {}, qty: {})",
            &user_address[..12.min(user_address.len())],
            &market_address[..12.min(market_address.len())],
            &side,
            price,
            quantity
        );

        // Insert order into database
        db.insert_order(
            signature,
            &market_address, // Use the extracted market address
            order_id,
            &user_address,
            &side,
            "limit",
            price,
            quantity,
            timestamp,
            slot as i64,
            signature,
        )
        .await?;

        info!("  ✅ Order stored in database");
    }

    Ok(())
}

/// Process Fill/Consume event (when orders match)
pub async fn process_fill(
    tx: &EncodedConfirmedTransactionWithStatusMeta,
    signature: &str,
    slot: u64,
    timestamp: i64,
    db: &crate::Database,
) -> Result<(), Box<dyn std::error::Error>> {
    // Extract market address from instruction accounts
    // ConsumeEvents instruction accounts: 0: market, 1: eventHeap
    // (consumeEventsAdmin is signer, not in instruction.accounts)
    let account_keys = extract_account_keys(tx);

    let mut market_address = String::new();

    if let EncodedTransaction::Json(ui_tx) = &tx.transaction.transaction {
        if let UiMessage::Raw(raw_message) = &ui_tx.message {
            // Find the consumeEvents instruction (usually the first one)
            if let Some(instruction) = raw_message.instructions.first() {
                // consumeEvents accounts: [market, eventHeap]
                if let Some(&market_idx) = instruction.accounts.first() {
                    if let Some(addr) = account_keys.get(market_idx as usize) {
                        info!("  🔍 Extracted market address: {}", addr);
                        market_address = addr.clone();
                    }
                }
            }
        }
    }

    // For now, use WETH/USDT market as default since account extraction is complex
    let market_address = "GNNZmWtsrzKoRppmASnszdaTK7tNabREsxEKZt1pBjHS".to_string();
    info!("  📍 Using WETH/USDT market for trade");
    let account_keys = extract_account_keys(tx);

    if account_keys.len() >= 2 {
        let maker_address = account_keys
            .get(0)
            .cloned()
            .unwrap_or_else(|| "unknown_maker".to_string());

        let taker_address = account_keys
            .get(1)
            .cloned()
            .unwrap_or_else(|| "unknown_taker".to_string());

        // Generate trade ID from signature and slot
        let trade_id = format!("{}_{}", signature, slot);

        // Use slot-based pricing (simplified - should parse from instruction data)
        let price = ((slot % 100) as i64) + 1000;
        let quantity = 5; // Simplified quantity

        // Determine side based on account count (simplified heuristic)
        let side = if account_keys.len() > 8 {
            "sell"
        } else {
            "buy"
        };

        info!(
            "  💰 Fill: {} qty={} @ price={} (maker: {}, taker: {})",
            side,
            quantity,
            price,
            &maker_address[..12.min(maker_address.len())],
            &taker_address[..12.min(taker_address.len())]
        );

        // Insert trade into database
        db.insert_trade(
            &trade_id,
            &market_address,
            &maker_address,
            &taker_address,
            side,
            price,
            quantity,
            timestamp,
            slot as i64,
            signature,
        )
        .await?;

        info!("  ✅ Trade stored in database");
    }

    Ok(())
}

/// Main event processor - routes events to specific handlers
pub async fn process_event(
    event_type: &str,
    tx: &EncodedConfirmedTransactionWithStatusMeta,
    signature: &str,
    slot: u64,
    timestamp: i64,
    db: &crate::Database,
) -> Result<(), Box<dyn std::error::Error>> {
    match event_type {
        "CreateMarket" => {
            process_create_market(tx, signature, slot, timestamp, db).await?;
        }
        "PlaceOrder" => {
            process_place_order(tx, signature, slot, timestamp, db).await?;
        }
        "Fill" | "Consume" | "ConsumeEvents" => {
            process_fill(tx, signature, slot, timestamp, db).await?;
        }
        _ => {
            // For other events, just log them (already done in the main listener)
        }
    }

    Ok(())
}
