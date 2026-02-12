import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import * as fs from "fs";

const LOCAL_RPC = "http://127.0.0.1:8899";

/**
 * Creates an SPL token WITH metadata (name, symbol, uri)
 * This is the proper way to create tokens with symbols visible in wallets and explorers
 */
async function createTokenWithMetadata(
  connection: Connection,
  payer: Keypair,
  name: string,
  symbol: string,
  uri: string, // URL to off-chain metadata JSON
  decimals: number
) {
  console.log(`\n📦 Creating ${symbol} token with metadata...`);

  // 1. Create the SPL token mint
  const mintKeypair = Keypair.generate();
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    decimals,
    mintKeypair
  );

  console.log(`✅ Mint created: ${mint.toString()}`);

  // 2. Derive the metadata account address (PDA)
  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  // 3. Create metadata account instruction
  const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataAddress,
      mint: mint,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: name,
          symbol: symbol,
          uri: uri,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  // 4. Send transaction
  const transaction = new Transaction().add(createMetadataInstruction);
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    { commitment: "confirmed" }
  );

  console.log(`✅ Metadata created!`);
  console.log(`   TX: ${signature}`);
  console.log(`   Metadata Account: ${metadataAddress.toString()}`);

  return {
    mint,
    metadataAddress,
    signature,
  };
}

async function main() {
  console.log("🚀 Creating Tokens with Metadata\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const connection = new Connection(LOCAL_RPC, "confirmed");
  const keypairPath = `${process.env.HOME}/.config/solana/id.json`;
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log("🔑 Authority:", payer.publicKey.toString());

  // Create BTC token with metadata
  const btc = await createTokenWithMetadata(
    connection,
    payer,
    "Bitcoin",           // name
    "BTC",               // symbol
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png", // uri (Bitcoin logo)
    8                    // decimals
  );

  await delay(1000);

  // Create USDT token with metadata
  const usdt = await createTokenWithMetadata(
    connection,
    payer,
    "Tether USD",        // name
    "USDT",              // symbol
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg", // uri (USDT logo)
    6                    // decimals
  );

  await delay(1000);

  // Create WETH token with metadata
  const weth = await createTokenWithMetadata(
    connection,
    payer,
    "Wrapped Ethereum",  // name
    "WETH",              // symbol
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png", // uri (WETH logo)
    9                    // decimals
  );

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Tokens Created with Metadata!\n");
  console.log("Token Addresses:");
  console.log(`  BTC:  ${btc.mint.toString()}`);
  console.log(`  USDT: ${usdt.mint.toString()}`);
  console.log(`  WETH: ${weth.mint.toString()}`);
  console.log("\nMetadata Accounts:");
  console.log(`  BTC:  ${btc.metadataAddress.toString()}`);
  console.log(`  USDT: ${usdt.metadataAddress.toString()}`);
  console.log(`  WETH: ${weth.metadataAddress.toString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("💡 Now these tokens will show proper names and symbols in:");
  console.log("   - Phantom wallet");
  console.log("   - Solana Explorer");
  console.log("   - Any dApp that reads token metadata\n");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
