import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getKeypairFromFile } from "./utils";
import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
  findAllMarkets,
} from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as os from "os";
import * as fs from "fs";

// Configuration
const RPC = process.env.SOLANA_RPC_URL || "http://localhost:8899";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const NUM_TRADERS = parseInt(process.env.NUM_TRADERS || "3");
const ORDERS_PER_TRADER = parseInt(process.env.ORDERS_PER_TRADER || "3");

interface MarketInfo {
  address: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  name: string;
}

async function getMarkets(connection: Connection, provider: AnchorProvider): Promise<MarketInfo[]> {
  const markets = await findAllMarkets(connection, PROGRAM_ID, provider);
  return markets.map((m: any) => ({
    address: new PublicKey(m.market),
    baseMint: new PublicKey(m.baseMint),
    quoteMint: new PublicKey(m.quoteMint),
    name: m.name,
  }));
}

async function generateOrLoadKeypair(filename: string): Promise<Keypair> {
  const keypairPath = `${os.homedir()}/.config/solana/${filename}`;

  if (fs.existsSync(keypairPath)) {
    console.log(`   Loading existing keypair: ${filename}`);
    return getKeypairFromFile(keypairPath);
  } else {
    console.log(`   Generating new keypair: ${filename}`);
    const keypair = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
    return keypair;
  }
}

async function fundWallet(
  connection: Connection,
  wallet: PublicKey,
  amount: number
): Promise<void> {
  try {
    const signature = await connection.requestAirdrop(
      wallet,
      amount * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
    console.log(`   ✅ Funded ${wallet.toBase58().slice(0, 8)}... with ${amount} SOL`);
  } catch (error) {
    console.log(`   ⚠️  Airdrop failed for ${wallet.toBase58().slice(0, 8)}..., may already have funds`);
  }
}

async function setupTraderTokenAccounts(
  connection: Connection,
  authority: Keypair,
  trader: Keypair,
  market: MarketInfo
): Promise<void> {
  const mintUtils = new MintUtils(connection, authority);

  // Create token accounts
  const baseAcc = await mintUtils.getOrCreateTokenAccount(
    market.baseMint,
    authority,
    trader.publicKey
  );
  const quoteAcc = await mintUtils.getOrCreateTokenAccount(
    market.quoteMint,
    authority,
    trader.publicKey
  );

  // Mint tokens
  await mintUtils.mintTo(market.baseMint, baseAcc.address);
  await mintUtils.mintTo(market.quoteMint, quoteAcc.address);
}

async function placeOrderForTrader(
  connection: Connection,
  trader: Keypair,
  market: MarketInfo,
  marketAccount: any,
  side: Side,
  price: number,
  size: number,
  orderType: any
): Promise<void> {
  const traderWallet = new Wallet(trader);
  const traderProvider = new AnchorProvider(
    connection,
    traderWallet,
    { commitment: "confirmed" }
  );
  const traderClient = new OpenBookV2Client(traderProvider);

  const [openOrdersAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("OpenOrders"),
      trader.publicKey.toBuffer(),
      market.address.toBuffer(),
    ],
    PROGRAM_ID
  );

  // Create open orders account if needed
  try {
    const openOrdersInfo = await connection.getAccountInfo(openOrdersAccount);
    if (!openOrdersInfo) {
      await traderClient.createOpenOrders(trader.publicKey, market.address, "trader");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    await traderClient.createOpenOrders(trader.publicKey, market.address, "trader");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const mintUtils = new MintUtils(connection, trader);
  const userBaseAcc = await mintUtils.getOrCreateTokenAccount(
    market.baseMint,
    trader,
    trader.publicKey
  );
  const userQuoteAcc = await mintUtils.getOrCreateTokenAccount(
    market.quoteMint,
    trader,
    trader.publicKey
  );

  const orderArgs: PlaceOrderArgs = {
    side,
    priceLots: new BN(price),
    maxBaseLots: new BN(size),
    maxQuoteLotsIncludingFees: new BN(price * size * 2),
    clientOrderId: new BN(Date.now()),
    orderType,
    expiryTimestamp: new BN(0),
    selfTradeBehavior: { decrementTake: {} },
    limit: 10,
  };

  try {
    const userTokenAcc = side.bid ? userQuoteAcc.address : userBaseAcc.address;
    const [ix, signers] = await traderClient.placeOrderIx(
      openOrdersAccount,
      market.address,
      marketAccount,
      userTokenAcc,
      null,
      orderArgs,
      []
    );

    await traderClient.sendAndConfirmTransaction([ix], {
      additionalSigners: signers ? [signers] : [],
    });

    const sideStr = side.bid ? "BUY" : "SELL";
    const typeStr = orderType.limit ? "LIMIT" : "MARKET";
    console.log(`   ✅ ${trader.publicKey.toBase58().slice(0, 8)}... placed ${typeStr} ${sideStr} order`);
  } catch (error: any) {
    console.log(`   ❌ Failed to place order: ${error.message?.split('\n')[0] || error}`);
  }
}

async function main() {
  console.log("🚀 Multi-Wallet Trading Script");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);
  const connection = new Connection(RPC, { commitment: "confirmed" });
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  const client = new OpenBookV2Client(provider);

  console.log("🔑 Authority:", authority.publicKey.toBase58());
  console.log("🌐 RPC:", RPC);
  console.log("👥 Number of traders:", NUM_TRADERS);
  console.log("📝 Orders per trader:", ORDERS_PER_TRADER);
  console.log("");

  // Get markets
  console.log("📊 Fetching markets...");
  const markets = await getMarkets(connection, provider);
  if (markets.length === 0) {
    throw new Error("No markets found. Please deploy first.");
  }
  console.log(`✅ Found ${markets.length} market(s)\n`);

  // Use first market
  const market = markets[0];
  console.log(`🎯 Trading on: ${market.name}`);
  console.log(`   Market: ${market.address.toBase58()}`);
  console.log(`   Base:   ${market.baseMint.toBase58()}`);
  console.log(`   Quote:  ${market.quoteMint.toBase58()}\n`);

  // Get market account
  const marketAccount = await client.deserializeMarketAccount(market.address);
  if (!marketAccount) {
    throw new Error("Failed to deserialize market account");
  }

  // Generate trader keypairs
  console.log("👥 Setting up traders...");
  const traders: Keypair[] = [];
  for (let i = 0; i < NUM_TRADERS; i++) {
    const trader = await generateOrLoadKeypair(`trader-${i}.json`);
    traders.push(trader);
  }
  console.log("");

  // Fund traders
  console.log("💰 Funding traders with SOL...");
  for (const trader of traders) {
    await fundWallet(connection, trader.publicKey, 2);
  }
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log("");

  // Setup token accounts and mint tokens
  console.log("🪙 Setting up token accounts and minting tokens...");
  for (let i = 0; i < traders.length; i++) {
    console.log(`   Trader ${i + 1}/${traders.length}...`);
    await setupTraderTokenAccounts(connection, authority, traders[i], market);
  }
  console.log("");

  // Phase 1: Fill order book with limit orders
  console.log("📈 Phase 1: Filling order book with limit orders...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  for (let i = 0; i < traders.length; i++) {
    const trader = traders[i];
    console.log(`\n👤 Trader ${i + 1} (${trader.publicKey.toBase58().slice(0, 8)}...):`);

    for (let j = 0; j < ORDERS_PER_TRADER; j++) {
      // Place buy orders at different price levels
      const buyPrice = 90 - (i * 5) - (j * 2); // Descending prices
      await placeOrderForTrader(
        connection,
        trader,
        market,
        marketAccount,
        { bid: {} } as Side,
        buyPrice,
        10,
        { limit: {} }
      );

      await new Promise(resolve => setTimeout(resolve, 800));

      // Place sell orders at different price levels
      const sellPrice = 110 + (i * 5) + (j * 2); // Ascending prices
      await placeOrderForTrader(
        connection,
        trader,
        market,
        marketAccount,
        { ask: {} } as Side,
        sellPrice,
        10,
        { limit: {} }
      );

      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  console.log("\n\n📊 Phase 2: Placing market orders...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Place some market orders to execute trades
  for (let i = 0; i < Math.min(2, traders.length); i++) {
    const trader = traders[i];
    console.log(`\n👤 Trader ${i + 1} (${trader.publicKey.toBase58().slice(0, 8)}...):`);

    // Market buy
    await placeOrderForTrader(
      connection,
      trader,
      market,
      marketAccount,
      { bid: {} } as Side,
      200, // High price to ensure execution
      5,
      { market: {} }
    );

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Market sell
    await placeOrderForTrader(
      connection,
      trader,
      market,
      marketAccount,
      { ask: {} } as Side,
      1, // Low price to ensure execution
      5,
      { market: {} }
    );

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ TRADING COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📝 Summary:");
  console.log(`   Traders used: ${traders.length}`);
  console.log(`   Limit orders placed: ~${traders.length * ORDERS_PER_TRADER * 2}`);
  console.log(`   Market orders placed: ~${Math.min(2, traders.length) * 2}`);
  console.log("");
  console.log("🔗 View order book:");
  console.log("   pnpm order-book");
  console.log("");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
