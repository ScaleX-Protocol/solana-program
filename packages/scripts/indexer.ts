import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, BorshInstructionCoder, Wallet, Idl } from "@coral-xyz/anchor";
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";
import * as fs from "fs";
import * as path from "path";

// Configuration
const LOCAL_RPC = "http://127.0.0.1:8899";
const WS_RPC = "ws://127.0.0.1:8900"; // WebSocket endpoint
const OPENBOOK_PROGRAM = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

// In-memory database (you can replace with SQLite/Postgres)
interface Trade {
  signature: string;
  market: string;
  timestamp: number;
  slot: number;
  type: string;
  data: any;
}

interface Market {
  address: string;
  name: string;
  baseMint: string;
  quoteMint: string;
  timestamp: number;
}

class OpenbookIndexer {
  private connection: Connection;
  private trades: Trade[] = [];
  private markets: Map<string, Market> = new Map();
  private client: OpenBookV2Client | null = null;
  private instructionCoder: BorshInstructionCoder | null = null;

  constructor() {
    // Create connection with WebSocket support
    this.connection = new Connection(LOCAL_RPC, {
      commitment: "confirmed",
      wsEndpoint: WS_RPC,
    });
  }

  async initialize() {
    console.log("🔧 Initializing OpenBook Indexer...\n");

    // Setup Anchor provider
    process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;
    const keypairData = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8"));
    const authority = require("@solana/web3.js").Keypair.fromSecretKey(
      Uint8Array.from(keypairData)
    );
    const wallet = new Wallet(authority);
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: "confirmed",
    });

    // Initialize OpenBook client
    this.client = new OpenBookV2Client(provider, OPENBOOK_PROGRAM);

    // Load IDL for instruction parsing
    try {
      const idlPath = path.join(__dirname, "../node_modules/@openbook-dex/openbook-v2/target/idl/openbook_v2.json");
      if (fs.existsSync(idlPath)) {
        const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8")) as Idl;
        this.instructionCoder = new BorshInstructionCoder(idl);
      }
    } catch (err) {
      console.log("⚠️  Could not load IDL for instruction parsing");
    }

    // Load existing markets
    await this.loadMarkets();

    console.log("✅ Indexer initialized\n");
  }

  async loadMarkets() {
    console.log("📊 Loading existing markets...");

    try {
      const { findAllMarkets } = await import("@openbook-dex/openbook-v2");
      const keypairData = JSON.parse(
        fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
      );
      const authority = require("@solana/web3.js").Keypair.fromSecretKey(
        Uint8Array.from(keypairData)
      );
      const wallet = new Wallet(authority);
      const provider = new AnchorProvider(this.connection, wallet, {
        commitment: "confirmed",
      });

      const markets = await findAllMarkets(this.connection, OPENBOOK_PROGRAM, provider);

      for (const market of markets) {
        this.markets.set(market.market.toString(), {
          address: market.market.toString(),
          name: market.name || "Unknown",
          baseMint: market.baseMint.toString(),
          quoteMint: market.quoteMint.toString(),
          timestamp: market.timestamp * 1000,
        });
      }

      console.log(`✅ Loaded ${this.markets.size} markets\n`);
    } catch (err) {
      console.log("⚠️  No markets found yet\n");
    }
  }

  async startIndexing() {
    console.log("🚀 Starting real-time indexing...");
    console.log("📡 Listening to:", OPENBOOK_PROGRAM.toString());
    console.log("🔗 Endpoint:", LOCAL_RPC);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Subscribe to all OpenBook program logs
    const subscriptionId = this.connection.onLogs(
      OPENBOOK_PROGRAM,
      async (logs, context) => {
        await this.handleTransaction(logs.signature, context.slot);
      },
      "confirmed"
    );

    console.log(`✅ Subscription ID: ${subscriptionId}`);
    console.log("👀 Watching for transactions...\n");

    // Also subscribe to program account changes (for new markets)
    this.connection.onProgramAccountChange(
      OPENBOOK_PROGRAM,
      async (accountInfo, context) => {
        // Check if it's a new market account
        await this.checkForNewMarket(accountInfo.accountId, context.slot);
      },
      "confirmed",
      [
        {
          dataSize: 944, // Market account size (approximate)
        },
      ]
    );

    // Keep process alive
    process.on("SIGINT", () => {
      console.log("\n\n🛑 Stopping indexer...");
      this.connection.removeOnLogsListener(subscriptionId);
      this.printSummary();
      process.exit(0);
    });
  }

  private async handleTransaction(signature: string, slot: number) {
    try {
      // Fetch transaction details
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!tx) {
        console.log(`⚠️  Could not fetch transaction: ${signature}`);
        return;
      }

      // Parse instructions
      const instructions = tx.transaction.message.compiledInstructions;
      const accountKeys = tx.transaction.message.staticAccountKeys;

      for (const ix of instructions) {
        const programId = accountKeys[ix.programIdIndex];

        if (programId.equals(OPENBOOK_PROGRAM)) {
          const parsed = this.parseInstruction(ix.data, accountKeys, ix.accountKeyIndexes);

          // Store trade
          const trade: Trade = {
            signature,
            market: parsed.market || "unknown",
            timestamp: (tx.blockTime || Date.now() / 1000) * 1000,
            slot,
            type: parsed.type,
            data: parsed.data,
          };

          this.trades.push(trade);

          // Print to console
          this.printTrade(trade);
        }
      }
    } catch (err) {
      console.error(`❌ Error processing transaction ${signature}:`, err);
    }
  }

  private parseInstruction(data: Uint8Array, accountKeys: PublicKey[], accounts: number[]) {
    try {
      if (this.instructionCoder) {
        const decoded = this.instructionCoder.decode(Buffer.from(data));
        if (decoded) {
          return {
            type: decoded.name,
            data: decoded.data,
            market: accounts.length > 0 ? accountKeys[accounts[0]].toString() : null,
          };
        }
      }
    } catch (err) {
      // Fallback to basic parsing
    }

    // Basic instruction type detection
    const discriminator = data[0];
    const typeMap: { [key: number]: string } = {
      0: "PlaceOrder",
      1: "CancelOrder",
      2: "CreateMarket",
      3: "ConsumeEvents",
      4: "Deposit",
      5: "SettleFunds",
      // Add more as needed
    };

    return {
      type: typeMap[discriminator] || `Unknown(${discriminator})`,
      data: { raw: Array.from(data.slice(1, 10)) },
      market: accounts.length > 0 ? accountKeys[accounts[0]].toString() : null,
    };
  }

  private async checkForNewMarket(accountId: PublicKey, slot: number) {
    const address = accountId.toString();
    if (!this.markets.has(address)) {
      // Reload markets to check if this is a new market
      await this.loadMarkets();
      if (this.markets.has(address)) {
        const market = this.markets.get(address)!;
        console.log(`\n🆕 NEW MARKET DETECTED!`);
        console.log(`   Name: ${market.name}`);
        console.log(`   Address: ${market.address}`);
        console.log(`   Slot: ${slot}\n`);
      }
    }
  }

  private printTrade(trade: Trade) {
    const market = this.markets.get(trade.market);
    const marketName = market?.name || trade.market.slice(0, 8);
    const time = new Date(trade.timestamp).toLocaleTimeString();

    console.log(`📝 [${time}] ${trade.type.padEnd(15)} | ${marketName.padEnd(12)} | ${trade.signature.slice(0, 8)}...`);
  }

  private printSummary() {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 INDEXING SUMMARY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`Total transactions indexed: ${this.trades.length}`);
    console.log(`Total markets tracked: ${this.markets.size}\n`);

    // Group by type
    const byType = this.trades.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    console.log("By instruction type:");
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type.padEnd(20)}: ${count}`);
    });

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Save to file
    const output = {
      summary: {
        totalTransactions: this.trades.length,
        totalMarkets: this.markets.size,
        byType,
      },
      markets: Array.from(this.markets.values()),
      trades: this.trades,
    };

    const filename = `indexer-data-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    console.log(`💾 Data saved to: ${filename}\n`);
  }

  // API methods (for querying indexed data)
  getMarkets() {
    return Array.from(this.markets.values());
  }

  getTrades(marketAddress?: string) {
    if (marketAddress) {
      return this.trades.filter((t) => t.market === marketAddress);
    }
    return this.trades;
  }

  getTradesByType(type: string) {
    return this.trades.filter((t) => t.type === type);
  }
}

// Main execution
async function main() {
  const indexer = new OpenbookIndexer();
  await indexer.initialize();
  await indexer.startIndexing();

  // Keep process running
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
