import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client, findAllMarkets } from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as fs from "fs";

// Local validator configuration
const LOCAL_RPC = "http://127.0.0.1:8899";
const LOCAL_PROGRAM_ID = new PublicKey(
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Starting Local OpenBook V2 Deployment\n");

  // Set ANCHOR_WALLET environment variable if not set
  const keypairPath = `${process.env.HOME}/.config/solana/id.json`;
  if (!process.env.ANCHOR_WALLET) {
    process.env.ANCHOR_WALLET = keypairPath;
  }

  // Connect to local validator
  const connection = new Connection(LOCAL_RPC, "confirmed");

  // Load or create authority keypair
  let authority: Keypair;

  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    console.log("✅ Loaded authority keypair:", authority.publicKey.toString());
  } catch (error) {
    console.log("⚠️  No keypair found, generating new one...");
    authority = Keypair.generate();
    console.log("✅ Generated authority keypair:", authority.publicKey.toString());
  }

  // Check balance and airdrop if needed
  try {
    let balance = await connection.getBalance(authority.publicKey);
    console.log(`💰 Current balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < LAMPORTS_PER_SOL) {
      console.log("💸 Requesting airdrop...");
      const signature = await connection.requestAirdrop(
        authority.publicKey,
        10 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(signature);
      balance = await connection.getBalance(authority.publicKey);
      console.log(`✅ New balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
    }
  } catch (error) {
    console.error("❌ Error checking balance:", error);
    console.log("⚠️  Make sure local validator is running!");
    console.log("   Run: solana-test-validator --reset\n");
    process.exit(1);
  }

  // Create provider and client
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const client = new OpenBookV2Client(provider, LOCAL_PROGRAM_ID);

  console.log("📦 Creating SPL Tokens...\n");
  const mintUtils = new MintUtils(connection, authority);

  // Create BTC token (8 decimals like real BTC)
  console.log("Creating BTC token...");
  const btcMint = await mintUtils.createMint(8);
  console.log("✅ BTC Mint:", btcMint.toString());

  // Create USDT token (6 decimals like real USDT)
  console.log("Creating USDT token...");
  const usdtMint = await mintUtils.createMint(6);
  console.log("✅ USDT Mint:", usdtMint.toString());

  // Create WETH token (18 decimals like real ETH)
  console.log("Creating WETH token...");
  const wethMint = await mintUtils.createMint(9); // Solana typically uses 9 max
  console.log("✅ WETH Mint:", wethMint.toString());

  await delay(1000);

  console.log("\n🏪 Creating Markets...\n");

  // Create BTC/USDT market
  console.log("Creating BTC/USDT market...");
  try {
    const [btcUsdtIxs, btcUsdtSigners] = await client.createMarketIx(
      authority.publicKey,
      "BTC/USDT",
      usdtMint, // quote token
      btcMint,  // base token
      new BN(1),        // quote lot size
      new BN(100),      // base lot size
      new BN(1000),     // maker fee
      new BN(1000),     // taker fee
      new BN(0),        // time expiry
      null,             // oracle A
      null,             // oracle B
      null,             // open orders admin
      null,             // consume events admin
      null              // close market admin
    );

    const btcUsdtTx = await client.sendAndConfirmTransaction(btcUsdtIxs, {
      additionalSigners: btcUsdtSigners,
    });
    console.log("✅ BTC/USDT market created!");
    console.log("   Transaction:", btcUsdtTx);
  } catch (error: any) {
    console.error("❌ Error creating BTC/USDT market:", error.message);
  }

  await delay(1000);

  // Create WETH/USDT market
  console.log("\nCreating WETH/USDT market...");
  try {
    const [wethUsdtIxs, wethUsdtSigners] = await client.createMarketIx(
      authority.publicKey,
      "WETH/USDT",
      usdtMint, // quote token
      wethMint, // base token
      new BN(1),        // quote lot size
      new BN(100),      // base lot size
      new BN(1000),     // maker fee
      new BN(1000),     // taker fee
      new BN(0),        // time expiry
      null,             // oracle A
      null,             // oracle B
      null,             // open orders admin
      null,             // consume events admin
      null              // close market admin
    );

    const wethUsdtTx = await client.sendAndConfirmTransaction(wethUsdtIxs, {
      additionalSigners: wethUsdtSigners,
    });
    console.log("✅ WETH/USDT market created!");
    console.log("   Transaction:", wethUsdtTx);
  } catch (error: any) {
    console.error("❌ Error creating WETH/USDT market:", error.message);
  }

  await delay(1000);

  // List all markets
  console.log("\n📋 Listing All Markets...\n");
  try {
    const markets = await findAllMarkets(connection, LOCAL_PROGRAM_ID);

    if (markets.length === 0) {
      console.log("No markets found.");
    } else {
      console.log(`Found ${markets.length} market(s):\n`);
      for (const market of markets) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Market:`, market);
        console.log("");
      }
    }
  } catch (error: any) {
    console.error("❌ Error listing markets:", error.message);
  }

  console.log("\n✨ Local deployment complete!\n");
  console.log("📝 Token Addresses:");
  console.log(`   BTC:  ${btcMint.toString()}`);
  console.log(`   USDT: ${usdtMint.toString()}`);
  console.log(`   WETH: ${wethMint.toString()}`);
  console.log("\n💡 You can now interact with these markets using the other scripts!");
  console.log("   - Use postOrder.ts to place orders");
  console.log("   - Use getMarkets.ts to view markets");
  console.log("   - Use takeOrder.ts to match orders\n");
}

main().catch(console.error);
