import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
} from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as os from "os";
import * as fs from "fs";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET_ADDRESS = new PublicKey(process.env.MARKET_ADDRESS || "HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

function getKeypairFromFile(filePath: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf-8")))
  );
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Simple Order Placement on Devnet\n");

  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);
  const connection = new Connection(RPC, { commitment: "confirmed" });
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const client = new OpenBookV2Client(provider);

  console.log("🔑 Authority:", authority.publicKey.toBase58());
  console.log("🌐 RPC:", RPC);
  console.log("📊 Market:", MARKET_ADDRESS.toBase58());
  console.log("");

  // Get market
  const marketAccount = await client.deserializeMarketAccount(MARKET_ADDRESS);
  if (!marketAccount) {
    throw new Error("Failed to load market");
  }

  console.log("✅ Market loaded:", typeof marketAccount.name === 'string' ? marketAccount.name : String.fromCharCode(...marketAccount.name));
  console.log("");

  // OpenOrders PDA
  const [openOrdersAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("OpenOrders"),
      authority.publicKey.toBuffer(),
      MARKET_ADDRESS.toBuffer(),
    ],
    PROGRAM_ID
  );

  // Create OpenOrders (ignore errors if exists)
  console.log("📝 Creating OpenOrders account...");
  try {
    await client.createOpenOrders(authority, MARKET_ADDRESS, "trader");
    console.log("✅ Created");
    await sleep(15000); // Wait 15 seconds
  } catch (e: any) {
    console.log("✅ Already exists or created");
    await sleep(5000);
  }

  // Setup tokens
  const mintUtils = new MintUtils(connection, authority);
  const userBaseAcc = await mintUtils.getOrCreateTokenAccount(marketAccount.baseMint, authority, authority.publicKey);
  const userQuoteAcc = await mintUtils.getOrCreateTokenAccount(marketAccount.quoteMint, authority, authority.publicKey);

  await mintUtils.mintTo(marketAccount.baseMint, userBaseAcc.address);
  await mintUtils.mintTo(marketAccount.quoteMint, userQuoteAcc.address);
  console.log("✅ Tokens ready\n");

  await sleep(5000);

  // Place BUY order
  console.log("📈 Placing BUY order...");
  try {
    const buyArgs: PlaceOrderArgs = {
      side: { bid: {} } as Side,
      priceLots: new BN(95),
      maxBaseLots: new BN(10),
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
      marketAccount,
      userQuoteAcc.address,
      null,
      buyArgs,
      []
    );

    await client.sendAndConfirmTransaction([ix], {
      additionalSigners: signers ? [signers] : [],
    });

    console.log("✅ BUY order placed!\n");
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message?.split('\n')[0] || error}\n`);
  }

  await sleep(5000);

  // Place SELL order  
  console.log("📉 Placing SELL order...");
  try {
    const sellArgs: PlaceOrderArgs = {
      side: { ask: {} } as Side,
      priceLots: new BN(105),
      maxBaseLots: new BN(10),
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
      marketAccount,
      userBaseAcc.address,
      null,
      sellArgs,
      []
    );

    await client.sendAndConfirmTransaction([ix], {
      additionalSigners: signers ? [signers] : [],
    });

    console.log("✅ SELL order placed!\n");
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message?.split('\n')[0] || error}\n`);
  }

  console.log("✨ Done!\n");
}

main().catch(console.error);
