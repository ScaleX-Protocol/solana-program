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

async function main() {
  console.log("🎯 Placing Orders with CORRECT OpenOrders Account\n");

  const authority = getKeypair(`${os.homedir()}/.config/solana/id.json`);
  const connection = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
  const client = new OpenBookV2Client(provider);

  console.log("🔑 Authority:", authority.publicKey.toBase58());
  console.log("🌐 RPC:", RPC);
  console.log("📊 Market:", MARKET.toBase58());
  console.log("");

  // Load market
  console.log("📖 Loading market...");
  const market = await client.deserializeMarketAccount(MARKET);
  if (!market) throw new Error("Market not found");
  console.log("✅ Market loaded:", typeof market.name === 'string' ? market.name : String.fromCharCode(...market.name));
  console.log("");

  // Find ALL OpenOrders accounts for this market
  console.log("🔍 Finding OpenOrders accounts for this market...");
  const openOrdersAccounts = await client.findOpenOrdersForMarket(authority.publicKey, MARKET);

  if (openOrdersAccounts.length === 0) {
    console.log("❌ No OpenOrders account found! Creating one...");
    await client.createOpenOrders(authority, MARKET, "trader");
    console.log("✅ Created! Waiting 10s...");
    await sleep(10000);

    // Find again
    const newAccounts = await client.findOpenOrdersForMarket(authority.publicKey, MARKET);
    if (newAccounts.length === 0) {
      throw new Error("Still no OpenOrders account after creation!");
    }
    console.log("✅ Found OpenOrders:", newAccounts[0].toBase58());
    console.log("");
  } else {
    console.log(`✅ Found ${openOrdersAccounts.length} OpenOrders account(s):`);
    openOrdersAccounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.toBase58()}`);
    });
    console.log("");
  }

  // Use the first (or latest) OpenOrders account
  const openOrdersPDA = openOrdersAccounts[openOrdersAccounts.length - 1];
  console.log("📝 Using OpenOrders:", openOrdersPDA.toBase58());
  console.log("");

  // Setup tokens
  console.log("🪙 Setting up tokens...");
  const mintUtils = new MintUtils(connection, authority);
  const baseAcc = await mintUtils.getOrCreateTokenAccount(market.baseMint, authority, authority.publicKey);
  const quoteAcc = await mintUtils.getOrCreateTokenAccount(market.quoteMint, authority, authority.publicKey);

  await mintUtils.mintTo(market.baseMint, baseAcc.address);
  await mintUtils.mintTo(market.quoteMint, quoteAcc.address);
  console.log("✅ Tokens ready");
  console.log("");

  await sleep(3000);

  // Place BUY order
  console.log("📈 Placing BUY order...");
  try {
    const buyArgs: PlaceOrderArgs = {
      side: { bid: {} } as Side,
      priceLots: new BN(95),
      maxBaseLots: new BN(5),
      maxQuoteLotsIncludingFees: new BN(50000),
      clientOrderId: new BN(Date.now()),
      orderType: { limit: {} },
      expiryTimestamp: new BN(0),
      selfTradeBehavior: { decrementTake: {} },
      limit: 10,
    };

    const [ix, signers] = await client.placeOrderIx(
      openOrdersPDA,
      MARKET,
      market,
      quoteAcc.address,
      null,
      buyArgs,
      []
    );

    const sig = await client.sendAndConfirmTransaction([ix], { additionalSigners: signers });
    console.log("✅ BUY order placed!");
    console.log("   TX:", sig);
    console.log("");
  } catch (e: any) {
    console.log("❌ BUY failed:", e.message?.split('\n')[0]);
    if (e.logs) {
      console.log("   Logs:", e.logs.slice(0, 3).join(", "));
    }
    console.log("");
  }

  await sleep(3000);

  // Place SELL order
  console.log("📉 Placing SELL order...");
  try {
    const sellArgs: PlaceOrderArgs = {
      side: { ask: {} } as Side,
      priceLots: new BN(105),
      maxBaseLots: new BN(5),
      maxQuoteLotsIncludingFees: new BN(50000),
      clientOrderId: new BN(Date.now() + 1),
      orderType: { limit: {} },
      expiryTimestamp: new BN(0),
      selfTradeBehavior: { decrementTake: {} },
      limit: 10,
    };

    const [ix, signers] = await client.placeOrderIx(
      openOrdersPDA,
      MARKET,
      market,
      baseAcc.address,
      null,
      sellArgs,
      []
    );

    const sig = await client.sendAndConfirmTransaction([ix], { additionalSigners: signers });
    console.log("✅ SELL order placed!");
    console.log("   TX:", sig);
    console.log("");
  } catch (e: any) {
    console.log("❌ SELL failed:", e.message?.split('\n')[0]);
    if (e.logs) {
      console.log("   Logs:", e.logs.slice(0, 3).join(", "));
    }
    console.log("");
  }

  console.log("✨ Done!\n");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
