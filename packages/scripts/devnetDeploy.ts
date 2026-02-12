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

// Devnet configuration - using already deployed program!
const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 OpenBook V2 Devnet Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Set environment variable
  process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const keypairData = JSON.parse(
    fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8")
  );
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("🔑 Authority:", authority.publicKey.toString());

  let balance = await connection.getBalance(authority.publicKey);
  console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log("\n⚠️  Low balance! Requesting airdrop...");
    try {
      const sig = await connection.requestAirdrop(
        authority.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig);
      balance = await connection.getBalance(authority.publicKey);
      console.log(`✅ New balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    } catch (error) {
      console.log("⚠️  Airdrop failed, but continuing with current balance...");
    }
  }

  console.log("");

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const client = new OpenBookV2Client(provider, PROGRAM_ID);

  console.log("📦 Creating SPL Tokens (BTC, USDT, WETH)...\n");
  const mintUtils = new MintUtils(connection, authority);

  // Create BTC token (8 decimals)
  console.log("Creating BTC token (8 decimals)...");
  const btcMint = await mintUtils.createMint(8);
  console.log("✅ BTC:", btcMint.toString());
  await delay(1000);

  // Create USDT token (6 decimals)
  console.log("Creating USDT token (6 decimals)...");
  const usdtMint = await mintUtils.createMint(6);
  console.log("✅ USDT:", usdtMint.toString());
  await delay(1000);

  // Create WETH token (9 decimals)
  console.log("Creating WETH token (9 decimals)...");
  const wethMint = await mintUtils.createMint(9);
  console.log("✅ WETH:", wethMint.toString());
  await delay(2000);

  console.log("\n🏪 Creating Markets...\n");

  // Create BTC/USDT market
  console.log("Creating BTC/USDT market...");
  try {
    const [btcUsdtIxs, btcUsdtSigners] = await client.createMarketIx(
      authority.publicKey,
      "BTC/USDT",
      usdtMint,
      btcMint,
      new BN(10),       // quoteLotSize (0.00001 USDT)
      new BN(100),      // baseLotSize (0.000001 BTC)
      new BN(0),        // makerFee
      new BN(0),        // takerFee
      new BN(0),        // timeExpiry
      null, null, null, null, null
    );

    // Add compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });
    btcUsdtIxs.unshift(computeBudgetIx);

    const btcUsdtTx = await client.sendAndConfirmTransaction(btcUsdtIxs, {
      additionalSigners: btcUsdtSigners,
    });

    console.log("✅ BTC/USDT market created!");
    console.log(`   https://explorer.solana.com/tx/${btcUsdtTx}?cluster=devnet`);
  } catch (error: any) {
    console.error("❌ Error creating BTC/USDT:", error.message);
    if (error.logs) {
      console.log("   Logs:", error.logs.slice(-5).join("\n   "));
    }
  }

  await delay(2000);

  // Create WETH/USDT market
  console.log("\nCreating WETH/USDT market...");
  try {
    const [wethUsdtIxs, wethUsdtSigners] = await client.createMarketIx(
      authority.publicKey,
      "WETH/USDT",
      usdtMint,
      wethMint,
      new BN(10),       // quoteLotSize
      new BN(100),      // baseLotSize
      new BN(0),        // makerFee
      new BN(0),        // takerFee
      new BN(0),        // timeExpiry
      null, null, null, null, null
    );

    // Add compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });
    wethUsdtIxs.unshift(computeBudgetIx);

    const wethUsdtTx = await client.sendAndConfirmTransaction(wethUsdtIxs, {
      additionalSigners: wethUsdtSigners,
    });

    console.log("✅ WETH/USDT market created!");
    console.log(`   https://explorer.solana.com/tx/${wethUsdtTx}?cluster=devnet`);
  } catch (error: any) {
    console.error("❌ Error creating WETH/USDT:", error.message);
    if (error.logs) {
      console.log("   Logs:", error.logs.slice(-5).join("\n   "));
    }
  }

  await delay(2000);

  // List all markets
  console.log("\n📋 Listing Markets on Devnet...\n");
  try {
    const markets = await findAllMarkets(connection, PROGRAM_ID, provider);

    if (markets.length === 0) {
      console.log("No markets found.");
    } else {
      console.log(`Found ${markets.length} market(s) total:\n`);

      // Show our newly created markets
      const ourMarkets = markets.filter((m: any) =>
        m.name && (m.name.includes("BTC/USDT") || m.name.includes("WETH/USDT"))
      );

      if (ourMarkets.length > 0) {
        console.log("🎯 Our Markets:");
        ourMarkets.forEach((m: any, i: number) => {
          console.log(`\n${i + 1}. ${m.name || "Unknown"}`);
          console.log(`   Market Address: ${m.publicKey || m.address || "N/A"}`);
          console.log(`   View on Explorer: https://explorer.solana.com/address/${m.publicKey || m.address}?cluster=devnet`);
        });
      }
    }
  } catch (error: any) {
    console.error("\n❌ Error listing markets:", error.message);
  }

  console.log("\n✨ Deployment Complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📝 Summary:");
  console.log(`   BTC Mint:  ${btcMint.toString()}`);
  console.log(`   USDT Mint: ${usdtMint.toString()}`);
  console.log(`   WETH Mint: ${wethMint.toString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch(console.error);
