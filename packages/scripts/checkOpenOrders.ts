import { PublicKey, Connection } from "@solana/web3.js";
import { getKeypairFromFile } from "./utils";
import * as os from "os";

const RPC = "https://devnet.helius-rpc.com/?api-key=e8252302-cdec-44d0-80d2-3efac7c0b50c";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET_ADDRESS = new PublicKey("HLcm5MPz3ezS1UtCGdNwxcPRuCEhXPHyJrsm9uU4SQ6");

async function main() {
  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  const connection = new Connection(RPC, "confirmed");

  const [openOrdersAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("OpenOrders"),
      authority.publicKey.toBuffer(),
      MARKET_ADDRESS.toBuffer(),
    ],
    PROGRAM_ID
  );

  console.log("OpenOrders PDA:", openOrdersAccount.toString());

  const accountInfo = await connection.getAccountInfo(openOrdersAccount);
  if (accountInfo) {
    console.log("✅ Account exists");
    console.log("   Owner:", accountInfo.owner.toString());
    console.log("   Data length:", accountInfo.data.length);
    console.log("   Lamports:", accountInfo.lamports);
  } else {
    console.log("❌ Account does not exist");
  }
}

main();
