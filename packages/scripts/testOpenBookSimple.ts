import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";
import { getKeypairFromFile } from "./utils";
import * as os from "os";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET_ADDRESS = new PublicKey("HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🧪 Testing OpenBook Operations on Devnet\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);
  const connection = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const client = new OpenBookV2Client(provider);

  console.log("🔑 Authority:", authority.publicKey.toBase58());
  console.log("🌐 RPC:", RPC);
  console.log("📊 Market:", MARKET_ADDRESS.toBase58());
  console.log("");

  // Test 1: Load market
  console.log("📝 TEST 1: Load Market Account");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const market = await client.deserializeMarketAccount(MARKET_ADDRESS);

    if (market) {
      console.log("   ✅ Market loaded successfully!");
      console.log("   Name:", typeof market.name === 'string' ? market.name : String.fromCharCode(...market.name));
      console.log("   Base:", market.baseMint.toBase58());
      console.log("   Quote:", market.quoteMint.toBase58());
    } else {
      console.log("   ❌ Market returned null");
    }
  } catch (error: any) {
    console.log("   ❌ Failed to load market:", error.message?.split('\n')[0]);
  }

  console.log("");
  await sleep(2000);

  // Test 2: Create OpenOrders account
  console.log("📝 TEST 2: Create OpenOrders Account");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const [openOrdersAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("OpenOrders"),
      authority.publicKey.toBuffer(),
      MARKET_ADDRESS.toBuffer(),
    ],
    PROGRAM_ID
  );

  console.log("   PDA:", openOrdersAccount.toBase58());

  try {
    // Check if exists first
    const existingAccount = await connection.getAccountInfo(openOrdersAccount);

    if (existingAccount) {
      console.log("   ℹ️  Account already exists");
      console.log("   Owner:", existingAccount.owner.toBase58());
      console.log("   Is OpenBook owned:", existingAccount.owner.equals(PROGRAM_ID) ? "✅ Yes" : "❌ No");
    } else {
      console.log("   Creating OpenOrders account...");

      const tx = await client.createOpenOrders(authority, MARKET_ADDRESS, "test");
      console.log("   ✅ Transaction confirmed:", tx.toString().slice(0, 20) + "...");

      // Immediate verification (like basic test)
      console.log("   Verifying immediately...");
      await sleep(2000);

      const accountInfo = await connection.getAccountInfo(openOrdersAccount);

      if (accountInfo) {
        console.log("   ✅ Account exists!");
        console.log("   Owner:", accountInfo.owner.toBase58());

        if (accountInfo.owner.equals(PROGRAM_ID)) {
          console.log("   ✅ Correctly owned by OpenBook program!");
        } else if (accountInfo.owner.toBase58() === "11111111111111111111111111111111") {
          console.log("   ⚠️  Still owned by System Program");
          console.log("   ⏳ Waiting 10 more seconds...");

          await sleep(10000);
          const accountInfo2 = await connection.getAccountInfo(openOrdersAccount);

          if (accountInfo2 && accountInfo2.owner.equals(PROGRAM_ID)) {
            console.log("   ✅ Now correctly owned by OpenBook!");
          } else {
            console.log("   ❌ Still wrong owner after 10s");
          }
        }
      } else {
        console.log("   ❌ Account not found immediately");

        await sleep(10000);
        const accountInfo2 = await connection.getAccountInfo(openOrdersAccount);

        if (accountInfo2) {
          console.log("   ✅ Account found after 10s wait");
          console.log("   Owner:", accountInfo2.owner.toBase58());
        } else {
          console.log("   ❌ Account still not found after 10s");
        }
      }
    }
  } catch (error: any) {
    console.log("   ❌ Failed:", error.message?.split('\n')[0]);

    if (error.logs) {
      console.log("\n   📋 Transaction logs:");
      error.logs.slice(0, 10).forEach((log: string) => console.log("      ", log));
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Test Complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
