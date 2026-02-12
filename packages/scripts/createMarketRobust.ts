import {
  Connection,
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client, findAllMarkets } from "@openbook-dex/openbook-v2";
import { MintUtils } from "./mint_utils";
import * as fs from "fs";

const LOCAL_RPC = "http://127.0.0.1:8899";
const LOCAL_PROGRAM_ID = new PublicKey(
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
);

async function main() {
  console.log("🚀 Robust Market Creation\n");

  process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(LOCAL_RPC, {
    commitment: "processed",
  });

  const keypairData = JSON.parse(
    fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8")
  );
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("Authority:", authority.publicKey.toString());
  const balance = await connection.getBalance(authority.publicKey);
  console.log("Balance:", balance / 1e9, "SOL\n");

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "processed",
    skipPreflight: true,
  });
  const client = new OpenBookV2Client(provider, LOCAL_PROGRAM_ID);

  // Create tokens
  console.log("📦 Creating tokens...");
  const mintUtils = new MintUtils(connection, authority);

  const baseMint = await mintUtils.createMint(8);
  console.log("✅ Base token (BTC):", baseMint.toString());

  const quoteMint = await mintUtils.createMint(6);
  console.log("✅ Quote token (USDT):", quoteMint.toString());

  // Wait for tokens to settle
  console.log("⏳ Waiting for tokens to settle...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Create market
  console.log("\n🏪 Creating BTC/USDT market...");

  try {
    const marketName = "BTC/USDT";
    const [ixs, signers] = await client.createMarketIx(
      authority.publicKey,
      marketName,
      quoteMint,
      baseMint,
      new BN(1),          // quoteLotSize
      new BN(100),        // baseLotSize
      new BN(0),          // makerFee
      new BN(0),          // takerFee
      new BN(0),          // timeExpiry
      null,               // oracleA
      null,               // oracleB
      null,               // openOrdersAdmin
      null,               // consumeEventsAdmin
      null                // closeMarketAdmin
    );

    // Add compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });

    // Build transaction manually for better control
    const tx = new Transaction();
    tx.add(computeBudgetIx);
    ixs.forEach(ix => tx.add(ix));

    // Get fresh blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('processed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;

    // Sign transaction
    tx.sign(authority, ...signers);

    // Send with retry logic
    console.log("📤 Sending transaction...");
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });

    console.log("✅ Transaction sent:", signature);
    console.log("⏳ Confirming...");

    // Confirm with timeout
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'processed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log("✅ Market created successfully!");
    console.log("Transaction signature:", signature);

    // Get market address from signers
    const marketPk = signers[0].publicKey;
    console.log("Market address:", marketPk.toString());
    console.log("");

    // Wait then list markets
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("📋 Listing all markets...");
    const markets = await findAllMarkets(
      connection,
      LOCAL_PROGRAM_ID,
      provider
    );

    console.log(`Found ${markets.length} market(s)`);
    if (markets.length > 0) {
      console.log("\nMarkets:");
      markets.forEach((m: any, i: number) => {
        console.log(`${i + 1}. ${m.name || 'Unknown'}`);
        console.log(`   Address: ${m.publicKey || m.address || 'N/A'}`);
      });
    }

    // Save market info for later use
    const marketInfo = {
      market: marketPk.toString(),
      baseMint: baseMint.toString(),
      quoteMint: quoteMint.toString(),
      name: marketName,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      'market-info.json',
      JSON.stringify(marketInfo, null, 2)
    );
    console.log("\n💾 Market info saved to market-info.json");

  } catch (error: any) {
    console.error("❌ Error:", error.message || error);
    if (error.logs) {
      console.error("\nTransaction logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
