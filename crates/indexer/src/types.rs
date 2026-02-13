use serde::{Deserialize, Serialize};

// ============================================================================
// DATABASE TYPES (internal, snake_case)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: String,
    pub base_mint: String,
    pub quote_mint: String,
    pub symbol: String,
    pub base_decimals: i32,
    pub quote_decimals: i32,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub market_id: String,
    pub order_id: i64,
    pub user_address: String,
    pub side: String,
    pub order_type: String,
    pub price: i64,
    pub quantity: i64,
    pub filled: i64,
    pub status: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub market_id: String,
    pub price: i64,
    pub quantity: i64,
    pub side: String,
    pub timestamp: i64,
}

// ============================================================================
// API RESPONSE TYPES (frontend-compatible, camelCase)
// ============================================================================

/// Trading pair (subset of Market)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TradingPair {
    pub symbol: String,
    pub base_asset: String,
    pub quote_asset: String,
    pub pool_id: String,
    pub base_decimals: i32,
    pub quote_decimals: i32,
}

/// Full market data with liquidity and volume
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketResponse {
    pub symbol: String,
    pub base_asset: String,
    pub quote_asset: String,
    pub pool_id: String,
    pub base_decimals: i32,
    pub quote_decimals: i32,
    pub volume: String,
    pub volume_in_quote: String,
    pub latest_price: String,
    pub age: i64,
    pub bid_liquidity: String,
    pub ask_liquidity: String,
    pub total_liquidity_in_quote: String,
    pub created_at: i64,
}

/// Order response (Binance-compatible)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderResponse {
    pub symbol: String,
    pub order_id: String,
    pub order_list_id: i64,
    pub client_order_id: String,
    pub price: String,
    pub orig_qty: String,
    pub executed_qty: String,
    pub cumulative_quote_qty: String,
    pub status: String,
    pub time_in_force: String,
    #[serde(rename = "type")]
    pub order_type: String,
    pub side: String,
    pub stop_price: String,
    pub iceberg_qty: String,
    pub time: i64,
    pub update_time: i64,
    pub is_working: bool,
    pub orig_quote_order_qty: String,
}

/// Balance information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Balance {
    pub asset: String,
    pub free: String,
    pub locked: String,
}

/// Account information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountResponse {
    pub maker_commission: i32,
    pub taker_commission: i32,
    pub buyer_commission: i32,
    pub seller_commission: i32,
    pub can_trade: bool,
    pub can_withdraw: bool,
    pub can_deposit: bool,
    pub update_time: i64,
    pub account_type: String,
    pub balances: Vec<Balance>,
    pub permissions: Vec<String>,
}

/// 24hr ticker statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ticker24hr {
    pub symbol: String,
    pub price_change: String,
    pub price_change_percent: String,
    pub weighted_avg_price: String,
    pub prev_close_price: String,
    pub last_price: String,
    pub last_qty: String,
    pub bid_price: String,
    pub ask_price: String,
    pub open_price: String,
    pub high_price: String,
    pub low_price: String,
    pub volume: String,
    pub quote_volume: String,
    pub open_time: i64,
    pub close_time: i64,
    pub first_id: String,
    pub last_id: String,
    pub count: i64,
}

/// Trade response (Binance-compatible)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TradeResponse {
    pub id: String,
    pub price: String,
    pub qty: String,
    pub time: i64,
    pub is_buyer_maker: bool,
    pub is_best_match: bool,
}

// ============================================================================
// TRANSFORMATION HELPERS
// ============================================================================

impl Market {
    /// Extract base asset symbol from the full symbol (e.g., "BTC/USDT" -> "BTC")
    pub fn base_asset(&self) -> String {
        self.symbol
            .split('/')
            .next()
            .unwrap_or("UNKNOWN")
            .to_string()
    }

    /// Extract quote asset symbol from the full symbol (e.g., "BTC/USDT" -> "USDT")
    pub fn quote_asset(&self) -> String {
        self.symbol
            .split('/')
            .nth(1)
            .unwrap_or("UNKNOWN")
            .to_string()
    }

    /// Convert to TradingPair response
    pub fn to_trading_pair(&self) -> TradingPair {
        TradingPair {
            symbol: self.symbol.clone(),
            base_asset: self.base_asset(),
            quote_asset: self.quote_asset(),
            pool_id: self.id.clone(),
            base_decimals: self.base_decimals,
            quote_decimals: self.quote_decimals,
        }
    }

    /// Convert to full MarketResponse with calculated fields
    pub fn to_market_response(
        &self,
        volume: String,
        volume_in_quote: String,
        latest_price: String,
        bid_liquidity: String,
        ask_liquidity: String,
    ) -> MarketResponse {
        let now = chrono::Utc::now().timestamp_millis();
        let age = now - self.created_at;

        // Calculate total liquidity in quote
        let bid_liq = bid_liquidity.parse::<f64>().unwrap_or(0.0);
        let ask_liq = ask_liquidity.parse::<f64>().unwrap_or(0.0);
        let price = latest_price.parse::<f64>().unwrap_or(0.0);
        let total_liquidity = ((bid_liq + ask_liq) * price).to_string();

        MarketResponse {
            symbol: self.symbol.clone(),
            base_asset: self.base_asset(),
            quote_asset: self.quote_asset(),
            pool_id: self.id.clone(),
            base_decimals: self.base_decimals,
            quote_decimals: self.quote_decimals,
            volume,
            volume_in_quote,
            latest_price,
            age,
            bid_liquidity,
            ask_liquidity,
            total_liquidity_in_quote: total_liquidity,
            created_at: self.created_at,
        }
    }
}

impl Order {
    /// Convert to frontend-compatible OrderResponse
    pub fn to_order_response(&self, symbol: &str) -> OrderResponse {
        let side = match self.side.as_str() {
            "bid" => "BUY",
            "ask" => "SELL",
            _ => "UNKNOWN",
        };

        let order_type = self.order_type.to_uppercase();
        let status = self.status.to_uppercase();

        let price_str = self.price.to_string();
        let orig_qty_str = self.quantity.to_string();
        let executed_qty_str = self.filled.to_string();

        // Calculate cumulative quote quantity (executedQty * price)
        let cumulative_quote_qty = (self.filled * self.price).to_string();
        let orig_quote_order_qty = (self.quantity * self.price).to_string();

        OrderResponse {
            symbol: symbol.to_string(),
            order_id: self.order_id.to_string(),
            order_list_id: -1,
            client_order_id: self.order_id.to_string(),
            price: price_str,
            orig_qty: orig_qty_str,
            executed_qty: executed_qty_str,
            cumulative_quote_qty,
            status,
            time_in_force: "GTC".to_string(),
            order_type,
            side: side.to_string(),
            stop_price: "0".to_string(),
            iceberg_qty: "0".to_string(),
            time: self.timestamp,
            update_time: self.timestamp,
            is_working: self.status == "open",
            orig_quote_order_qty,
        }
    }
}

impl Trade {
    /// Convert to frontend-compatible TradeResponse
    pub fn to_trade_response(&self) -> TradeResponse {
        // In Binance API, isBuyerMaker means the buyer was the maker (passive side)
        // If side is 'buy', the taker bought (maker was selling), so isBuyerMaker = false
        // If side is 'sell', the taker sold (maker was buying), so isBuyerMaker = true
        let is_buyer_maker = self.side == "sell";

        TradeResponse {
            id: self.id.clone(),
            price: self.price.to_string(),
            qty: self.quantity.to_string(),
            time: self.timestamp,
            is_buyer_maker,
            is_best_match: true, // All trades are best match by default
        }
    }
}
