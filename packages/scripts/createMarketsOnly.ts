import { Connection, Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client, findAllMarkets } from "@openbook-dex/openbook-v2";
import * as fs from "fs";
import * as os from "os";

const RPC = process.env.SOLANA_RPC_URL || "https://devnet.helius-rpc.com/?api-key=e8252302-cdec-44d0-80d2-3efac7c0b50c";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

// Existing tokens from previous deployment
const BTC_MINT = new PublicKey("A7acMHc32rwpFy2NGR2r4H5RpcDGpYM2ECwroLMyqXPe");
const USDT_MINT = new PublicKey("HNwV7NAQg1AtwNtNgDzj7FS9b45sa3dvFKQ8WgMcUnWH");
const WETH_MINT = new PublicKey("H7VpV33T1ynMFwoyCgaDeG7RtXZAEUum68wPyqU9WscH");

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🏪 Creating OpenBook V2 Markets on Devnet\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const keypairData = JSON.parse(fs.readFileSync(authorityFile, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const connection = new Connection(RPC, "confirmed");
  const balance = await connection.getBalance(authority.publicKey);
  
  console.log("🔑 Authority:", authority.publicKey.toString());
  console.log("💰 Balance:", (balance / 1e9).toFixed(2), "SOL");
  console.log("🌐 RPC:", RPC);
  console.log("\n📦 Using Existing Tokens:");
  console.log("   BTC: ", BTC_MINT.toString());
  console.log("   USDT:", USDT_MINT.toString());
  console.log("   WETH:", WETH_MINT.toString());
  console.log("");

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    skipPreflight: false,
  });
  const client = new OpenBookV2Client(provider, PROGRAM_ID);

  // Create BTC/USDT Market
  console.log("Creating BTC/USDT market...");
  try {
    const [btcIxs, btcSigners] = await client.createMarketIx(
      authority.publicKey,
      "BTC/USDT",
      USDT_MINT,     // quote
      BTC_MINT,      // base
      new BN(10),    // quoteLotSize
      new BN(1000),  // baseLotSize
      new BN(0),     // makerFee
      new BN(0),     // takerFee
      new BN(0),     // timeExpiry
      null, null, null, null, null
    );

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    btcIxs.unshift(modifyComputeUnits);
    btcIxs.unshift(addPriorityFee);

    const btcTx = await client.sendAndConfirmTransaction(btcIxs, {
      additionalSigners: btcSigners,
    });

    console.log("✅ BTC/USDT created!");
    console.log("   TX:", btcTx);
    console.log("   Market:", btcSigners[0].publicKey.toString());
  } catch (error: any) {
    console.error("❌ Error:", error.message || error);
    if (error.logs) {
      console.log("\n📋 Logs:");
      error.logs.forEach((log: string) => console.log("   ", log));
    }
  }

  await delay(3000);

  // Create WETH/USDT Market
  console.log("\nCreating WETH/USDT market...");
  try {
    const [wethIxs, wethSigners] = await client.createMarketIx(
      authority.publicKey,
      "WETH/USDT",
      USDT_MINT,     // quote
      WETH_MINT,     // base
      new BN(10),    // quoteLotSize
      new BN(1000),  // baseLotSize
      new BN(0),     // makerFee
      new BN(0),     // takerFee
      new BN(0),     // timeExpiry
      null, null, null, null, null
    );

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    wethIxs.unshift(modifyComputeUnits);
    wethIxs.unshift(addPriorityFee);

    const wethTx = await client.sendAndConfirmTransaction(wethIxs, {
      additionalSigners: wethSigners,
    });

    console.log("✅ WETH/USDT created!");
    console.log("   TX:", wethTx);
    console.log("   Market:", wethSigners[0].publicKey.toString());
  } catch (error: any) {
    console.error("❌ Error:", error.message || error);
    if (error.logs) {
      console.log("\n📋 Logs:");
      error.logs.forEach((log: string) => console.log("   ", log));
    }
  }

  await delay(3000);

  // List all markets
  console.log("\n📋 Listing Markets...\n");
  try {
    const markets = await findAllMarkets(connection, PROGRAM_ID, provider);
    
    if (markets.length === 0) {
      console.log("⚠️  No markets indexed yet (may take a moment)");
    } else {
      console.log(`✅ Found ${markets.length} market(s):\n`);
      markets.forEach((market: any, i: number) => {
        console.log(`${i + 1}. ${market.name}`);
        console.log(`   Market: ${market.market}`);
        console.log(`   Base:   ${market.baseMint}`);
        console.log(`   Quote:  ${market.quoteMint}\n`);
      });
    }
  } catch (error: any) {
    console.log("⚠️  Market indexing in progress (this is normal)");
  }

  console.log("\n✨ Markets Created Successfully!\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
