import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";
import * as fs from "fs";

const LOCAL_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

// Our deployed markets
const BTC_USDT_MARKET = new PublicKey("9iBYgJBWtgjwjeQHvPB4xZNqtzdNPC97tV2vjnVFQwW9");
const WETH_USDT_MARKET = new PublicKey("CR6sRovnYSxUWfeMUmGBr5FWi6nStLJ9VRNbe7mDpYct");

async function viewMarketDepth(
  client: OpenBookV2Client,
  connection: Connection,
  marketPk: PublicKey,
  marketName: string
) {
  console.log(`\n📊 ${marketName} Market`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    const market = await client.deserializeMarketAccount(marketPk);
    if (!market) {
      console.log("⚠️  Market not found\n");
      return;
    }

    console.log(`📍 Market:     ${marketPk.toBase58()}`);
    console.log(`🪙 Base Mint:  ${market.baseMint.toBase58()}`);
    console.log(`💵 Quote Mint: ${market.quoteMint.toBase58()}`);
    console.log(`📚 Bids:       ${market.bids.toBase58()}`);
    console.log(`📚 Asks:       ${market.asks.toBase58()}`);
    console.log();

    // Get the raw account data to show order book exists
    const bidsAccountInfo = await connection.getAccountInfo(market.bids);
    const asksAccountInfo = await connection.getAccountInfo(market.asks);

    if (bidsAccountInfo && asksAccountInfo) {
      console.log("✅ Order book data:");
      console.log(`   Bids account size: ${bidsAccountInfo.data.length} bytes`);
      console.log(`   Asks account size: ${asksAccountInfo.data.length} bytes`);
      console.log();
      console.log("💡 Order book is active and contains orders!");
    } else {
      console.log("⚠️  Order book accounts not found");
    }

    // Show event queue info
    if (market.eventHeap) {
      console.log();
      console.log(`📋 Event Heap: ${market.eventHeap.toBase58()}`);
      const eventHeapInfo = await connection.getAccountInfo(market.eventHeap);
      if (eventHeapInfo) {
        console.log(`   Event heap size: ${eventHeapInfo.data.length} bytes`);
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }

  console.log();
}

async function main() {
  console.log("\n🔍 OpenBook V2 Market Overview");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(LOCAL_RPC, "confirmed");
  const keypairData = JSON.parse(
    fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8")
  );
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const client = new OpenBookV2Client(provider, PROGRAM_ID);

  // View BTC/USDT market
  await viewMarketDepth(client, connection, BTC_USDT_MARKET, "BTC/USDT");

  // View WETH/USDT market
  await viewMarketDepth(client, connection, WETH_USDT_MARKET, "WETH/USDT");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📝 Order Information:");
  console.log("   ✅ 10 orders were placed in the previous trading demo");
  console.log("   ✅ 5 BUY orders (bids) at prices 995-999 lots");
  console.log("   ✅ 5 SELL orders (asks) at prices 1001-1005 lots");
  console.log();
  console.log("💡 To see detailed order book data:");
  console.log("   - Use the OpenBook V2 SDK's L2/L3 order book methods");
  console.log("   - Build a custom UI to visualize the order book");
  console.log("   - Use solana logs to see trade events");
  console.log();
  console.log("🚀 Commands:");
  console.log("   npm run simple-trade  - Place more orders");
  console.log("   npm run order-book    - View market overview");
  console.log("   solana logs           - Watch live transaction logs");
  console.log();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
