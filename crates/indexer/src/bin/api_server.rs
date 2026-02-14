use axum::{
    body::Body,
    extract::{MatchedPath, Query, Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use solana_openbook_indexer::Database;
use std::sync::Arc;
use std::time::Instant;
use tower_http::cors::CorsLayer;
use tracing::{info, warn};
use chrono;

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

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost/solana_indexer".to_string());

    info!("🔌 Connecting to database...");
    let db = Database::new(&database_url)
        .await
        .expect("Failed to connect to database");
    info!("✅ Database connected successfully");

    let app_state = Arc::new(AppState { db });

    let app = Router::new()
        // Health check endpoint
        .route("/health", get(health_check))
        // All 15 endpoints
        .route("/api/kline", get(get_kline))
        .route("/api/sync-status", get(get_sync_status))
        .route("/api/depth", get(get_depth))
        .route("/api/depth-orders", get(get_depth_orders))
        .route("/api/trades", get(get_trades))
        .route("/api/ticker/24hr", get(get_ticker_24hr))
        .route("/api/ticker/price", get(get_ticker_price))
        .route("/api/allOrders", get(get_all_orders))
        .route("/api/openOrders", get(get_open_orders))
        .route("/api/pairs", get(get_pairs))
        .route("/api/markets", get(get_markets))
        .route("/api/cross-chain-deposits", get(get_cross_chain_deposits))
        .route("/api/token-mappings", get(get_token_mappings))
        .route("/api/account", get(get_account))
        .route("/api/lending/dashboard/:user", get(get_lending_dashboard))
        // Logging middleware
        .layer(middleware::from_fn(log_request_response))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let port = std::env::var("API_PORT").unwrap_or_else(|_| "42070".to_string());
    let addr = format!("0.0.0.0:{}", port);

    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("🚀 Solana OpenBook Indexer API Server");
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("📡 Listening on: http://{}", addr);
    info!("📊 API Endpoints: 15 (Ponder-compatible)");
    info!("🔍 Logging: Request/Response tracking enabled");
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    info!("");
    info!("Available endpoints:");
    info!("  GET /api/kline");
    info!("  GET /api/sync-status");
    info!("  GET /api/depth");
    info!("  GET /api/depth-orders");
    info!("  GET /api/trades");
    info!("  GET /api/ticker/24hr");
    info!("  GET /api/ticker/price");
    info!("  GET /api/allOrders");
    info!("  GET /api/openOrders");
    info!("  GET /api/pairs");
    info!("  GET /api/markets");
    info!("  GET /api/cross-chain-deposits");
    info!("  GET /api/token-mappings");
    info!("  GET /api/account");
    info!("  GET /api/lending/dashboard/:user");
    info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// ============================================================================
// LOGGING MIDDLEWARE
// ============================================================================

async fn log_request_response(req: Request, next: Next) -> Result<impl IntoResponse, StatusCode> {
    let start = Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = req
        .extensions()
        .get::<MatchedPath>()
        .map(|p| p.as_str().to_owned())
        .unwrap_or_else(|| uri.path().to_owned());

    // Log incoming request
    info!(
        "📥 REQUEST  {} {} {}",
        method,
        path,
        uri.query().map(|q| format!("?{}", q)).unwrap_or_default()
    );

    // Execute request
    let response = next.run(req).await;

    // Calculate duration
    let duration = start.elapsed();
    let status = response.status();

    // Log response with color coding based on status
    let status_emoji = if status.is_success() {
        "✅"
    } else if status.is_client_error() {
        "⚠️"
    } else if status.is_server_error() {
        "❌"
    } else {
        "ℹ️"
    };

    info!(
        "{} RESPONSE {} {} - {} ({:.2}ms)",
        status_emoji,
        method,
        path,
        status.as_u16(),
        duration.as_secs_f64() * 1000.0
    );

    Ok(response)
}

#[derive(Clone)]
struct AppState {
    db: Database,
}

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "solana-openbook-indexer",
        "timestamp": chrono::Utc::now().timestamp()
    }))
}

async fn get_kline(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Json<Vec<()>> {
    info!("🕯️  Fetching kline data: {:?}", params);
    Json(vec![])
}

async fn get_sync_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    info!("🔄 Fetching sync status");
    Json(serde_json::json!({
        "is_synced": true,
        "chain_id": 101,
        "indexed": {
            "timestamp": chrono::Utc::now().timestamp(),
            "block_number": 0
        }
    }))
}

async fn get_depth(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    // Accept both 'market' and 'symbol' parameters
    let symbol_or_id = params
        .get("market")
        .or_else(|| params.get("symbol"))
        .cloned()
        .unwrap_or_default();
    let limit = params
        .get("limit")
        .and_then(|l| l.parse::<i64>().ok())
        .unwrap_or(100);

    info!(
        "📊 Fetching depth for market/symbol: {}, limit: {}",
        symbol_or_id, limit
    );

    // Resolve symbol to market ID
    let market_id = match state.db.get_market_by_symbol(&symbol_or_id).await {
        Ok(Some(market)) => market.id,
        Ok(None) => {
            // Try using the input directly as market ID
            symbol_or_id.clone()
        }
        Err(e) => {
            warn!("Error resolving market: {}", e);
            symbol_or_id.clone()
        }
    };

    info!("📊 Resolved to market ID: {}", market_id);

    // Query database for order book depth
    match state.db.get_depth(&market_id, limit).await {
        Ok((bids, asks)) => {
            // Convert to price levels format
            let bids_formatted: Vec<Vec<String>> = bids
                .iter()
                .map(|(price, qty)| vec![price.to_string(), qty.to_string()])
                .collect();

            let asks_formatted: Vec<Vec<String>> = asks
                .iter()
                .map(|(price, qty)| vec![price.to_string(), qty.to_string()])
                .collect();

            Json(serde_json::json!({
                "lastUpdateId": chrono::Utc::now().timestamp_millis(),
                "bids": bids_formatted,
                "asks": asks_formatted
            }))
        }
        Err(e) => {
            warn!("Failed to fetch depth: {}", e);
            Json(serde_json::json!({
                "lastUpdateId": chrono::Utc::now().timestamp_millis(),
                "bids": [],
                "asks": []
            }))
        }
    }
}

async fn get_depth_orders(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    let symbol = params.get("symbol").cloned().unwrap_or_default();
    info!("📋 Fetching depth orders for symbol: {}", symbol);
    Json(serde_json::json!({
        "lastUpdateId": chrono::Utc::now().timestamp_millis(),
        "symbol": symbol,
        "bids": [],
        "asks": [],
        "summary": {
            "totalBidOrders": 0,
            "totalAskOrders": 0
        }
    }))
}

async fn get_trades(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let symbol = params.get("symbol").cloned();
    // Support both 'user' and 'address' parameters
    let user = params
        .get("user")
        .or_else(|| params.get("address"))
        .cloned();
    let limit = params
        .get("limit")
        .and_then(|l| l.parse::<i64>().ok())
        .unwrap_or(500);
    let order_by = params.get("orderBy").map(|s| s.as_str());

    info!(
        "💱 Fetching trades: symbol={:?}, user={:?}, limit={}, orderBy={:?}",
        symbol, user, limit, order_by
    );

    // If user is specified, get user trades
    if let Some(user_addr) = user {
        let market_id = if let Some(sym) = symbol {
            state
                .db
                .get_market_by_symbol(&sym)
                .await
                .ok()
                .flatten()
                .map(|m| m.id)
        } else {
            None
        };

        let trades = match state
            .db
            .get_user_trades(&user_addr, market_id.as_deref(), limit, order_by)
            .await
        {
            Ok(t) => t,
            Err(e) => {
                warn!("Failed to fetch user trades: {}", e);
                return Json(json!([]));
            }
        };

        let trade_responses: Vec<_> = trades.iter().map(|t| t.to_trade_response()).collect();

        return Json(json!(trade_responses));
    }

    // Otherwise get trades by symbol/market
    let market = if let Some(sym) = symbol {
        match state.db.get_market_by_symbol(&sym).await {
            Ok(Some(m)) => m,
            Ok(None) => {
                warn!("Market not found for symbol");
                return Json(json!([]));
            }
            Err(e) => {
                warn!("Failed to fetch market: {}", e);
                return Json(json!([]));
            }
        }
    } else {
        // No symbol or user specified, return empty
        return Json(json!([]));
    };

    let trades = match state.db.get_trades(&market.id, limit, order_by).await {
        Ok(t) => t,
        Err(e) => {
            warn!("Failed to fetch trades: {}", e);
            return Json(json!([]));
        }
    };

    let trade_responses: Vec<_> = trades.iter().map(|t| t.to_trade_response()).collect();

    Json(json!(trade_responses))
}

async fn get_ticker_24hr(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let symbol = params.get("symbol").cloned().unwrap_or_default();
    info!("📈 Fetching 24h ticker for: {}", symbol);

    let now = chrono::Utc::now().timestamp_millis();
    let twenty_four_hours_ago = now - (24 * 60 * 60 * 1000);

    // Get market to find best bid/ask
    let market = state.db.get_market_by_symbol(&symbol).await.ok().flatten();

    let (best_bid_str, best_ask_str, last_price_str) = match market {
        Some(m) => {
            let bid = state.db.get_best_bid(&m.id).await.unwrap_or(None);
            let ask = state.db.get_best_ask(&m.id).await.unwrap_or(None);
            let last = ask.or(bid).unwrap_or(0);
            (
                bid.map(|p| p.to_string())
                    .unwrap_or_else(|| "0".to_string()),
                ask.map(|p| p.to_string())
                    .unwrap_or_else(|| "0".to_string()),
                last.to_string(),
            )
        }
        None => ("0".to_string(), "0".to_string(), "0".to_string()),
    };

    Json(json!({
        "symbol": symbol,
        "priceChange": "0",
        "priceChangePercent": "0.00",
        "weightedAvgPrice": last_price_str,
        "prevClosePrice": last_price_str,
        "lastPrice": last_price_str,
        "lastQty": "0",
        "bidPrice": best_bid_str,
        "askPrice": best_ask_str,
        "openPrice": last_price_str,
        "highPrice": last_price_str,
        "lowPrice": last_price_str,
        "volume": "0",
        "quoteVolume": "0",
        "openTime": twenty_four_hours_ago,
        "closeTime": now,
        "firstId": "0",
        "lastId": "0",
        "count": 0
    }))
}

async fn get_ticker_price(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    let symbol = params.get("symbol").cloned().unwrap_or_default();
    info!("💰 Fetching price for: {}", symbol);
    Json(serde_json::json!({
        "symbol": symbol,
        "price": "0"
    }))
}

async fn get_all_orders(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    // Support both 'user' and 'address' parameters
    let user = params
        .get("user")
        .or_else(|| params.get("address"))
        .cloned()
        .unwrap_or_default();
    let market_or_symbol = params
        .get("market")
        .or_else(|| params.get("symbol"))
        .cloned();
    let limit = params
        .get("limit")
        .and_then(|l| l.parse::<i64>().ok())
        .unwrap_or(500);

    // Resolve symbol to market ID if needed
    let market_id = if let Some(ref m) = market_or_symbol {
        // Try to resolve as symbol first
        match state.db.get_market_by_symbol(m).await {
            Ok(Some(market)) => Some(market.id),
            Ok(None) => Some(m.clone()), // Use as-is if not found (might be market ID)
            Err(_) => Some(m.clone()),
        }
    } else {
        None
    };

    info!(
        "📜 Fetching all orders for user: {}, market: {:?}",
        user, market_id
    );

    let orders = match state
        .db
        .get_user_orders(&user, market_id.as_deref(), limit)
        .await
    {
        Ok(o) => o,
        Err(e) => {
            warn!("Failed to fetch orders: {}", e);
            return Json(json!([]));
        }
    };

    let mut order_responses = Vec::new();

    for order in orders {
        // Get market symbol
        let symbol = state
            .db
            .get_market_symbol(&order.market_id)
            .await
            .unwrap_or_else(|_| "UNKNOWN/UNKNOWN".to_string());

        order_responses.push(order.to_order_response(&symbol));
    }

    Json(json!(order_responses))
}

async fn get_open_orders(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    // Support both 'user' and 'address' parameters
    let user = params
        .get("user")
        .or_else(|| params.get("address"))
        .cloned();
    let market_or_symbol = params
        .get("market")
        .or_else(|| params.get("symbol"))
        .cloned();

    // Resolve symbol to market ID if needed
    let market_id = if let Some(ref m) = market_or_symbol {
        // Try to resolve as symbol first
        match state.db.get_market_by_symbol(m).await {
            Ok(Some(market)) => Some(market.id),
            Ok(None) => Some(m.clone()), // Use as-is if not found (might be market ID)
            Err(_) => Some(m.clone()),
        }
    } else {
        None
    };

    info!(
        "📝 Fetching open orders - user: {:?}, market: {:?}",
        user, market_id
    );

    let orders = match state
        .db
        .get_open_orders(market_id.as_deref(), user.as_deref())
        .await
    {
        Ok(o) => o,
        Err(e) => {
            warn!("Failed to fetch open orders: {}", e);
            return Json(json!([]));
        }
    };

    let mut order_responses = Vec::new();

    for order in orders {
        // Get market symbol
        let symbol = state
            .db
            .get_market_symbol(&order.market_id)
            .await
            .unwrap_or_else(|_| "UNKNOWN/UNKNOWN".to_string());

        order_responses.push(order.to_order_response(&symbol));
    }

    Json(json!(order_responses))
}

async fn get_pairs(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    info!("🔗 Fetching trading pairs");

    let markets = match state.db.get_markets(100).await {
        Ok(m) => m,
        Err(e) => {
            warn!("Failed to fetch pairs: {}", e);
            return Json(json!([]));
        }
    };

    let pairs: Vec<_> = markets.iter().map(|m| m.to_trading_pair()).collect();

    Json(json!(pairs))
}

async fn get_markets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit = params
        .get("limit")
        .and_then(|l| l.parse::<i64>().ok())
        .unwrap_or(100);

    info!("🏪 Fetching all markets, limit: {}", limit);

    let markets = match state.db.get_markets(limit).await {
        Ok(m) => m,
        Err(e) => {
            warn!("Failed to fetch markets: {}", e);
            return Json(json!([]));
        }
    };

    let mut market_responses = Vec::new();

    for market in markets {
        // Get calculated fields
        let bid_liquidity = state.db.get_bid_liquidity(&market.id).await.unwrap_or(0);
        let ask_liquidity = state.db.get_ask_liquidity(&market.id).await.unwrap_or(0);
        let best_bid = state.db.get_best_bid(&market.id).await.unwrap_or(None);
        let best_ask = state.db.get_best_ask(&market.id).await.unwrap_or(None);

        // Use best ask as latest price (or best bid if no ask)
        let latest_price = best_ask
            .or(best_bid)
            .map(|p| p.to_string())
            .unwrap_or_else(|| "0".to_string());

        // For now, volume is 0 (would need to track trades)
        let volume = "0".to_string();
        let volume_in_quote = "0".to_string();

        let response = market.to_market_response(
            volume,
            volume_in_quote,
            latest_price,
            bid_liquidity.to_string(),
            ask_liquidity.to_string(),
        );

        market_responses.push(response);
    }

    Json(json!(market_responses))
}

async fn get_cross_chain_deposits(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    let user = params.get("user").cloned().unwrap_or_default();
    info!("🌉 Fetching cross-chain deposits for: {}", user);
    Json(serde_json::json!({"items": []}))
}

async fn get_token_mappings(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    info!("🗺️  Fetching token mappings");
    Json(serde_json::json!({"items": []}))
}

async fn get_account(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    let address = params.get("address").cloned().unwrap_or_default();
    info!("👤 Fetching account info for: {}", address);

    let now = chrono::Utc::now().timestamp_millis();

    Json(serde_json::json!({
        "makerCommission": 10,      // 0.1%
        "takerCommission": 10,      // 0.1%
        "buyerCommission": 0,
        "sellerCommission": 0,
        "canTrade": true,
        "canWithdraw": true,
        "canDeposit": true,
        "updateTime": now,
        "accountType": "SPOT",
        "balances": [],
        "permissions": ["SPOT"]
    }))
}

async fn get_lending_dashboard(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(user): axum::extract::Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let chain_id = params.get("chainId");
    info!(
        "🏦 Fetching asset dashboard for: {} (chainId: {:?})",
        user, chain_id
    );

    // Get user's open orders
    let open_orders = match state.db.get_open_orders(None, Some(&user)).await {
        Ok(orders) => orders,
        Err(e) => {
            warn!("Failed to fetch open orders: {}", e);
            vec![]
        }
    };

    // Get user's open order value by asset
    let order_values = match state.db.get_user_open_order_value(&user).await {
        Ok(values) => values,
        Err(e) => {
            warn!("Failed to fetch order values: {}", e);
            vec![]
        }
    };

    // Get user's 24h trading volume
    let volume_24h = state.db.get_user_24h_volume(&user).await.unwrap_or(0);

    // Build supplies (open orders grouped by market) - EXACT frontend format
    let mut supplies = Vec::new();
    let now = chrono::Utc::now().timestamp_millis();

    for (symbol, locked_quote, locked_base) in &order_values {
        if *locked_base > 0 {
            supplies.push(json!({
                "id": format!("{}_{}", user, symbol),
                "asset": symbol.split('/').next().unwrap_or("UNKNOWN"),
                "assetAddress": "",
                "suppliedAmount": locked_base.to_string(),
                "currentValue": locked_base.to_string(),
                "apy": "0.00",
                "earnings": "0.00",
                "projectedEarnings": {
                    "hourly": "0.00",
                    "daily": "0.00",
                    "weekly": "0.00",
                    "monthly": "0.00"
                },
                "accruedYield": {
                    "amount": "0.00",
                    "value": "0.00",
                    "sinceTimestamp": now,
                    "duration": "0h"
                },
                "canWithdraw": true,
                "collateralUsed": "0.00",
                "utilizationRate": "0.00",
                "realTimeRates": {
                    "supplyAPY": "0.00",
                    "borrowAPY": "0.00",
                    "utilizationRate": "0.00"
                }
            }));
        }
        if *locked_quote > 0 {
            supplies.push(json!({
                "id": format!("{}_{}_quote", user, symbol),
                "asset": symbol.split('/').nth(1).unwrap_or("UNKNOWN"),
                "assetAddress": "",
                "suppliedAmount": locked_quote.to_string(),
                "currentValue": locked_quote.to_string(),
                "apy": "0.00",
                "earnings": "0.00",
                "projectedEarnings": {
                    "hourly": "0.00",
                    "daily": "0.00",
                    "weekly": "0.00",
                    "monthly": "0.00"
                },
                "accruedYield": {
                    "amount": "0.00",
                    "value": "0.00",
                    "sinceTimestamp": now,
                    "duration": "0h"
                },
                "canWithdraw": true,
                "collateralUsed": "0.00",
                "utilizationRate": "0.00",
                "realTimeRates": {
                    "supplyAPY": "0.00",
                    "borrowAPY": "0.00",
                    "utilizationRate": "0.00"
                }
            }));
        }
    }

    // Calculate total locked value
    let total_locked: i64 = order_values
        .iter()
        .map(|(_, quote, base)| quote + base)
        .sum();

    Json(json!({
        "supplies": supplies,
        "borrows": [],
        "availableToSupply": [],
        "availableToBorrow": [],
        "activityHistory": [],
        "interestRateParams": [],
        "assetConfigurations": [],
        "summary": {
            "totalSupplied": total_locked.to_string(),
            "totalBorrowed": "0.00",
            "netAPY": "0.00",
            "totalEarnings": "0.00",
            "healthFactor": "999999.00",
            "borrowingPower": "0.00"
        }
    }))
}
