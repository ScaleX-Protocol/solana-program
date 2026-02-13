import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { OpenBookV2Client, PlaceOrderArgs, Side } from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import { getKeypairFromFile } from "./utils";
import * as os from "os";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET_ADDRESS = new PublicKey(process.env.MARKET_ADDRESS || "HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

// Retry configuration for devnet
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  operation: string,
  retries = MAX_RETRIES
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`   Attempt ${i + 1}/${retries}: ${operation}`);
      const result = await fn();
      console.log(`   ✅ Success!`);
      return result;
    } catch (error: any) {
      const isLastAttempt = i === retries - 1;

      if (isLastAttempt) {
        console.log(`   ❌ Failed after ${retries} attempts`);
        throw error;
      }

      // Check if it's a retryable error
      const isRetryable =
        error.message?.includes("BlockheightExceeded") ||
        error.message?.includes("timeout") ||
        error.message?.includes("429") ||
        error.message?.includes("Not found") ||
        error.message?.includes("not properly created") ||
        error.message?.includes("will retry");

      if (!isRetryable) {
        console.log(`   ❌ Non-retryable error: ${error.message?.split('\n')[0]}`);
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
      console.log(`   ⚠️  Retrying in ${delay/1000}s...`);
      await sleep(delay);
    }
  }
  throw new Error(`Failed after ${retries} retries`);
}

async function main() {
  console.log("🚀 Placing Orders on Devnet (with Retry Logic)\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);

  // Use multiple confirmation for more reliability
  const connection = new Connection(RPC, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 90000, // 90 seconds
  });

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "processed", // Use processed for faster preflight
    skipPreflight: false, // Keep preflight to catch errors early
  });

  const client = new OpenBookV2Client(provider, PROGRAM_ID);

  console.log("📊 Market:", MARKET_ADDRESS.toString());
  console.log("🔑 Authority:", authority.publicKey.toString());
  console.log("🌐 RPC:", RPC);
  console.log("");

  // Load market with retry
  console.log("📖 Loading market...");
  const market = await retryWithBackoff(
    () => client.deserializeMarketAccount(MARKET_ADDRESS),
    "Load market"
  );

  if (!market) {
    throw new Error("Market not found");
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

  // Check and create OpenOrders account with retry
  console.log("📝 Setting up OpenOrders account...");
  await retryWithBackoff(async () => {
    const accountInfo = await connection.getAccountInfo(openOrdersAccount);

    if (!accountInfo || accountInfo.owner.toBase58() === "11111111111111111111111111111111") {
      console.log("   Creating OpenOrders account...");
      const tx = await client.createOpenOrders(authority, MARKET_ADDRESS, "trader");
      console.log(`   Created! TX: ${tx.toString().slice(0, 20)}...`);

      // Wait longer for propagation on devnet
      await sleep(12000); // Wait 12 seconds for propagation

      const verifyInfo = await connection.getAccountInfo(openOrdersAccount);
      if (!verifyInfo || verifyInfo.owner.toBase58() !== PROGRAM_ID.toBase58()) {
        throw new Error("OpenOrders account not properly created - will retry");
      }
      console.log("   Verified OpenOrders account");
    } else {
      console.log("   OpenOrders account already exists");
    }

    return true;
  }, "Create/verify OpenOrders account");

  console.log("");

  // Setup token accounts with retry
  console.log("🪙 Setting up token accounts...");
  const mintUtils = new MintUtils(connection, authority);

  const userBaseAcc = await retryWithBackoff(
    () => mintUtils.getOrCreateTokenAccount(market.baseMint, authority, authority.publicKey),
    "Create base token account"
  );

  const userQuoteAcc = await retryWithBackoff(
    () => mintUtils.getOrCreateTokenAccount(market.quoteMint, authority, authority.publicKey),
    "Create quote token account"
  );

  console.log("   Minting tokens...");
  await retryWithBackoff(
    () => mintUtils.mintTo(market.baseMint, userBaseAcc.address),
    "Mint base tokens"
  );

  await retryWithBackoff(
    () => mintUtils.mintTo(market.quoteMint, userQuoteAcc.address),
    "Mint quote tokens"
  );

  console.log("✅ Token accounts ready\n");

  // Place BUY order with retry
  console.log("📈 Placing BUY order...");
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

  await retryWithBackoff(async () => {
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
    console.log(`   TX: ${tx.slice(0, 20)}...`);
    return tx;
  }, "Place BUY order");

  await sleep(3000);

  // Place SELL order with retry
  console.log("\n📉 Placing SELL order...");
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

  await retryWithBackoff(async () => {
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
    console.log(`   TX: ${tx.slice(0, 20)}...`);
    return tx;
  }, "Place SELL order");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Orders placed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message || err);
  process.exit(1);
});
