import {
  Connection,
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
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
  console.log("🚀 Simple Market Creation Test\n");

  // Set environment variable
  process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(LOCAL_RPC, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000,
  });
  const keypairData = JSON.parse(
    fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8")
  );
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("Authority:", authority.publicKey.toString());
  console.log("Balance:", (await connection.getBalance(authority.publicKey)) / 1e9, "SOL\n");

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const client = new OpenBookV2Client(provider, LOCAL_PROGRAM_ID);

  // Create tokens
  console.log("📦 Creating tokens...");
  const mintUtils = new MintUtils(connection, authority);

  const baseMint = await mintUtils.createMint(8);
  console.log("✅ Base token (BTC):", baseMint.toString());

  const quoteMint = await mintUtils.createMint(6);
  console.log("✅ Quote token (USDT):", quoteMint.toString());

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Create market with minimal parameters
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
      new BN(0),          // makerFee (0 basis points)
      new BN(0),          // takerFee (0 basis points)
      new BN(0),          // timeExpiry
      null,               // oracleA
      null,               // oracleB
      null,               // openOrdersAdmin
      null,               // consumeEventsAdmin
      null                // closeMarketAdmin
    );

    // Add compute budget to avoid ProgramFailedToComplete
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });

    // Prepend compute budget instruction
    ixs.unshift(computeBudgetIx);

    const tx = await client.sendAndConfirmTransaction(ixs, {
      additionalSigners: signers,
    });

    console.log("✅ Market created successfully!");
    console.log("Transaction:", tx);
    console.log("");

    // Wait a bit then list markets
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("📋 Listing markets...");
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
  } catch (error: any) {
    console.error("❌ Error:", error.message || error);
    if (error.logs) {
      console.error("\nTransaction logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
  }
}

main().catch(console.error);
