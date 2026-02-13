import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";
import * as os from "os";
import * as fs from "fs";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

function getKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf-8"))));
}

async function main() {
  const authority = getKeypair(`${os.homedir()}/.config/solana/id.json`);
  const connection = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
  const client = new OpenBookV2Client(provider);

  console.log("🔍 Checking OpenOrdersIndexer Account\n");

  const indexerPDA = client.findOpenOrdersIndexer(authority.publicKey);
  console.log("Indexer PDA:", indexerPDA.toBase58());
  console.log("");

  try {
    const indexer = await client.deserializeOpenOrdersIndexerAccount(indexerPDA);

    if (indexer) {
      console.log("✅ Indexer exists!");
      console.log("   Created Counter:", indexer.createdCounter);
      console.log("   Addresses in indexer:", indexer.addresses.length);
      console.log("");

      // Try to find OpenOrders accounts
      console.log("🔍 Looking for OpenOrders accounts:");
      const maxIndex = typeof indexer.createdCounter === 'number' ? indexer.createdCounter : 10;
      for (let i = 0; i <= maxIndex; i++) {
        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32LE(i);

        const [pda] = PublicKey.findProgramAddressSync(
          [Buffer.from("OpenOrders"), authority.publicKey.toBuffer(), indexBuffer],
          PROGRAM_ID
        );

        console.log(`   Index ${i}: ${pda.toBase58()}`);

        if (pda.toBase58() === "H7mVCELc8UqhJbWzsdaS8YReYT7yXABkzejwohwBKU5V") {
          console.log(`   ✅✅✅ MATCH FOUND! This is the OpenOrders account at index ${i}`);
        }

        // Try to deserialize to see if it exists
        try {
          const ooAccount = await client.deserializeOpenOrderAccount(pda);
          if (ooAccount) {
            console.log(`      ✅ Exists! Market: ${ooAccount.market.toBase58()}`);
          }
        } catch {
          // Account doesn't exist
        }
      }
    } else {
      console.log("❌ Indexer doesn't exist yet!");
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

main().catch(console.error);
