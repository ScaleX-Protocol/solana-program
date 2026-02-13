use deadpool_postgres::{Config, ManagerConfig, Pool, RecyclingMethod, Runtime};
use tokio_postgres::NoTls;

#[derive(Clone)]
pub struct Database {
    pool: Pool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self, Box<dyn std::error::Error>> {
        // Parse the database URL
        let config = database_url.parse::<tokio_postgres::Config>()?;

        let mut cfg = Config::new();
        cfg.dbname = config.get_dbname().map(|s| s.to_string());
        cfg.host = config.get_hosts().first().map(|h| match h {
            tokio_postgres::config::Host::Tcp(s) => s.clone(),
            #[cfg(unix)]
            tokio_postgres::config::Host::Unix(p) => p.to_string_lossy().to_string(),
        });
        cfg.port = config.get_ports().first().copied();
        cfg.user = config.get_user().map(|s| s.to_string());
        cfg.password = config
            .get_password()
            .map(|p| String::from_utf8_lossy(p).to_string());

        cfg.manager = Some(ManagerConfig {
            recycling_method: RecyclingMethod::Fast,
        });

        let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)?;

        Ok(Self { pool })
    }

    pub fn pool(&self) -> &Pool {
        &self.pool
    }

    // Insert or update market
    pub async fn upsert_market(
        &self,
        id: &str,
        base_mint: &str,
        quote_mint: &str,
        symbol: &str,
        base_decimals: i32,
        quote_decimals: i32,
        created_at: i64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO markets (id, base_mint, quote_mint, symbol, base_decimals, quote_decimals, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET updated_at = $8",
            &[&id, &base_mint, &quote_mint, &symbol, &base_decimals, &quote_decimals, &created_at, &chrono::Utc::now().timestamp_millis()],
        ).await?;

        Ok(())
    }

    // Insert order
    pub async fn insert_order(
        &self,
        id: &str,
        market_id: &str,
        order_id: i64,
        user_address: &str,
        side: &str,
        order_type: &str,
        price: i64,
        quantity: i64,
        timestamp: i64,
        slot: i64,
        signature: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO orders (id, market_id, order_id, user_address, side, order_type, price, quantity, filled, status, timestamp, slot, signature)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'open', $9, $10, $11)
             ON CONFLICT (market_id, order_id) DO UPDATE SET filled = orders.filled, status = orders.status",
            &[&id, &market_id, &order_id, &user_address, &side, &order_type, &price, &quantity, &timestamp, &slot, &signature],
        ).await?;

        Ok(())
    }

    // Log raw event
    pub async fn log_event(
        &self,
        event_type: &str,
        market_id: Option<&str>,
        user_address: Option<&str>,
        signature: &str,
        slot: i64,
        timestamp: i64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO events (event_type, market_id, user_address, signature, slot, timestamp, data)
             VALUES ($1, $2, $3, $4, $5, $6, NULL)
             ON CONFLICT (signature, event_type, slot) DO NOTHING",
            &[&event_type, &market_id, &user_address, &signature, &slot, &timestamp],
        ).await?;

        Ok(())
    }

    // Get order book depth
    pub async fn get_depth(
        &self,
        market_id: &str,
        limit: i64,
    ) -> Result<(Vec<(i64, i64)>, Vec<(i64, i64)>), Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        // Get bids (buy orders) - highest price first
        let bid_rows = client
            .query(
                "SELECT price, COALESCE(SUM(quantity - filled), 0)::bigint as total_quantity
             FROM orders
             WHERE market_id = $1 AND status = 'open' AND side = 'bid'
             GROUP BY price
             ORDER BY price DESC
             LIMIT $2",
                &[&market_id, &limit],
            )
            .await?;

        // Get asks (sell orders) - lowest price first
        let ask_rows = client
            .query(
                "SELECT price, COALESCE(SUM(quantity - filled), 0)::bigint as total_quantity
             FROM orders
             WHERE market_id = $1 AND status = 'open' AND side = 'ask'
             GROUP BY price
             ORDER BY price ASC
             LIMIT $2",
                &[&market_id, &limit],
            )
            .await?;

        let bids: Vec<(i64, i64)> = bid_rows
            .iter()
            .map(|row| (row.get::<_, i64>(0), row.get::<_, i64>(1)))
            .collect();

        let asks: Vec<(i64, i64)> = ask_rows
            .iter()
            .map(|row| (row.get::<_, i64>(0), row.get::<_, i64>(1)))
            .collect();

        Ok((bids, asks))
    }

    // Get all orders for a user
    pub async fn get_user_orders(
        &self,
        user_address: &str,
        market_id: Option<&str>,
        limit: i64,
    ) -> Result<Vec<crate::types::Order>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let rows = if let Some(market) = market_id {
            client.query(
                "SELECT id, market_id, order_id, user_address, side, order_type, price, quantity, filled, status, timestamp
                 FROM orders
                 WHERE user_address = $1 AND market_id = $2
                 ORDER BY timestamp DESC
                 LIMIT $3",
                &[&user_address, &market, &limit],
            ).await?
        } else {
            client.query(
                "SELECT id, market_id, order_id, user_address, side, order_type, price, quantity, filled, status, timestamp
                 FROM orders
                 WHERE user_address = $1
                 ORDER BY timestamp DESC
                 LIMIT $2",
                &[&user_address, &limit],
            ).await?
        };

        let orders = rows
            .iter()
            .map(|row| crate::types::Order {
                id: row.get(0),
                market_id: row.get(1),
                order_id: row.get(2),
                user_address: row.get(3),
                side: row.get(4),
                order_type: row.get(5),
                price: row.get(6),
                quantity: row.get(7),
                filled: row.get(8),
                status: row.get(9),
                timestamp: row.get(10),
            })
            .collect();

        Ok(orders)
    }

    // Get open orders
    pub async fn get_open_orders(
        &self,
        market_id: Option<&str>,
        user_address: Option<&str>,
    ) -> Result<Vec<crate::types::Order>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let rows = match (market_id, user_address) {
            (Some(market), Some(user)) => {
                client.query(
                    "SELECT id, market_id, order_id, user_address, side, order_type, price, quantity, filled, status, timestamp
                     FROM orders
                     WHERE market_id = $1 AND user_address = $2 AND status = 'open'
                     ORDER BY timestamp DESC",
                    &[&market, &user],
                ).await?
            }
            (Some(market), None) => {
                client.query(
                    "SELECT id, market_id, order_id, user_address, side, order_type, price, quantity, filled, status, timestamp
                     FROM orders
                     WHERE market_id = $1 AND status = 'open'
                     ORDER BY timestamp DESC",
                    &[&market],
                ).await?
            }
            (None, Some(user)) => {
                client.query(
                    "SELECT id, market_id, order_id, user_address, side, order_type, price, quantity, filled, status, timestamp
                     FROM orders
                     WHERE user_address = $1 AND status = 'open'
                     ORDER BY timestamp DESC",
                    &[&user],
                ).await?
            }
            (None, None) => {
                client.query(
                    "SELECT id, market_id, order_id, user_address, side, order_type, price, quantity, filled, status, timestamp
                     FROM orders
                     WHERE status = 'open'
                     ORDER BY timestamp DESC
                     LIMIT 1000",
                    &[],
                ).await?
            }
        };

        let orders = rows
            .iter()
            .map(|row| crate::types::Order {
                id: row.get(0),
                market_id: row.get(1),
                order_id: row.get(2),
                user_address: row.get(3),
                side: row.get(4),
                order_type: row.get(5),
                price: row.get(6),
                quantity: row.get(7),
                filled: row.get(8),
                status: row.get(9),
                timestamp: row.get(10),
            })
            .collect();

        Ok(orders)
    }

    // Get all markets
    pub async fn get_markets(
        &self,
        limit: i64,
    ) -> Result<Vec<crate::types::Market>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, base_mint, quote_mint, symbol, base_decimals, quote_decimals, created_at
             FROM markets
             ORDER BY created_at DESC
             LIMIT $1",
            &[&limit],
        ).await?;

        let markets = rows
            .iter()
            .map(|row| crate::types::Market {
                id: row.get(0),
                base_mint: row.get(1),
                quote_mint: row.get(2),
                symbol: row.get(3),
                base_decimals: row.get(4),
                quote_decimals: row.get(5),
                created_at: row.get(6),
            })
            .collect();

        Ok(markets)
    }

    // Get market by symbol or ID
    pub async fn get_market_by_symbol(
        &self,
        symbol: &str,
    ) -> Result<Option<crate::types::Market>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        // Try to find by symbol first, then by ID
        let rows = client.query(
            "SELECT id, base_mint, quote_mint, symbol, base_decimals, quote_decimals, created_at
             FROM markets
             WHERE symbol = $1 OR id = $1
             LIMIT 1",
            &[&symbol],
        ).await?;

        if let Some(row) = rows.first() {
            Ok(Some(crate::types::Market {
                id: row.get(0),
                base_mint: row.get(1),
                quote_mint: row.get(2),
                symbol: row.get(3),
                base_decimals: row.get(4),
                quote_decimals: row.get(5),
                created_at: row.get(6),
            }))
        } else {
            Ok(None)
        }
    }

    // Get total bid liquidity for a market
    pub async fn get_bid_liquidity(
        &self,
        market_id: &str,
    ) -> Result<i64, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let row = client
            .query_one(
                "SELECT COALESCE(SUM(quantity - filled), 0)::bigint
             FROM orders
             WHERE market_id = $1 AND status = 'open' AND side = 'bid'",
                &[&market_id],
            )
            .await?;

        Ok(row.get(0))
    }

    // Get total ask liquidity for a market
    pub async fn get_ask_liquidity(
        &self,
        market_id: &str,
    ) -> Result<i64, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let row = client
            .query_one(
                "SELECT COALESCE(SUM(quantity - filled), 0)::bigint
             FROM orders
             WHERE market_id = $1 AND status = 'open' AND side = 'ask'",
                &[&market_id],
            )
            .await?;

        Ok(row.get(0))
    }

    // Get best bid price
    pub async fn get_best_bid(
        &self,
        market_id: &str,
    ) -> Result<Option<i64>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let rows = client
            .query(
                "SELECT price
             FROM orders
             WHERE market_id = $1 AND status = 'open' AND side = 'bid'
             ORDER BY price DESC
             LIMIT 1",
                &[&market_id],
            )
            .await?;

        Ok(rows.first().map(|row| row.get(0)))
    }

    // Get best ask price
    pub async fn get_best_ask(
        &self,
        market_id: &str,
    ) -> Result<Option<i64>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let rows = client
            .query(
                "SELECT price
             FROM orders
             WHERE market_id = $1 AND status = 'open' AND side = 'ask'
             ORDER BY price ASC
             LIMIT 1",
                &[&market_id],
            )
            .await?;

        Ok(rows.first().map(|row| row.get(0)))
    }

    // Get symbol for a market ID
    pub async fn get_market_symbol(
        &self,
        market_id: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let rows = client
            .query(
                "SELECT symbol FROM markets WHERE id = $1 LIMIT 1",
                &[&market_id],
            )
            .await?;

        if let Some(row) = rows.first() {
            Ok(row.get(0))
        } else {
            Ok("UNKNOWN/UNKNOWN".to_string())
        }
    }

    // Insert trade
    pub async fn insert_trade(
        &self,
        id: &str,
        market_id: &str,
        maker_address: &str,
        taker_address: &str,
        side: &str,
        price: i64,
        quantity: i64,
        timestamp: i64,
        slot: i64,
        signature: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO trades (id, market_id, maker_address, taker_address, side, price, quantity, timestamp, slot, signature)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (signature, market_id, timestamp) DO NOTHING",
            &[&id, &market_id, &maker_address, &taker_address, &side, &price, &quantity, &timestamp, &slot, &signature],
        ).await?;

        Ok(())
    }

    // Get trades for a market
    pub async fn get_trades(
        &self,
        market_id: &str,
        limit: i64,
        order_by: Option<&str>,
    ) -> Result<Vec<crate::types::Trade>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        // Determine sort order (default: DESC for most recent first)
        let order_clause = match order_by {
            Some("asc") | Some("ASC") => "ORDER BY timestamp ASC",
            _ => "ORDER BY timestamp DESC",
        };

        let query = format!(
            "SELECT id, market_id, price, quantity, side, timestamp
             FROM trades
             WHERE market_id = $1
             {}
             LIMIT $2",
            order_clause
        );

        let rows = client.query(&query, &[&market_id, &limit]).await?;

        let trades = rows
            .iter()
            .map(|row| crate::types::Trade {
                id: row.get(0),
                market_id: row.get(1),
                price: row.get(2),
                quantity: row.get(3),
                side: row.get(4),
                timestamp: row.get(5),
            })
            .collect();

        Ok(trades)
    }

    // Get trades by user (maker or taker)
    pub async fn get_user_trades(
        &self,
        user_address: &str,
        market_id: Option<&str>,
        limit: i64,
        order_by: Option<&str>,
    ) -> Result<Vec<crate::types::Trade>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        // Determine sort order (default: DESC for most recent first)
        let order_clause = match order_by {
            Some("asc") | Some("ASC") => "ORDER BY timestamp ASC",
            _ => "ORDER BY timestamp DESC",
        };

        let rows = if let Some(market) = market_id {
            let query = format!(
                "SELECT id, market_id, price, quantity, side, timestamp
                 FROM trades
                 WHERE (maker_address = $1 OR taker_address = $1) AND market_id = $2
                 {}
                 LIMIT $3",
                order_clause
            );
            client
                .query(&query, &[&user_address, &market, &limit])
                .await?
        } else {
            let query = format!(
                "SELECT id, market_id, price, quantity, side, timestamp
                 FROM trades
                 WHERE maker_address = $1 OR taker_address = $1
                 {}
                 LIMIT $2",
                order_clause
            );
            client.query(&query, &[&user_address, &limit]).await?
        };

        let trades = rows
            .iter()
            .map(|row| crate::types::Trade {
                id: row.get(0),
                market_id: row.get(1),
                price: row.get(2),
                quantity: row.get(3),
                side: row.get(4),
                timestamp: row.get(5),
            })
            .collect();

        Ok(trades)
    }

    // Get user's open order value by asset
    pub async fn get_user_open_order_value(
        &self,
        user_address: &str,
    ) -> Result<Vec<(String, i64, i64)>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        // Get aggregated open order values grouped by market
        let rows = client.query(
            "SELECT
                m.symbol,
                m.base_mint,
                COALESCE(SUM(CASE WHEN o.side = 'bid' THEN (o.quantity - o.filled) * o.price ELSE 0 END), 0)::bigint as locked_quote,
                COALESCE(SUM(CASE WHEN o.side = 'ask' THEN (o.quantity - o.filled) ELSE 0 END), 0)::bigint as locked_base
             FROM orders o
             JOIN markets m ON o.market_id = m.id
             WHERE o.user_address = $1 AND o.status = 'open'
             GROUP BY m.symbol, m.base_mint",
            &[&user_address],
        ).await?;

        let values: Vec<(String, i64, i64)> = rows
            .iter()
            .map(|row| {
                (
                    row.get::<_, String>(0), // symbol
                    row.get::<_, i64>(2),    // locked_quote
                    row.get::<_, i64>(3),    // locked_base
                )
            })
            .collect();

        Ok(values)
    }

    // Get user's trading volume (24h)
    pub async fn get_user_24h_volume(
        &self,
        user_address: &str,
    ) -> Result<i64, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;

        let now = chrono::Utc::now().timestamp_millis();
        let twenty_four_hours_ago = now - (24 * 60 * 60 * 1000);

        let row = client
            .query_one(
                "SELECT COALESCE(SUM(quantity * price), 0)::bigint
             FROM trades
             WHERE (maker_address = $1 OR taker_address = $1)
               AND timestamp >= $2",
                &[&user_address, &twenty_four_hours_ago],
            )
            .await?;

        Ok(row.get(0))
    }
}
