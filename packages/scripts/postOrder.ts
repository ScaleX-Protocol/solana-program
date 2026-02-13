import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { authority } from "./utils";
import { RPC, programId } from "./utils";
import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
} from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";

async function main() {
  console.log("🚀 Placing Orders on BTC/USDT Market\n");

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(new Connection(RPC), wallet, {
    commitment: "confirmed",
    skipPreflight: true, // Skip preflight on devnet
  });
  const client = new OpenBookV2Client(provider);

  // Create or get open orders account for this market
  const marketPublicKey = new PublicKey(
    process.env.MARKET_ADDRESS || "HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6" // BTC/USDT market on devnet
  );

  // Get or create open orders account
  const [openOrdersPublicKey] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("OpenOrders"),
      authority.publicKey.toBuffer(),
      marketPublicKey.toBuffer(),
    ],
    programId
  );

  console.log("📊 Market:", marketPublicKey.toString());
  console.log("🔑 Authority:", authority.publicKey.toString());
  console.log("");

  const market = await client.deserializeMarketAccount(marketPublicKey);
  if (!market) {
    throw "No market";
  }

  console.log("✅ Market loaded");
  console.log(`   Base:  ${market.baseMint.toString()}`);
  console.log(`   Quote: ${market.quoteMint.toString()}\n`);

  // Create OpenOrders account if it doesn't exist
  try {
    const openOrdersInfo = await provider.connection.getAccountInfo(openOrdersPublicKey);
    if (!openOrdersInfo || openOrdersInfo.owner.toBase58() === "11111111111111111111111111111111") {
      console.log("📝 Creating OpenOrders account...");
      try {
        const tx = await client.createOpenOrders(authority, marketPublicKey, "trader");
        console.log(`✅ OpenOrders account created! TX: ${tx.toString().slice(0, 20)}...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for confirmation

        // Verify it was created correctly
        const verifyInfo = await provider.connection.getAccountInfo(openOrdersPublicKey);
        if (verifyInfo && verifyInfo.owner.toBase58() === programId.toBase58()) {
          console.log("✅ OpenOrders account verified\n");
        } else {
          throw new Error("OpenOrders account creation failed - wrong owner");
        }
      } catch (createError: any) {
        console.error("❌ Failed to create OpenOrders:", createError.message);
        throw createError;
      }
    } else {
      console.log("✅ OpenOrders account exists");
      console.log(`   Owner: ${openOrdersInfo.owner.toBase58()}\n`);
    }
  } catch (error) {
    console.error("❌ Error with OpenOrders account:", error);
    throw error;
  }

  let mintUtils = new MintUtils(provider.connection, authority);
  const userQuoteAcc = await mintUtils.getOrCreateTokenAccount(
    market?.quoteMint,
    authority,
    client.walletPk
  );
  const userBaseAcc = await mintUtils.getOrCreateTokenAccount(
    market?.baseMint,
    authority,
    client.walletPk
  );
  console.log("🪙 Minting tokens...");
  await mintUtils.mintTo(market?.quoteMint, userQuoteAcc.address);
  await mintUtils.mintTo(market?.baseMint, userBaseAcc.address);
  console.log("✅ Tokens minted\n");

  const nbOrders: number = 1; // Just 1 order for debugging
  console.log(`📝 Placing ${nbOrders} BUY order(s)...\n`);
  for (let i = 0; i < nbOrders; ++i) {
    try {
      let side = { bid: {} } as Side;
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

      console.log(`   Order details: Price=${1000-1-i}, Size=10`);
      console.log(`   Quote account: ${userQuoteAcc.address.toString()}`);
      console.log(`   OpenOrders: ${openOrdersPublicKey.toString()}`);

      const [ix, signers] = await client.placeOrderIx(
        openOrdersPublicKey,
        marketPublicKey,
        market,
        userQuoteAcc.address,
        null,
        args,
        []
      );

      // Handle signers properly - filter out undefined values
      const additionalSigners = [];
      if (signers && typeof signers === 'object' && 'publicKey' in signers) {
        additionalSigners.push(signers);
      }

      const tx = await client.sendAndConfirmTransaction([ix], {
        additionalSigners,
      });
      console.log(`✅ BUY order ${i + 1}/${nbOrders} placed:`, tx.slice(0, 20) + "...");
      await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between orders
    } catch (error: any) {
      console.error(`❌ Failed to place BUY order ${i + 1}:`, error.message || error);
      if (error.logs) {
        console.log("\n📋 Transaction logs:");
        error.logs.forEach((log: string) => console.log("   ", log));
      }
      throw error;
    }
  }

  console.log(`\n📝 Placing ${nbOrders} SELL orders...\n`);

  for (let i = 0; i < nbOrders; ++i) {
    let side = { ask: {} } as Side;
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

    const [ix, signers] = await client.placeOrderIx(
      openOrdersPublicKey,
      marketPublicKey,
      market,
      userBaseAcc.address,
      null,
      args,
      remainings
    );

    // Handle signers properly - filter out undefined values
    const additionalSigners = [];
    if (signers && typeof signers === 'object' && 'publicKey' in signers) {
      additionalSigners.push(signers);
    }

    const tx = await client.sendAndConfirmTransaction([ix], {
      additionalSigners,
    });
    console.log(`✅ SELL order ${i + 1}/${nbOrders} placed:`, tx.slice(0, 20) + "...");
    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between orders
  }

  console.log("\n✨ All orders placed successfully!\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
