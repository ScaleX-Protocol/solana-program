import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client, findAllMarkets } from "@openbook-dex/openbook-v2";
import * as fs from "fs";

const LOCAL_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

async function main() {
  console.log("📊 OpenBook V2 Local Markets\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(LOCAL_RPC, "confirmed");
  const keypairData = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  console.log("🔍 Fetching markets...\n");
  const markets = await findAllMarkets(connection, PROGRAM_ID, provider);

  if (markets.length === 0) {
    console.log("⚠️  No markets found");
    return;
  }

  console.log(`✅ Found ${markets.length} market(s):\n`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  markets.forEach((m: any, i: number) => {
    console.log(`${i + 1}. ${m.name || "Unknown"}`);
    console.log(`   📍 Market Address: ${m.market}`);
    console.log(`   🪙 Base Mint:      ${m.baseMint}`);
    console.log(`   💵 Quote Mint:     ${m.quoteMint}`);
    console.log(`   ⏰ Created:        ${new Date(m.timestamp * 1000).toLocaleString()}`);
    console.log("");
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💡 Your local OpenBook markets are ready!\n");
  console.log("📝 Token Addresses:");
  console.log("   BTC:  EgYUYr2ceQmF7hNxfZ3TwJGjGwv4SR7PG16dL2eFVfp7");
  console.log("   USDT: 3oMmovJAxZ48aFnyLStD4mETAZMXMofDTM59XREpso7Y");
  console.log("   WETH: 94KdFYCoAg3TVJmf7SnqxvhH4LVEYbR4XVULqnoom3GG");
  console.log("\n🚀 Next Steps:");
  console.log("   - Mint tokens to your account");
  console.log("   - Create token accounts for trading");
  console.log("   - Place orders using postOrder.ts");
  console.log("   - Build your trading application!");
  console.log("\n🔗 Local Validator: http://localhost:8899\n");
}

main().catch(console.error);
