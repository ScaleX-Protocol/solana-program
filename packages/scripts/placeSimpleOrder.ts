import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import {  OpenBookV2Client, PlaceOrderArgs, Side } from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import { getKeypairFromFile } from "./utils";
import * as os from "os";

const RPC = process.env.SOLANA_RPC_URL || "https://devnet.helius-rpc.com/?api-key=e8252302-cdec-44d0-80d2-3efac7c0b50c";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET_ADDRESS = new PublicKey(process.env.MARKET_ADDRESS || "HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

async function main() {
  console.log("🚀 Placing Simple Order on BTC/USDT\n");

  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);

  const connection = new Connection(RPC, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 120000, // 120 seconds
  });

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    skipPreflight: true, // Skip preflight on devnet to avoid timeout
  });

  const client = new OpenBookV2Client(provider, PROGRAM_ID);

  console.log("📊 Market:", MARKET_ADDRESS.toString());
  console.log("🔑 Authority:", authority.publicKey.toString());
  console.log("");

  // Get market account
  const market = await client.deserializeMarketAccount(MARKET_ADDRESS);
  if (!market) {
    throw new Error("Market not found");
  }

  console.log("✅ Market loaded:");
  console.log(`   Base:  ${market.baseMint.toString()}`);
  console.log(`   Quote: ${market.quoteMint.toString()}\n`);

  // Get open orders account
  const [openOrdersAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("OpenOrders"),
      authority.publicKey.toBuffer(),
      MARKET_ADDRESS.toBuffer(),
    ],
    PROGRAM_ID
  );

  // Create open orders account if needed
  try {
    const openOrdersInfo = await connection.getAccountInfo(openOrdersAccount);
    if (!openOrdersInfo) {
      console.log("📝 Creating OpenOrders account...");
      await client.createOpenOrders(authority, MARKET_ADDRESS, "trader");
      console.log("✅ OpenOrders account created\n");
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log("✅ OpenOrders account exists\n");
    }
  } catch (error) {
    console.log("📝 Creating OpenOrders account...");
    await client.createOpenOrders(authority, MARKET_ADDRESS, "trader");
    console.log("✅ OpenOrders account created\n");
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Setup token accounts
  const mintUtils = new MintUtils(connection, authority);

  const userBaseAcc = await mintUtils.getOrCreateTokenAccount(
    market.baseMint,
    authority,
    authority.publicKey
  );
  const userQuoteAcc = await mintUtils.getOrCreateTokenAccount(
    market.quoteMint,
    authority,
    authority.publicKey
  );

  // Mint tokens if needed
  console.log("🪙 Minting tokens...");
  await mintUtils.mintTo(market.baseMint, userBaseAcc.address);
  await mintUtils.mintTo(market.quoteMint, userQuoteAcc.address);
  console.log("✅ Tokens minted\n");

  // Place a BUY order
  console.log("📈 Placing BUY limit order...");
  const buyArgs: PlaceOrderArgs = {
    side: { bid: {} } as Side,
    priceLots: new BN(95), // Price
    maxBaseLots: new BN(10), // Quantity
    maxQuoteLotsIncludingFees: new BN(100000),
    clientOrderId: new BN(Date.now()),
    orderType: { limit: {} },
    expiryTimestamp: new BN(0),
    selfTradeBehavior: { decrementTake: {} },
    limit: 10,
  };

  try {
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
    if (signers && typeof signers === 'object' && '_bn' in signers) {
      additionalSigners.push(signers);
    }

    const tx = await client.sendAndConfirmTransaction([ix], {
      additionalSigners,
    });

    console.log("✅ BUY order placed!");
    console.log(`   TX: ${tx}\n`);
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message?.split('\n')[0] || error}\n`);
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Place a SELL order
  console.log("📉 Placing SELL limit order...");
  const sellArgs: PlaceOrderArgs = {
    side: { ask: {} } as Side,
    priceLots: new BN(105), // Price
    maxBaseLots: new BN(10), // Quantity
    maxQuoteLotsIncludingFees: new BN(100000),
    clientOrderId: new BN(Date.now()),
    orderType: { limit: {} },
    expiryTimestamp: new BN(0),
    selfTradeBehavior: { decrementTake: {} },
    limit: 10,
  };

  try {
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
    if (signers && typeof signers === 'object' && '_bn' in signers) {
      additionalSigners.push(signers);
    }

    const tx = await client.sendAndConfirmTransaction([ix], {
      additionalSigners,
    });

    console.log("✅ SELL order placed!");
    console.log(`   TX: ${tx}\n`);
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message?.split('\n')[0] || error}\n`);
  }

  console.log("✨ Order placement complete!\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
