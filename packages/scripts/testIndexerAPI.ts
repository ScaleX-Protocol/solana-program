/**
 * Example: How to query the indexer API
 *
 * Run this after starting the indexer:
 * Terminal 1: npm run indexer-api
 * Terminal 2: ts-node testIndexerAPI.ts
 */

const API_URL = "http://localhost:3000";

async function queryIndexer() {
  console.log("🔍 Testing Indexer API\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // 1. Get all markets
    console.log("1️⃣  Fetching markets...");
    const marketsRes = await fetch(`${API_URL}/markets`);
    const marketsData = await marketsRes.json();
    console.log(`   Found ${marketsData.markets.length} markets:`);
    marketsData.markets.forEach((m: any) => {
      console.log(`   - ${m.name}: ${m.address}`);
    });
    console.log("");

    // 2. Get all trades
    console.log("2️⃣  Fetching all trades...");
    const tradesRes = await fetch(`${API_URL}/trades?limit=10`);
    const tradesData = await tradesRes.json();
    console.log(`   Found ${tradesData.count} recent trades (total: ${tradesData.total})`);
    if (tradesData.trades.length > 0) {
      console.log("   Latest trade:");
      const latest = tradesData.trades[0];
      console.log(`   - Type: ${latest.type}`);
      console.log(`   - Market: ${latest.market}`);
      console.log(`   - Signature: ${latest.signature}`);
      console.log(`   - Time: ${new Date(latest.timestamp).toLocaleString()}`);
    }
    console.log("");

    // 3. Get statistics
    console.log("3️⃣  Fetching statistics...");
    const statsRes = await fetch(`${API_URL}/stats`);
    const statsData = await statsRes.json();
    console.log(`   Total transactions: ${statsData.totalTransactions}`);
    console.log(`   Total markets: ${statsData.totalMarkets}`);
    console.log("   By type:");
    Object.entries(statsData.byType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
    console.log("   By market:");
    Object.entries(statsData.byMarket).forEach(([name, count]) => {
      console.log(`   - ${name}: ${count}`);
    });
    console.log("");

    // 4. Get specific market trades (if markets exist)
    if (marketsData.markets.length > 0) {
      const market = marketsData.markets[0];
      console.log(`4️⃣  Fetching trades for ${market.name}...`);
      const marketTradesRes = await fetch(
        `${API_URL}/trades?market=${market.address}&limit=5`
      );
      const marketTradesData = await marketTradesRes.json();
      console.log(`   Found ${marketTradesData.count} trades for this market`);
      console.log("");

      // 5. Get market details
      console.log(`5️⃣  Fetching market details for ${market.name}...`);
      const marketDetailsRes = await fetch(`${API_URL}/market/${market.address}`);
      const marketDetails = await marketDetailsRes.json();
      console.log(`   Market: ${marketDetails.market.name}`);
      console.log(`   Base: ${marketDetails.market.baseMint}`);
      console.log(`   Quote: ${marketDetails.market.quoteMint}`);
      console.log(`   Total trades: ${marketDetails.tradesCount}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ API test completed!\n");
  } catch (error: any) {
    if (error.code === "ECONNREFUSED") {
      console.error("\n❌ Error: Cannot connect to indexer API");
      console.error("   Make sure the indexer is running:");
      console.error("   npm run indexer-api\n");
    } else {
      console.error("\n❌ Error:", error.message, "\n");
    }
  }
}

// Real-time monitoring example
async function monitorTrades(intervalMs = 3000) {
  console.log(`\n📊 Monitoring trades every ${intervalMs}ms...`);
  console.log("   Press Ctrl+C to stop\n");

  let lastCount = 0;

  setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/trades?limit=1`);
      const data = await res.json();

      if (data.total > lastCount) {
        const newTrades = data.total - lastCount;
        console.log(
          `🆕 ${newTrades} new trade(s)! Total: ${data.total} | Latest: ${data.trades[0]?.type || 'N/A'}`
        );
        lastCount = data.total;
      }
    } catch (error) {
      // Silent - API might not be ready yet
    }
  }, intervalMs);
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--monitor")) {
    await monitorTrades();
  } else {
    await queryIndexer();

    // Ask if user wants to monitor
    console.log("💡 Tip: Run with --monitor flag to watch for new trades:");
    console.log("   ts-node testIndexerAPI.ts --monitor\n");
  }
}

main().catch(console.error);
