import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
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

// Our deployed markets (updated after validator restart)
const BTC_USDT_MARKET = new PublicKey("9iBYgJBWtgjwjeQHvPB4xZNqtzdNPC97tV2vjnVFQwW9");
const WETH_USDT_MARKET = new PublicKey("CR6sRovnYSxUWfeMUmGBr5FWi6nStLJ9VRNbe7mDpYct");

// Our deployed tokens
const BTC_MINT = new PublicKey("Gjy6pMppjAaib6e2oH75kqQMLTH1BU1MnndMqxQ2mKp1");
const USDT_MINT = new PublicKey("3wnoHsL2MvwhwZPUEJUmHpYjuy6sSqRqsUfVkcVBfWP4");
const WETH_MINT = new PublicKey("4FDi63kxcm8SYW1wPGbjyUoVYit4bcXZ9KJUc3AKh6zC");

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTradingScenario() {
  console.log("🎯 OpenBook V2 Trading Demo");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Setup
  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(new Connection(RPC), wallet, {
    commitment: "confirmed",
  });
  const client = new OpenBookV2Client(provider, PROGRAM_ID);
  const mintUtils = new MintUtils(provider.connection, authority);

  console.log("👤 Trader:", client.walletPk.toBase58());
  console.log();

  // Choose market - let's trade BTC/USDT
  const marketPk = BTC_USDT_MARKET;
  console.log("📊 Market: BTC/USDT");
  console.log("   Address:", marketPk.toBase58());

  const market = await client.deserializeMarketAccount(marketPk);
  if (!market) {
    throw new Error("Market not found");
  }

  console.log("   Base: BTC");
  console.log("   Quote: USDT");
  console.log();

  // Step 1: Create or get open orders account
  console.log("📝 Step 1: Creating Open Orders Account...");
  const openOrdersAccount = await client.createOpenOrders(
    authority,
    marketPk,
    "BTC-USDT-OO"
  );
  console.log("✅ Open Orders:", openOrdersAccount.toBase58());
  console.log();

  // Step 2: Get or create token accounts
  console.log("💰 Step 2: Setting up token accounts...");
  const userBtcAcc = await mintUtils.getOrCreateTokenAccount(
    BTC_MINT,
    authority,
    client.walletPk
  );
  const userUsdtAcc = await mintUtils.getOrCreateTokenAccount(
    USDT_MINT,
    authority,
    client.walletPk
  );

  console.log("   BTC Account:", userBtcAcc.address.toBase58());
  console.log("   USDT Account:", userUsdtAcc.address.toBase58());
  console.log();

  // Step 3: Mint tokens to trader
  console.log("🪙 Step 3: Minting tokens to trader...");

  // Mint BTC and USDT (mintTo has hardcoded amount of 1000000000000)
  await mintUtils.mintTo(BTC_MINT, userBtcAcc.address);
  await mintUtils.mintTo(USDT_MINT, userUsdtAcc.address);

  console.log("✅ Minted BTC (10,000 BTC with 8 decimals)");
  console.log("✅ Minted USDT (1,000,000 USDT with 6 decimals)");
  console.log();

  await sleep(2000);

  // Step 4: Place BUY orders (bids) - buying BTC with USDT
  console.log("📈 Step 4: Placing BUY orders (bids)...");

  const nbBuyOrders = 5;
  for (let i = 0; i < nbBuyOrders; i++) {
    const args: PlaceOrderArgs = {
      side: Side.Bid,
      priceLots: new BN(1000 - 1 - i),  // Decreasing prices
      maxBaseLots: new BN(10 + i * 5),  // Increasing sizes
      maxQuoteLotsIncludingFees: new BN(1000000),
      clientOrderId: new BN(i),
      orderType: { limit: {} },
      expiryTimestamp: new BN(0),
      selfTradeBehavior: { decrementTake: {} },
      limit: 255,
    };

    try {
      const [ix, signers] = await client.placeOrderIx(
        openOrdersAccount,
        marketPk,
        market,
        userUsdtAcc.address,
        null,
        args,
        []
      );

      const tx = await client.sendAndConfirmTransaction([ix], {
        additionalSigners: signers ? [signers] : [],
      });

      console.log(`   ✅ BUY Order #${i + 1} - Price: ${args.priceLots.toString()} lots`);
      console.log(`      TX: ${tx.slice(0, 20)}...`);
    } catch (error: any) {
      console.log(`   ⚠️  Order #${i + 1} failed: ${error.message}`);
    }

    await sleep(500);
  }
  console.log();

  // Step 5: Place SELL orders (asks) - selling BTC for USDT
  console.log("📉 Step 5: Placing SELL orders (asks)...");

  const nbSellOrders = 5;
  for (let i = 0; i < nbSellOrders; i++) {
    const args: PlaceOrderArgs = {
      side: Side.Ask,
      priceLots: new BN(1000 + 1 + i),  // Increasing prices
      maxBaseLots: new BN(10 + i * 5),  // Increasing sizes
      maxQuoteLotsIncludingFees: new BN(1000000),
      clientOrderId: new BN(nbBuyOrders + i),
      orderType: { limit: {} },
      expiryTimestamp: new BN(0),
      selfTradeBehavior: { decrementTake: {} },
      limit: 255,
    };

    try {
      const [ix, signers] = await client.placeOrderIx(
        openOrdersAccount,
        marketPk,
        market,
        userBtcAcc.address,
        null,
        args,
        []
      );

      const tx = await client.sendAndConfirmTransaction([ix], {
        additionalSigners: signers ? [signers] : [],
      });

      console.log(`   ✅ SELL Order #${i + 1} - Price: ${args.priceLots.toString()} lots`);
      console.log(`      TX: ${tx.slice(0, 20)}...`);
    } catch (error: any) {
      console.log(`   ⚠️  Order #${i + 1} failed: ${error.message}`);
    }

    await sleep(500);
  }
  console.log();

  // Step 6: Summary
  console.log("✨ Trading Demo Complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();
  console.log("📊 Order Book Created:");
  console.log(`   ${nbBuyOrders} BUY orders (bids) from price lots 999 down`);
  console.log(`   ${nbSellOrders} SELL orders (asks) from price lots 1001 up`);
  console.log();
  console.log("💡 Next Steps:");
  console.log("   - View the order book: npm run view-markets");
  console.log("   - Place a market order to match against these orders");
  console.log("   - Check balances to see trades executed");
  console.log();
}

async function main() {
  try {
    await createTradingScenario();
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

main();
