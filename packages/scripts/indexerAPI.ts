import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";
import * as http from "http";
import * as fs from "fs";

// Configuration
const LOCAL_RPC = "http://127.0.0.1:8899";
const WS_RPC = "ws://127.0.0.1:8900";
const OPENBOOK_PROGRAM = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const API_PORT = 3000;

// In-memory database
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

class IndexerWithAPI {
  private connection: Connection;
  private trades: Trade[] = [];
  private markets: Map<string, Market> = new Map();
  private server: http.Server | null = null;

  constructor() {
    this.connection = new Connection(LOCAL_RPC, {
      commitment: "confirmed",
      wsEndpoint: WS_RPC,
    });
  }

  async initialize() {
    console.log("🔧 Initializing OpenBook Indexer with API...\n");
    await this.loadMarkets();
    this.startAPI();
    await this.startIndexing();
  }

  async loadMarkets() {
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
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const subscriptionId = this.connection.onLogs(
      OPENBOOK_PROGRAM,
      async (logs, context) => {
        await this.handleTransaction(logs.signature, context.slot);
      },
      "confirmed"
    );

    console.log(`✅ Indexing subscription ID: ${subscriptionId}\n`);
  }

  private async handleTransaction(signature: string, slot: number) {
    try {
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!tx) return;

      const instructions = tx.transaction.message.compiledInstructions;
      const accountKeys = tx.transaction.message.staticAccountKeys;

      for (const ix of instructions) {
        const programId = accountKeys[ix.programIdIndex];

        if (programId.equals(OPENBOOK_PROGRAM)) {
          const type = this.getInstructionType(ix.data[0]);
          const market = ix.accountKeyIndexes.length > 0
            ? accountKeys[ix.accountKeyIndexes[0]].toString()
            : "unknown";

          const trade: Trade = {
            signature,
            market,
            timestamp: (tx.blockTime || Date.now() / 1000) * 1000,
            slot,
            type,
            data: { discriminator: ix.data[0] },
          };

          this.trades.push(trade);

          const marketName = this.markets.get(market)?.name || market.slice(0, 8);
          console.log(`📝 ${type.padEnd(15)} | ${marketName.padEnd(12)} | ${signature.slice(0, 8)}...`);
        }
      }
    } catch (err) {
      console.error(`❌ Error processing ${signature}:`, err);
    }
  }

  private getInstructionType(discriminator: number): string {
    const types: { [key: number]: string } = {
      0: "PlaceOrder",
      1: "CancelOrder",
      2: "CreateMarket",
      3: "ConsumeEvents",
      4: "Deposit",
      5: "SettleFunds",
      6: "PlaceTakeOrder",
      7: "CancelAllOrders",
    };
    return types[discriminator] || `Unknown(${discriminator})`;
  }

  private startAPI() {
    this.server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Content-Type", "application/json");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url!, `http://localhost:${API_PORT}`);
      const path = url.pathname;

      try {
        // Route: GET /markets
        if (path === "/markets" && req.method === "GET") {
          const markets = Array.from(this.markets.values());
          res.writeHead(200);
          res.end(JSON.stringify({ markets }, null, 2));
          return;
        }

        // Route: GET /trades
        if (path === "/trades" && req.method === "GET") {
          const market = url.searchParams.get("market");
          const type = url.searchParams.get("type");
          const limit = parseInt(url.searchParams.get("limit") || "100");

          let filtered = this.trades;
          if (market) filtered = filtered.filter((t) => t.market === market);
          if (type) filtered = filtered.filter((t) => t.type === type);

          const result = filtered.slice(-limit).reverse();

          res.writeHead(200);
          res.end(
            JSON.stringify(
              {
                count: result.length,
                total: this.trades.length,
                trades: result,
              },
              null,
              2
            )
          );
          return;
        }

        // Route: GET /stats
        if (path === "/stats" && req.method === "GET") {
          const byType = this.trades.reduce((acc, t) => {
            acc[t.type] = (acc[t.type] || 0) + 1;
            return acc;
          }, {} as { [key: string]: number });

          const byMarket = this.trades.reduce((acc, t) => {
            const name = this.markets.get(t.market)?.name || "Unknown";
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          }, {} as { [key: string]: number });

          res.writeHead(200);
          res.end(
            JSON.stringify(
              {
                totalTransactions: this.trades.length,
                totalMarkets: this.markets.size,
                byType,
                byMarket,
              },
              null,
              2
            )
          );
          return;
        }

        // Route: GET /market/:address
        if (path.startsWith("/market/") && req.method === "GET") {
          const address = path.split("/")[2];
          const market = this.markets.get(address);

          if (!market) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: "Market not found" }));
            return;
          }

          const trades = this.trades.filter((t) => t.market === address);

          res.writeHead(200);
          res.end(
            JSON.stringify(
              {
                market,
                tradesCount: trades.length,
                recentTrades: trades.slice(-10).reverse(),
              },
              null,
              2
            )
          );
          return;
        }

        // Route: GET / (API documentation)
        if (path === "/" && req.method === "GET") {
          res.writeHead(200);
          res.end(
            JSON.stringify(
              {
                name: "OpenBook Indexer API",
                version: "1.0.0",
                endpoints: {
                  "GET /": "API documentation",
                  "GET /markets": "List all markets",
                  "GET /trades?market=<address>&type=<type>&limit=<n>": "List trades",
                  "GET /stats": "Get statistics",
                  "GET /market/:address": "Get market details with trades",
                },
                examples: {
                  allMarkets: `http://localhost:${API_PORT}/markets`,
                  allTrades: `http://localhost:${API_PORT}/trades`,
                  marketTrades: `http://localhost:${API_PORT}/trades?market=<address>`,
                  placeOrders: `http://localhost:${API_PORT}/trades?type=PlaceOrder`,
                  stats: `http://localhost:${API_PORT}/stats`,
                },
              },
              null,
              2
            )
          );
          return;
        }

        // 404
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: String(err) }));
      }
    });

    this.server.listen(API_PORT, () => {
      console.log("🌐 API Server started!");
      console.log(`📍 http://localhost:${API_PORT}`);
      console.log("\n📚 Available endpoints:");
      console.log(`   GET  http://localhost:${API_PORT}/markets`);
      console.log(`   GET  http://localhost:${API_PORT}/trades`);
      console.log(`   GET  http://localhost:${API_PORT}/stats`);
      console.log(`   GET  http://localhost:${API_PORT}/market/:address`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

    process.on("SIGINT", () => {
      console.log("\n\n🛑 Stopping indexer...");
      this.server?.close();
      process.exit(0);
    });
  }
}

// Main
async function main() {
  const indexer = new IndexerWithAPI();
  await indexer.initialize();
  await new Promise(() => {}); // Keep running
}

main().catch(console.error);
