import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { OpenBookV2Client, PlaceOrderArgs, Side } from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as os from "os";
import * as fs from "fs";

function getKeypairFromFile(filePath: string): any {
  const Keypair = require("@solana/web3.js").Keypair;
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf-8")))
  );
}

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET_ADDRESS = new PublicKey(process.env.MARKET_ADDRESS || "HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Placing Orders (Trust Transaction, No Verification)\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);

  const connection = new Connection(RPC, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 120000,
  });

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "processed",
    skipPreflight: false,
  });

  const client = new OpenBookV2Client(provider, PROGRAM_ID);

  console.log("📊 Market:", MARKET_ADDRESS.toString());
  console.log("🔑 Authority:", authority.publicKey.toString());
  console.log("🌐 RPC:", RPC);
  console.log("");

  // Load market
  console.log("📖 Loading market...");
  let market;
  try {
    market = await client.deserializeMarketAccount(MARKET_ADDRESS);
    if (!market) {
      throw new Error("Market returned null");
    }
  } catch (error: any) {
    console.error("❌ Error loading market:", error.message);
    throw new Error(`Market not found: ${error.message}`);
  }

  console.log("✅ Market loaded");
  console.log(`   Name: ${typeof market.name === 'string' ? market.name : String.fromCharCode(...market.name)}`);
  console.log(`   Base:  ${market.baseMint.toString()}`);
  console.log(`   Quote: ${market.quoteMint.toString()}\n`);

  // Get OpenOrders PDA
  const [openOrdersAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("OpenOrders"),
      authority.publicKey.toBuffer(),
      MARKET_ADDRESS.toBuffer(),
    ],
    PROGRAM_ID
  );

  console.log("📝 Creating OpenOrders account (if needed)...");
  try {
    // Try to create, ignore if already exists
    const tx = await client.createOpenOrders(authority, MARKET_ADDRESS, "trader");
    console.log(`✅ OpenOrders created: ${tx.toString().slice(0, 20)}...`);

    // Wait LONGER for propagation - no verification
    console.log("⏳ Waiting 20 seconds for propagation...");
    await sleep(20000);
  } catch (error: any) {
    if (error.message?.includes("already in use")) {
      console.log("✅ OpenOrders account already exists");
    } else {
      console.log("⚠️  Error creating OpenOrders:", error.message?.split('\n')[0]);
      console.log("   Continuing anyway (may already exist)...");
      await sleep(10000);
    }
  }

  // Setup token accounts
  console.log("\n🪙 Setting up token accounts...");
  const mintUtils = new MintUtils(connection, authority);

  const userBaseAcc = await mintUtils.getOrCreateTokenAccount(
    market.baseMint,
    authority,
    authority.publicKey
  );
  console.log("✅ Base token account ready");

  const userQuoteAcc = await mintUtils.getOrCreateTokenAccount(
    market.quoteMint,
    authority,
    authority.publicKey
  );
  console.log("✅ Quote token account ready");

  console.log("\n🔄 Minting tokens...");
  await mintUtils.mintTo(market.baseMint, userBaseAcc.address);
  await mintUtils.mintTo(market.quoteMint, userQuoteAcc.address);
  console.log("✅ Tokens minted\n");

  // Wait before placing orders
  console.log("⏳ Waiting 10 seconds before placing orders...");
  await sleep(10000);

  // Place BUY order
  console.log("📈 Placing BUY order...");
  try {
    const buyArgs: PlaceOrderArgs = {
      side: { bid: {} } as Side,
      priceLots: new BN(100),
      maxBaseLots: new BN(5),
      maxQuoteLotsIncludingFees: new BN(100000),
      clientOrderId: new BN(Date.now()),
      orderType: { limit: {} },
      expiryTimestamp: new BN(0),
      selfTradeBehavior: { decrementTake: {} },
      limit: 10,
    };

    const [ix, signers] = await client.placeOrderIx(
      openOrdersAccount,
      MARKET_ADDRESS,
      market,
      userQuoteAcc.address,
      null,
      buyArgs,
      []
    );

    const additionalSigners = [];
    if (signers && typeof signers === 'object' && 'publicKey' in signers) {
      additionalSigners.push(signers);
    }

    const tx = await client.sendAndConfirmTransaction([ix], { additionalSigners });
    console.log(`✅ BUY order placed!`);
    console.log(`   TX: ${tx.slice(0, 20)}...`);
  } catch (error: any) {
    console.log(`❌ BUY order failed: ${error.message?.split('\n')[0] || error}`);
  }

  await sleep(5000);

  // Place SELL order
  console.log("\n📉 Placing SELL order...");
  try {
    const sellArgs: PlaceOrderArgs = {
      side: { ask: {} } as Side,
      priceLots: new BN(110),
      maxBaseLots: new BN(5),
      maxQuoteLotsIncludingFees: new BN(100000),
      clientOrderId: new BN(Date.now() + 1),
      orderType: { limit: {} },
      expiryTimestamp: new BN(0),
      selfTradeBehavior: { decrementTake: {} },
      limit: 10,
    };

    const [ix, signers] = await client.placeOrderIx(
      openOrdersAccount,
      MARKET_ADDRESS,
      market,
      userBaseAcc.address,
      null,
      sellArgs,
      []
    );

    const additionalSigners = [];
    if (signers && typeof signers === 'object' && 'publicKey' in signers) {
      additionalSigners.push(signers);
    }

    const tx = await client.sendAndConfirmTransaction([ix], { additionalSigners });
    console.log(`✅ SELL order placed!`);
    console.log(`   TX: ${tx.slice(0, 20)}...`);
  } catch (error: any) {
    console.log(`❌ SELL order failed: ${error.message?.split('\n')[0] || error}`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Order placement complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message || err);
  process.exit(1);
});
