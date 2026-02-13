import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { findAllMarkets } from "@openbook-dex/openbook-v2";
import { getKeypairFromFile } from "./utils";
import * as os from "os";

const RPC = "https://devnet.helius-rpc.com/?api-key=e8252302-cdec-44d0-80d2-3efac7c0b50c";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

async function main() {
  console.log("🔍 Searching for existing OpenBook V2 markets on devnet...\n");
  
  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const wallet = new Wallet(authority);
  const connection = new Connection(RPC, { commitment: "confirmed" });
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  try {
    const markets = await findAllMarkets(connection, PROGRAM_ID, provider);
    
    if (markets.length === 0) {
      console.log("❌ No markets found on devnet\n");
      console.log("You'll need to deploy new markets first.");
    } else {
      console.log(`✅ Found ${markets.length} market(s) on devnet:\n`);
      markets.forEach((market: any, i: number) => {
        console.log(`${i + 1}. ${market.name}`);
        console.log(`   Market: ${market.market}`);
        console.log(`   Base:   ${market.baseMint}`);
        console.log(`   Quote:  ${market.quoteMint}\n`);
      });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main();
