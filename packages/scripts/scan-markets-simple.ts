import { Connection, PublicKey } from "@solana/web3.js";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");
const MARKET_DISCRIMINATOR = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154]);

async function main() {
  console.log("🔍 Scanning for markets...");
  const conn = new Connection(RPC);
  
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: MARKET_DISCRIMINATOR.toString('base64') } }],
  });
  
  console.log(`✅ Found ${accounts.length} markets:`);
  accounts.forEach((acc, i) => {
    console.log(`${i+1}. ${acc.pubkey.toBase58()}`);
    // Get base/quote mints (usually at specific offsets in market account)
    const data = acc.account.data;
    if (data.length > 100) {
      const baseMint = new PublicKey(data.slice(8, 40)).toBase58();
      const quoteMint = new PublicKey(data.slice(40, 72)).toBase58();
      console.log(`   Base:  ${baseMint}`);
      console.log(`   Quote: ${quoteMint}`);
    }
  });
}

main().catch(console.error);
