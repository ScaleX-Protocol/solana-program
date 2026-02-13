-- Cleanup script to remove fake markets from the database
-- These markets are owned by System Program, not OpenBook program
-- Run this script before deploying the updated indexer

BEGIN;

-- Show current markets
SELECT 'Current markets in database:' as info;
SELECT id, symbol, base_mint, quote_mint FROM markets;

-- Delete fake markets (you identified these as owned by System Program)
DELETE FROM orders WHERE market_id IN (
    'HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt',
    '7iahzfPXQRxmuJW5TnYh51MXP4PLgq41JJUSZ2i8n5CB',
    'Dy3wRkoWG5phCTSsQS3YxkMqr8D9K28nrWbRXdNJvQ4W',
    'HdUZsHUxp6mcqBmEDahmZgW5jnLV5x6GWz5SNT2dh8ad'
);

DELETE FROM trades WHERE market_id IN (
    'HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt',
    '7iahzfPXQRxmuJW5TnYh51MXP4PLgq41JJUSZ2i8n5CB',
    'Dy3wRkoWG5phCTSsQS3YxkMqr8D9K28nrWbRXdNJvQ4W',
    'HdUZsHUxp6mcqBmEDahmZgW5jnLV5x6GWz5SNT2dh8ad'
);

DELETE FROM events WHERE market_id IN (
    'HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt',
    '7iahzfPXQRxmuJW5TnYh51MXP4PLgq41JJUSZ2i8n5CB',
    'Dy3wRkoWG5phCTSsQS3YxkMqr8D9K28nrWbRXdNJvQ4W',
    'HdUZsHUxp6mcqBmEDahmZgW5jnLV5x6GWz5SNT2dh8ad'
);

DELETE FROM markets WHERE id IN (
    'HDsWR5v5RrNcxc2wnP4anehG1Ub41UoGsmY7kaKFALyt',
    '7iahzfPXQRxmuJW5TnYh51MXP4PLgq41JJUSZ2i8n5CB',
    'Dy3wRkoWG5phCTSsQS3YxkMqr8D9K28nrWbRXdNJvQ4W',
    'HdUZsHUxp6mcqBmEDahmZgW5jnLV5x6GWz5SNT2dh8ad'
);

-- Show result
SELECT 'Markets after cleanup:' as info;
SELECT id, symbol, base_mint, quote_mint FROM markets;

COMMIT;

-- Verify cleanup
SELECT
    (SELECT COUNT(*) FROM markets) as markets_count,
    (SELECT COUNT(*) FROM orders) as orders_count,
    (SELECT COUNT(*) FROM trades) as trades_count,
    (SELECT COUNT(*) FROM events) as events_count;
