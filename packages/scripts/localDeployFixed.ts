import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client, findAllMarkets } from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as fs from "fs";

const LOCAL_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Local OpenBook V2 Deployment\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(LOCAL_RPC, "confirmed");
  const keypairData = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const balance = await connection.getBalance(authority.publicKey);
  console.log("🔑 Authority:", authority.publicKey.toString());
  console.log("💰 Balance:", (balance / LAMPORTS_PER_SOL).toFixed(2), "SOL\n");

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    skipPreflight: false, // Enable preflight for better error messages
  });
  const client = new OpenBookV2Client(provider, PROGRAM_ID);

  console.log("📦 Creating Tokens with Metadata...\n");
  const mintUtils = new MintUtils(connection, authority);

  // Create BTC with metadata
  const btcMint = await mintUtils.createMintWithMetadata(
    {
      name: "Bitcoin",
      symbol: "BTC",
      uri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png",
    },
    8
  );
  console.log("✅ BTC (8 decimals):", btcMint.toString());
  await delay(500);

  // Create USDT with metadata
  const usdtMint = await mintUtils.createMintWithMetadata(
    {
      name: "Tether USD",
      symbol: "USDT",
      uri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
    },
    6
  );
  console.log("✅ USDT (6 decimals):", usdtMint.toString());
  await delay(500);

  // Create WETH with metadata
  const wethMint = await mintUtils.createMintWithMetadata(
    {
      name: "Wrapped Ethereum",
      symbol: "WETH",
      uri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png",
    },
    9
  );
  console.log("✅ WETH (9 decimals):", wethMint.toString());
  await delay(1000);

  console.log("\n🏪 Creating Markets...\n");

  // BTC/USDT Market
  console.log("Creating BTC/USDT market...");
  try {
    const [btcIxs, btcSigners] = await client.createMarketIx(
      authority.publicKey,
      "BTC/USDT",
      usdtMint,     // quote
      btcMint,      // base
      new BN(10),   // quoteLotSize
      new BN(1000), // baseLotSize
      new BN(0),    // makerFee
      new BN(0),    // takerFee
      new BN(0),    // timeExpiry
      null, null, null, null, null
    );

    // Add HIGH compute budget
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    btcIxs.unshift(modifyComputeUnits);
    btcIxs.unshift(addPriorityFee);

    console.log("   Sending transaction...");
    const btcTx = await client.sendAndConfirmTransaction(btcIxs, {
      additionalSigners: btcSigners,
    });

    console.log("✅ BTC/USDT created! TX:", btcTx.slice(0, 20) + "...");
  } catch (error: any) {
    console.error("❌ Error:", error.message || error);

    // Print transaction ID for detailed debugging
    if (error.txid) {
      console.log("🔑 Transaction ID:", error.txid);
      console.log("\n💡 Get detailed logs with:");
      console.log(`   solana confirm ${error.txid} --url http://localhost:8899 -v`);
    }
    if (error.transactionLogs) {
      console.log("\n📋 Transaction Logs:");
      error.transactionLogs.forEach((log: string) => console.log("   ", log));
    }
    if (error.logs) {
      console.log("\n📋 Full Transaction Logs:");
      error.logs.forEach((log: string) => console.log("   ", log));
    }
    if (error.err) {
      console.log("\n📋 Error details:", JSON.stringify(error.err, null, 2));
    }
  }

  await delay(2000);

  // WETH/USDT Market
  console.log("\nCreating WETH/USDT market...");
  try {
    const [wethIxs, wethSigners] = await client.createMarketIx(
      authority.publicKey,
      "WETH/USDT",
      usdtMint,     // quote
      wethMint,     // base
      new BN(10),   // quoteLotSize
      new BN(1000), // baseLotSize
      new BN(0),    // makerFee
      new BN(0),    // takerFee
      new BN(0),    // timeExpiry
      null, null, null, null, null
    );

    // Add HIGH compute budget
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    wethIxs.unshift(modifyComputeUnits);
    wethIxs.unshift(addPriorityFee);

    console.log("   Sending transaction...");
    const wethTx = await client.sendAndConfirmTransaction(wethIxs, {
      additionalSigners: wethSigners,
    });

    console.log("✅ WETH/USDT created! TX:", wethTx.slice(0, 20) + "...");
  } catch (error: any) {
    console.error("❌ Error:", error.message || error);

    // Print transaction ID for detailed debugging
    if (error.txid) {
      console.log("🔑 Transaction ID:", error.txid);
      console.log("\n💡 Get detailed logs with:");
      console.log(`   solana confirm ${error.txid} --url http://localhost:8899 -v`);
    }
    if (error.transactionLogs) {
      console.log("\n📋 Transaction Logs:");
      error.transactionLogs.forEach((log: string) => console.log("   ", log));
    }
    if (error.logs) {
      console.log("\n📋 Full Transaction Logs:");
      error.logs.forEach((log: string) => console.log("   ", log));
    }
    if (error.err) {
      console.log("\n📋 Error details:", JSON.stringify(error.err, null, 2));
    }
  }

  await delay(2000);

  // List Markets
  console.log("\n📋 Listing Markets...\n");
  try {
    const markets = await findAllMarkets(connection, PROGRAM_ID, provider);

    if (markets.length === 0) {
      console.log("⚠️  No markets found yet.");
    } else {
      console.log(`✅ Found ${markets.length} market(s):\n`);
      markets.forEach((market: any, i: number) => {
        console.log(`${i + 1}. Market:`, JSON.stringify(market, null, 2));
      });
    }
  } catch (error: any) {
    console.error("❌ Error listing markets:", error.message);
  }

  console.log("\n✨ Deployment Complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Token Addresses (with Metadata):");
  console.log(`  BTC:  ${btcMint.toString()}`);
  console.log(`  USDT: ${usdtMint.toString()}`);
  console.log(`  WETH: ${wethMint.toString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("✅ Tokens created with metadata:");
  console.log("   - Names: Bitcoin, Tether USD, Wrapped Ethereum");
  console.log("   - Symbols: BTC, USDT, WETH");
  console.log("   - Logos: ✅ Included\n");

  console.log("🔗 View transactions:");
  console.log("   solana logs");
  console.log("\n💡 Next steps:");
  console.log("   - Use postOrder.ts to place orders");
  console.log("   - Use getMarkets.ts to view markets");
  console.log("   - Check tokens in Phantom wallet (will show proper names!)");
  console.log("   - Build your trading application!\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
