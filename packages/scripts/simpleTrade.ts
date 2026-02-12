import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { getKeypairFromFile } from "./utils";
import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
} from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as os from "os";

// Use local validator
const RPC = "http://localhost:8899";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

// Our newly created market
const BTC_USDT_MARKET = new PublicKey("EeTzCDqbj6Nrw4fpxxiv8WZggN6bxe65w7rEvheiXkLN");

// Our deployed tokens
const BTC_MINT = new PublicKey("5RiRDrHEFgBsVCiHdgvV74MWZ3hFn4f579HhDepXrfvH");
const USDT_MINT = new PublicKey("357nLDRMomkNx8zRwFnANsJC6KQzneiMy4Qmk1dtbxKR");

async function main() {
  console.log("🎯 Simple Trading Demo - BTC/USDT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(
    new Connection(RPC, { commitment: "processed" }),
    wallet,
    {
      commitment: "processed",
      preflightCommitment: "processed",
    }
  );
  const client = new OpenBookV2Client(provider, PROGRAM_ID);

  console.log("👤 Trader:", client.walletPk.toBase58());

  // Get market
  const marketPk = BTC_USDT_MARKET;
  const market = await client.deserializeMarketAccount(marketPk);
  if (!market) {
    throw new Error("Market not found");
  }

  console.log("📊 Market: BTC/USDT");
  console.log("   Address:", marketPk.toBase58());
  console.log();

  // Create open orders account
  console.log("📝 Creating Open Orders Account...");
  const openOrdersAccount = await client.createOpenOrders(
    authority,
    marketPk,
    "BTC-USDT"
  );
  console.log("✅ Open Orders:", openOrdersAccount.toBase58());
  console.log();

  //Setup token accounts and mint
  let mintUtils = new MintUtils(provider.connection, authority);

  console.log("💰 Setting up token accounts...");
  const userQuoteAcc = await mintUtils.getOrCreateTokenAccount(
    market.quoteMint,
    authority,
    client.walletPk
  );
  const userBaseAcc = await mintUtils.getOrCreateTokenAccount(
    market.baseMint,
    authority,
    client.walletPk
  );

  console.log("   BTC Account:", userBaseAcc.address.toBase58());
  console.log("   USDT Account:", userQuoteAcc.address.toBase58());
  console.log();

  console.log("🪙 Minting tokens...");
  await mintUtils.mintTo(market.quoteMint, userQuoteAcc.address);
  await mintUtils.mintTo(market.baseMint, userBaseAcc.address);
  console.log("✅ Tokens minted");
  console.log();

  // Place BUY orders (bids)
  console.log("📈 Placing BUY orders (bids)...");
  const nbOrders = 5;
  for (let i = 0; i < nbOrders; ++i) {
    let side = { bid: {} };
    let placeOrder = { limit: {} };
    let selfTradeBehavior = { decrementTake: {} };

    let args: PlaceOrderArgs = {
      side,
      priceLots: new BN(1000 - 1 - i),
      maxBaseLots: new BN(10),
      maxQuoteLotsIncludingFees: new BN(1000000),
      clientOrderId: new BN(i),
      orderType: placeOrder,
      expiryTimestamp: new BN(0),
      selfTradeBehavior: selfTradeBehavior,
      limit: 255,
    };

    const result = await client.placeOrderIx(
      openOrdersAccount,
      marketPk,
      market,
      userQuoteAcc.address,  // Pay from: USDT for buying BTC
      userBaseAcc.address,    // Receive to: BTC account
      args,
      []
    );
    const ix = result[0];
    const tx = await client.sendAndConfirmTransaction([ix]);
    console.log(`   ✅ BUY Order #${i + 1} placed - Price: ${args.priceLots.toString()} lots - TX: ${tx.slice(0, 16)}...`);
  }

  console.log();

  // Place SELL orders (asks)
  console.log("📉 Placing SELL orders (asks)...");
  for (let i = 0; i < nbOrders; ++i) {
    let side = { ask: {} };
    let placeOrder = { limit: {} };
    let selfTradeBehavior = { decrementTake: {} };

    let args: PlaceOrderArgs = {
      side,
      priceLots: new BN(1000 + 1 + i),
      maxBaseLots: new BN(10000),
      maxQuoteLotsIncludingFees: new BN(1000000),
      clientOrderId: new BN(i + nbOrders + 1),
      orderType: placeOrder,
      expiryTimestamp: new BN(0),
      selfTradeBehavior: selfTradeBehavior,
      limit: 255,
    };
    let remainings = new Array<PublicKey>();

    const result = await client.placeOrderIx(
      openOrdersAccount,
      marketPk,
      market,
      userBaseAcc.address,    // Pay from: BTC for selling
      userQuoteAcc.address,   // Receive to: USDT account
      args,
      remainings
    );
    const ix = result[0];
    const tx = await client.sendAndConfirmTransaction([ix]);
    console.log(`   ✅ SELL Order #${i + 1} placed - Price: ${args.priceLots.toString()} lots - TX: ${tx.slice(0, 16)}...`);
  }

  console.log();
  console.log("✨ Trading Complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();
  console.log("📊 Orders Placed:");
  console.log(`   ${nbOrders} BUY orders (bids)`);
  console.log(`   ${nbOrders} SELL orders (asks)`);
  console.log();
  console.log("💡 View your orders:");
  console.log("   npm run view-markets");
  console.log();
}

main();
