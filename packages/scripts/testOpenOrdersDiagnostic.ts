import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";
import { getKeypairFromFile } from "./utils";
import * as os from "os";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET_ADDRESS = new PublicKey("HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

async function main() {
  console.log("🔬 OpenOrders Diagnostic Test\n");

  const authority = getKeypairFromFile(`${os.homedir()}/.config/solana/id.json`);
  const connection = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed", skipPreflight: true });
  const client = new OpenBookV2Client(provider);

  const [openOrdersPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("OpenOrders"), authority.publicKey.toBuffer(), MARKET_ADDRESS.toBuffer()],
    PROGRAM_ID
  );

  console.log("OpenOrders PDA:", openOrdersPDA.toBase58());

  // Check current state
  let before = await connection.getAccountInfo(openOrdersPDA);
  console.log("Before:", before ? `Exists (owner: ${before.owner.toBase58()})` : "Does not exist");

  if (before) {
    console.log("✅ Account already created!\n");
    console.log("This means previous attempts succeeded but verification failed.");
    console.log("The issue is ONLY with our verification timing, not creation!");
    return;
  }

  console.log("\nAttempting to create...");

  try {
    const result = await client.createOpenOrders(authority, MARKET_ADDRESS, "test");
    console.log("✅ SDK returned success");
    console.log("Result:", result.toString());

    // Wait and check
    console.log("\nWaiting 20 seconds for propagation...");
    await new Promise(r => setTimeout(r, 20000));

    let after = await connection.getAccountInfo(openOrdersPDA);
    console.log("After 20s:", after ? `✅ EXISTS (owner: ${after.owner.toBase58()})` : "❌ Still doesn't exist");

    if (after) {
      console.log("\n✨ SUCCESS! Account was created, just needs time to propagate.");
    } else {
      console.log("\n❌ FAILURE! Transaction succeeded but account not created.");
    }
  } catch (e: any) {
    console.error("❌ Creation failed:", e.message);
  }
}

main();
