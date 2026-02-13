import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OpenBookV2Client, PlaceOrderArgs, Side } from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as os from "os";
import * as fs from "fs";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET = new PublicKey(process.env.MARKET_ADDRESS || "HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

function getKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf-8"))));
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Retry with fresh connection on failures
async function retryWithNewConnection<T>(fn: (conn: Connection) => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    const conn = new Connection(RPC, "confirmed"); // Fresh connection each time
    try {
      return await fn(conn);
    } catch (e: any) {
      if (i === maxRetries - 1) throw e;
      console.log(`   ⚠️  Retry ${i + 1}/${maxRetries}...`);
      await sleep(2000);
    }
  }
  throw new Error("Max retries exceeded");
}

async function main() {
  console.log("🚀 Robust Order Placement\n");

  const authority = getKeypair(`${os.homedir()}/.config/solana/id.json`);
  console.log("🔑", authority.publicKey.toBase58());
  console.log("🌐", RPC, "\n");

  // Use fresh connections for each operation
  const getClient = () => {
    const conn = new Connection(RPC, "confirmed");
    const provider = new AnchorProvider(conn, new Wallet(authority), { commitment: "confirmed" });
    return { client: new OpenBookV2Client(provider), connection: conn };
  };

  // Load market
  console.log("📖 Loading market...");
  const {client, connection} = getClient();
  const market = await client.deserializeMarketAccount(MARKET);
  if (!market) throw new Error("Market not found");
  console.log("✅ Loaded:", typeof market.name === 'string' ? market.name : String.fromCharCode(...market.name), "\n");

  const [openOrdersPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("OpenOrders"), authority.publicKey.toBuffer(), MARKET.toBuffer()],
    PROGRAM_ID
  );

  // Create OpenOrders - don't verify, just trust
  console.log("📝 OpenOrders...");
  try {
    await client.createOpenOrders(authority, MARKET, "test");
    console.log("✅ Created (or already exists)\n");
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("✅ Already exists\n");
    } else {
      console.log("⚠️  Create may have failed, continuing anyway...\n");
    }
  }

  // DON'T verify - just wait then proceed
  console.log("⏳ Waiting 30 seconds (no verification)...");
  await sleep(30000);

  // Setup tokens with fresh connection
  console.log("\n🪙 Tokens...");
  const {connection: conn2} = getClient();
  const mintUtils = new MintUtils(conn2, authority);

  const baseAcc = await mintUtils.getOrCreateTokenAccount(market.baseMint, authority, authority.publicKey);
  const quoteAcc = await mintUtils.getOrCreateTokenAccount(market.quoteMint, authority, authority.publicKey);

  await mintUtils.mintTo(market.baseMint, baseAcc.address);
  await mintUtils.mintTo(market.quoteMint, quoteAcc.address);
  console.log("✅ Ready\n");

  await sleep(5000);

  // Place orders with fresh client
  console.log("📈 BUY order...");
  try {
    const {client: client3} = getClient();
    const [ix, signers] = await client3.placeOrderIx(
      openOrdersPDA, MARKET, market, quoteAcc.address, null,
      {
        side: { bid: {} } as Side,
        priceLots: new BN(95),
        maxBaseLots: new BN(5),
        maxQuoteLotsIncludingFees: new BN(50000),
        clientOrderId: new BN(Date.now()),
        orderType: { limit: {} },
        expiryTimestamp: new BN(0),
        selfTradeBehavior: { decrementTake: {} },
        limit: 10,
      }, []
    );

    await client3.sendAndConfirmTransaction([ix], { additionalSigners: signers ? [signers] : [] });
    console.log("✅ Placed!\n");
  } catch (e: any) {
    console.log("❌", e.message?.split('\n')[0], "\n");
  }

  await sleep(5000);

  console.log("📉 SELL order...");
  try {
    const {client: client4} = getClient();
    const [ix, signers] = await client4.placeOrderIx(
      openOrdersPDA, MARKET, market, baseAcc.address, null,
      {
        side: { ask: {} } as Side,
        priceLots: new BN(105),
        maxBaseLots: new BN(5),
        maxQuoteLotsIncludingFees: new BN(50000),
        clientOrderId: new BN(Date.now() + 1),
        orderType: { limit: {} },
        expiryTimestamp: new BN(0),
        selfTradeBehavior: { decrementTake: {} },
        limit: 10,
      }, []
    );

    await client4.sendAndConfirmTransaction([ix], { additionalSigners: signers ? [signers] : [] });
    console.log("✅ Placed!\n");
  } catch (e: any) {
    console.log("❌", e.message?.split('\n')[0], "\n");
  }

  console.log("✨ Done!\n");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
