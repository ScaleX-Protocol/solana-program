import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client, PlaceOrderArgs, Side } from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as fs from "fs";

const LOCAL_RPC = "http://127.0.0.1:8899";
const LOCAL_PROGRAM_ID = new PublicKey(
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
);

async function main() {
  console.log("📈 Placing Orders on BTC/USDT Market\n");

  // Load market info
  const marketInfo = JSON.parse(fs.readFileSync("market-info.json", "utf-8"));
  console.log("Market:", marketInfo.market);
  console.log("Base (BTC):", marketInfo.baseMint);
  console.log("Quote (USDT):", marketInfo.quoteMint);
  console.log("");

  process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(LOCAL_RPC, {
    commitment: "processed",
  });

  const keypairData = JSON.parse(
    fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8")
  );
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "processed",
    skipPreflight: true,
  });
  const client = new OpenBookV2Client(provider, LOCAL_PROGRAM_ID);

  const marketPk = new PublicKey(marketInfo.market);
  const baseMint = new PublicKey(marketInfo.baseMint);
  const quoteMint = new PublicKey(marketInfo.quoteMint);

  // Load market
  console.log("📊 Loading market...");
  const market = await client.deserializeMarketAccount(marketPk);
  console.log("✅ Market loaded:", market.name);
  console.log("");

  // Create and fund token accounts
  console.log("💰 Setting up token accounts...");
  const mintUtils = new MintUtils(connection, authority);

  const baseAta = await mintUtils.getOrCreateATA(baseMint, authority.publicKey);
  const quoteAta = await mintUtils.getOrCreateATA(quoteMint, authority.publicKey);

  // Mint tokens to ourselves
  console.log("🪙 Minting tokens...");
  await mintUtils.mintTo(baseMint, baseAta, 10 * 10 ** 8); // 10 BTC
  await mintUtils.mintTo(quoteMint, quoteAta, 100000 * 10 ** 6); // 100,000 USDT

  console.log("✅ Minted 10 BTC");
  console.log("✅ Minted 100,000 USDT");
  console.log("");

  // Create open orders account
  console.log("📝 Creating open orders account...");
  const openOrdersIndexer = new BN(0);
  const [openOrdersPk] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("OpenOrders"),
      authority.publicKey.toBuffer(),
      marketPk.toBuffer(),
      openOrdersIndexer.toArrayLike(Buffer, "le", 4),
    ],
    LOCAL_PROGRAM_ID
  );

  try {
    await connection.getAccountInfo(openOrdersPk);
    console.log("✅ Open orders account exists:", openOrdersPk.toString());
  } catch {
    console.log("Creating open orders account...");
    const ix = await client.createOpenOrdersIx(
      marketPk,
      authority.publicKey,
      openOrdersIndexer
    );
    await client.sendAndConfirmTransaction([ix], { skipPreflight: true });
    console.log("✅ Created open orders account");
  }
  console.log("");

  // Deposit funds
  console.log("💳 Depositing funds to open orders account...");
  await client.deposit(
    openOrdersPk,
    marketPk,
    baseAta,
    quoteAta,
    new BN(5 * 10 ** 8),      // 5 BTC
    new BN(50000 * 10 ** 6),  // 50,000 USDT
  );
  console.log("✅ Deposited 5 BTC and 50,000 USDT");
  console.log("");

  // Place buy orders
  console.log("🟢 Placing BUY orders...");

  const buyOrders = [
    { price: 40000, size: 0.5 },  // Buy 0.5 BTC @ $40,000
    { price: 39500, size: 1.0 },  // Buy 1.0 BTC @ $39,500
    { price: 39000, size: 1.5 },  // Buy 1.5 BTC @ $39,000
  ];

  for (const order of buyOrders) {
    const priceInLots = Math.floor(order.price / 1);
    const sizeInLots = Math.floor((order.size * 10 ** 8) / 100);

    const placeOrderArgs: PlaceOrderArgs = {
      side: Side.Bid,
      priceLots: new BN(priceInLots),
      maxBaseLots: new BN(sizeInLots),
      maxQuoteLotsIncludingFees: new BN(order.price * order.size * 1.01 * 10 ** 6),
      clientOrderId: new BN(Date.now()),
      orderType: { limit: {} },
      expiryTimestamp: new BN(0),
      selfTradeBehavior: { decrementTake: {} },
      limit: 255,
    };

    try {
      const tx = await client.placeOrder(
        openOrdersPk,
        marketPk,
        placeOrderArgs
      );
      console.log(`  ✅ BUY ${order.size} BTC @ $${order.price} - Tx: ${tx.substring(0, 20)}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.log(`  ❌ Failed: ${error.message}`);
    }
  }
  console.log("");

  // Place sell orders
  console.log("🔴 Placing SELL orders...");

  const sellOrders = [
    { price: 41000, size: 0.5 },  // Sell 0.5 BTC @ $41,000
    { price: 41500, size: 1.0 },  // Sell 1.0 BTC @ $41,500
    { price: 42000, size: 1.5 },  // Sell 1.5 BTC @ $42,000
  ];

  for (const order of sellOrders) {
    const priceInLots = Math.floor(order.price / 1);
    const sizeInLots = Math.floor((order.size * 10 ** 8) / 100);

    const placeOrderArgs: PlaceOrderArgs = {
      side: Side.Ask,
      priceLots: new BN(priceInLots),
      maxBaseLots: new BN(sizeInLots),
      maxQuoteLotsIncludingFees: new BN(1),
      clientOrderId: new BN(Date.now()),
      orderType: { limit: {} },
      expiryTimestamp: new BN(0),
      selfTradeBehavior: { decrementTake: {} },
      limit: 255,
    };

    try {
      const tx = await client.placeOrder(
        openOrdersPk,
        marketPk,
        placeOrderArgs
      );
      console.log(`  ✅ SELL ${order.size} BTC @ $${order.price} - Tx: ${tx.substring(0, 20)}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.log(`  ❌ Failed: ${error.message}`);
    }
  }

  console.log("\n✅ Orders placed! Check the indexer API:");
  console.log(`   curl http://localhost:42070/api/depth?symbol=${marketInfo.market}`);
}

main().catch(console.error);
