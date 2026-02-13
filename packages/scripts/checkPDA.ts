import { PublicKey } from "@solana/web3.js";
import * as os from "os";
import * as fs from "fs";
import { Keypair } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET = new PublicKey("HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

function getKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf-8"))));
}

async function main() {
  const authority = getKeypair(`${os.homedir()}/.config/solana/id.json`);

  console.log("🔍 PDA Analysis\n");
  console.log("Authority:", authority.publicKey.toBase58());
  console.log("Market:", MARKET.toBase58());
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("");

  // Our OLD (incorrect) calculation with market
  const [openOrdersPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("OpenOrders"), authority.publicKey.toBuffer(), MARKET.toBuffer()],
    PROGRAM_ID
  );

  console.log("❌ Our OLD incorrect PDA (with market in seeds):");
  console.log("   Address:", openOrdersPDA.toBase58());
  console.log("");

  // The actual created accounts from the transaction
  console.log("✅ Actual created accounts:");
  console.log("   Account 1: E3UERqcKTYYAiZYjH3mXgYXBW8uqtqD29pDnNZZiTFVS (2545 bytes - OpenOrdersIndexer)");
  console.log("   Account 2: H7mVCELc8UqhJbWzsdaS8YReYT7yXABkzejwohwBKU5V (1264 bytes, contains 'test' - OpenOrders)");
  console.log("");

  const account1 = "E3UERqcKTYYAiZYjH3mXgYXBW8uqtqD29pDnNZZiTFVS";
  const account2 = "H7mVCELc8UqhJbWzsdaS8YReYT7yXABkzejwohwBKU5V";

  console.log("🔍 Checking CORRECT PDA derivation (with account index):");
  console.log("   OpenOrders PDA = findProgramAddress([\"OpenOrders\", owner, accountIndex])");
  console.log("");

  // Try with account_index (correct way)
  for (let i = 0; i < 10; i++) {
    const indexBuffer = Buffer.alloc(4);
    indexBuffer.writeUInt32LE(i);

    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("OpenOrders"), authority.publicKey.toBuffer(), indexBuffer],
      PROGRAM_ID
    );

    console.log(`   Index ${i}: ${pda.toBase58()}`);

    if (pda.toBase58() === account1) {
      console.log(`   ✅ MATCH! Account 1 (OpenOrdersIndexer) uses index ${i}`);
    }
    if (pda.toBase58() === account2) {
      console.log(`   ✅✅✅ MATCH! Account 2 (OpenOrders) uses index ${i}`);
      console.log("");
      console.log("🎯 SOLUTION FOUND!");
      console.log(`   The OpenOrders account uses accountIndex=${i}`);
      console.log("   PDA derivation: [\"OpenOrders\", owner, ${i}]");
    }
  }

  console.log("");
  console.log("🔍 Checking OpenOrdersIndexer PDA:");
  const [indexerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("OpenOrdersIndexer"), authority.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log("   Indexer PDA:", indexerPDA.toBase58());
  if (indexerPDA.toBase58() === account1) {
    console.log("   ✅ MATCH! Account 1 is the OpenOrdersIndexer!");
  }
  if (indexerPDA.toBase58() === account2) {
    console.log("   ✅ MATCH! Account 2 is the OpenOrdersIndexer!");
  }
}

main().catch(console.error);
