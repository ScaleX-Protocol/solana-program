-- OpenBook V2 Indexer Database Schema

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    base_mint TEXT NOT NULL,
    quote_mint TEXT NOT NULL,
    symbol TEXT NOT NULL,
    base_decimals INTEGER NOT NULL,
    quote_decimals INTEGER NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,

    UNIQUE(base_mint, quote_mint)
);

CREATE INDEX idx_markets_symbol ON markets(symbol);
CREATE INDEX idx_markets_created_at ON markets(created_at);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    market_id TEXT NOT NULL REFERENCES markets(id),
    order_id BIGINT NOT NULL,
    user_address TEXT NOT NULL,
    side TEXT NOT NULL, -- 'bid' or 'ask'
    order_type TEXT NOT NULL, -- 'limit', 'market', 'post_only', etc.
    price BIGINT NOT NULL,
    quantity BIGINT NOT NULL,
    filled BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL, -- 'open', 'filled', 'cancelled', 'expired'
    timestamp BIGINT NOT NULL,
    slot BIGINT NOT NULL,
    signature TEXT NOT NULL,

    UNIQUE(market_id, order_id)
);

CREATE INDEX idx_orders_market ON orders(market_id);
CREATE INDEX idx_orders_user ON orders(user_address);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_timestamp ON orders(timestamp);
CREATE INDEX idx_orders_market_status ON orders(market_id, status);
CREATE INDEX idx_orders_user_market ON orders(user_address, market_id);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    market_id TEXT NOT NULL REFERENCES markets(id),
    maker_order_id TEXT,
    taker_order_id TEXT,
    maker_address TEXT NOT NULL,
    taker_address TEXT NOT NULL,
    side TEXT NOT NULL, -- 'buy' or 'sell'
    price BIGINT NOT NULL,
    quantity BIGINT NOT NULL,
    timestamp BIGINT NOT NULL,
    slot BIGINT NOT NULL,
    signature TEXT NOT NULL,

    UNIQUE(signature, market_id, timestamp)
);

CREATE INDEX idx_trades_market ON trades(market_id);
CREATE INDEX idx_trades_maker ON trades(maker_address);
CREATE INDEX idx_trades_taker ON trades(taker_address);
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
CREATE INDEX idx_trades_market_timestamp ON trades(market_id, timestamp);

-- Events table (raw event log)
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    market_id TEXT,
    user_address TEXT,
    signature TEXT NOT NULL,
    slot BIGINT NOT NULL,
    timestamp BIGINT NOT NULL,
    data JSONB,

    UNIQUE(signature, event_type, slot)
);

CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_market ON events(market_id);
CREATE INDEX idx_events_user ON events(user_address);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_slot ON events(slot);

-- Indexer status table
CREATE TABLE IF NOT EXISTS indexer_status (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_processed_slot BIGINT NOT NULL,
    last_processed_signature TEXT NOT NULL,
    last_processed_timestamp BIGINT NOT NULL,
    total_events_processed BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL,

    CHECK (id = 1) -- Only allow one row
);

-- Insert initial status
INSERT INTO indexer_status (id, last_processed_slot, last_processed_signature, last_processed_timestamp, total_events_processed, updated_at)
VALUES (1, 0, '', 0, 0, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (id) DO NOTHING;
