/**
 * LOW-LEVEL TOKEN WITH METADATA CREATION
 *
 * This shows EXACTLY which programs are used and what they do.
 * No abstractions - pure Solana instructions!
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import * as fs from "fs";

// ============================================================
// PROGRAM IDs - These are the actual on-chain programs
// ============================================================

// SPL Token Program - Creates mints and token accounts
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

// Metaplex Token Metadata Program - Adds name, symbol, logo
const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// System Program - Creates accounts and transfers SOL
const SYSTEM_PROGRAM_ID = SystemProgram.programId;

// ============================================================
// CONFIGURATION
// ============================================================

const RPC_URL = "http://localhost:8899";

// Token configuration
const TOKEN_CONFIG = {
  name: "Bitcoin",
  symbol: "BTC",
  uri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png",
  decimals: 8,
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Derives the metadata PDA (Program Derived Address)
 * This is like CREATE2 in EVM - deterministic address calculation
 */
function findMetadataPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),           // Seed 1: String "metadata"
      METADATA_PROGRAM_ID.toBuffer(),    // Seed 2: Metadata program ID
      mint.toBuffer(),                   // Seed 3: Token mint address
    ],
    METADATA_PROGRAM_ID                  // Program that "owns" this PDA
  );
}

// ============================================================
// STEP 1: CREATE MINT ACCOUNT (SPL Token Program)
// ============================================================

/**
 * Creates a token mint account using SPL Token Program
 *
 * Programs used:
 * - System Program: Allocates space and pays rent
 * - SPL Token Program: Initializes the mint
 */
async function createMintAccount(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  decimals: number
): Promise<Keypair> {
  console.log("\n📦 STEP 1: Creating Mint Account");
  console.log("Program: SPL Token Program");
  console.log("Address:", SPL_TOKEN_PROGRAM_ID.toString());

  // Generate new keypair for the mint
  const mintKeypair = Keypair.generate();
  console.log("\nMint address:", mintKeypair.publicKey.toString());

  // Calculate rent (storage cost on Solana)
  const mintRent = await connection.getMinimumBalanceForRentExemption(82); // 82 bytes for mint account
  console.log("Rent required:", mintRent / 1e9, "SOL");

  // Build transaction with 2 instructions
  const transaction = new Transaction();

  // Instruction 1: Create account (System Program)
  console.log("\nInstruction 1: System Program - Create Account");
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,        // Who pays for the account
      newAccountPubkey: mintKeypair.publicKey,  // New mint address
      space: 82,                          // Space needed for mint data
      lamports: mintRent,                 // Rent payment
      programId: SPL_TOKEN_PROGRAM_ID,    // Owner: SPL Token Program
    })
  );

  // Instruction 2: Initialize mint (SPL Token Program)
  console.log("Instruction 2: SPL Token Program - Initialize Mint");

  // Build initialize mint instruction manually
  const initMintData = new Uint8Array(67);
  initMintData[0] = 0;  // Instruction discriminator: 0 = InitializeMint
  initMintData[1] = decimals;  // Decimals
  initMintData.set(mintAuthority.toBytes(), 2);  // Mint authority (32 bytes)
  initMintData[34] = 1;  // COption: Some
  initMintData.set(mintAuthority.toBytes(), 35);  // Freeze authority (32 bytes)

  transaction.add({
    keys: [
      { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },  // Mint account
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },    // Rent sysvar
    ],
    programId: SPL_TOKEN_PROGRAM_ID,
    data: Buffer.from(initMintData),
  });

  // Send transaction
  console.log("\nSending transaction...");
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mintKeypair],
    { commitment: "confirmed" }
  );

  console.log("✅ Mint created!");
  console.log("Transaction:", signature);

  return mintKeypair;
}

// ============================================================
// STEP 2: CREATE METADATA ACCOUNT (Metaplex Program)
// ============================================================

/**
 * Creates a metadata account using Metaplex Token Metadata Program
 * This adds name, symbol, and logo to the token
 *
 * Programs used:
 * - Metaplex Token Metadata Program: Creates and stores metadata
 */
async function createMetadataAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  name: string,
  symbol: string,
  uri: string
): Promise<PublicKey> {
  console.log("\n📝 STEP 2: Creating Metadata Account");
  console.log("Program: Metaplex Token Metadata Program");
  console.log("Address:", METADATA_PROGRAM_ID.toString());

  // Derive metadata PDA (like CREATE2 in EVM)
  const [metadataPDA, bump] = findMetadataPDA(mint);
  console.log("\nMetadata PDA:", metadataPDA.toString());
  console.log("PDA Bump:", bump);

  // Build CreateMetadataAccountV3 instruction
  console.log("\nBuilding instruction data:");
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  URI:", uri);

  console.log("\nInstruction: Metaplex - CreateMetadataAccountV3");
  console.log("This instruction calls the Metaplex Token Metadata Program");
  console.log("and passes the name, symbol, and URI to be stored on-chain.");

  // Use Metaplex SDK to build the instruction (but you can see what it does)
  const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
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

  console.log("\nAccounts used in this instruction:");
  console.log("  1. Metadata PDA:     ", metadataPDA.toString(), "(writable)");
  console.log("  2. Mint:             ", mint.toString());
  console.log("  3. Mint Authority:   ", payer.publicKey.toString());
  console.log("  4. Payer:            ", payer.publicKey.toString());
  console.log("  5. Update Authority: ", payer.publicKey.toString());
  console.log("  6. System Program:   ", SYSTEM_PROGRAM_ID.toString());
  console.log("  7. Rent Sysvar:      ", SYSVAR_RENT_PUBKEY.toString());

  // Build transaction
  const transaction = new Transaction();
  transaction.add(createMetadataInstruction);

  // Send transaction
  console.log("\nSending transaction...");
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    { commitment: "confirmed" }
  );

  console.log("✅ Metadata created!");
  console.log("Transaction:", signature);

  return metadataPDA;
}

// ============================================================
// MAIN FUNCTION
// ============================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  LOW-LEVEL TOKEN CREATION WITH METADATA                ║");
  console.log("║  Understanding which programs are actually used        ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  // Setup
  const connection = new Connection(RPC_URL, "confirmed");
  const keypairPath = `${process.env.HOME}/.config/solana/id.json`;
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  console.log("\n💰 Payer:", payer.publicKey.toString());

  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  // ============================================================
  // PROGRAM SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("PROGRAMS USED IN THIS SCRIPT:");
  console.log("=".repeat(60));

  console.log("\n1️⃣  SYSTEM PROGRAM");
  console.log("   Address:", SYSTEM_PROGRAM_ID.toString());
  console.log("   Purpose: Creates accounts and transfers SOL");
  console.log("   Like EVM: Built-in, similar to CREATE opcode");

  console.log("\n2️⃣  SPL TOKEN PROGRAM");
  console.log("   Address:", SPL_TOKEN_PROGRAM_ID.toString());
  console.log("   Purpose: Manages token mints and accounts");
  console.log("   Like EVM: ERC20 factory/standard (shared by all tokens)");

  console.log("\n3️⃣  METAPLEX TOKEN METADATA PROGRAM");
  console.log("   Address:", METADATA_PROGRAM_ID.toString());
  console.log("   Purpose: Adds name, symbol, and logo to tokens");
  console.log("   Like EVM: Token metadata extension (like ERC721 metadata)");

  console.log("\n" + "=".repeat(60) + "\n");

  // ============================================================
  // CREATE TOKEN
  // ============================================================

  // Step 1: Create mint account
  const mintKeypair = await createMintAccount(
    connection,
    payer,
    payer.publicKey,
    TOKEN_CONFIG.decimals
  );

  // Step 2: Create metadata account
  const metadataPDA = await createMetadataAccount(
    connection,
    payer,
    mintKeypair.publicKey,
    TOKEN_CONFIG.name,
    TOKEN_CONFIG.symbol,
    TOKEN_CONFIG.uri
  );

  // ============================================================
  // SUMMARY
  // ============================================================

  console.log("\n" + "=".repeat(60));
  console.log("✨ TOKEN CREATED WITH METADATA");
  console.log("=".repeat(60));

  console.log("\n📍 ACCOUNTS CREATED:");
  console.log("   Mint Account:     ", mintKeypair.publicKey.toString());
  console.log("   Metadata Account: ", metadataPDA.toString());

  console.log("\n📊 TOKEN INFO:");
  console.log("   Name:    ", TOKEN_CONFIG.name);
  console.log("   Symbol:  ", TOKEN_CONFIG.symbol);
  console.log("   Decimals:", TOKEN_CONFIG.decimals);
  console.log("   Logo:    ", TOKEN_CONFIG.uri);

  console.log("\n🔗 PROGRAMS USED:");
  console.log("   System Program:   ", SYSTEM_PROGRAM_ID.toString());
  console.log("   SPL Token:        ", SPL_TOKEN_PROGRAM_ID.toString());
  console.log("   Metaplex Metadata:", METADATA_PROGRAM_ID.toString());

  console.log("\n" + "=".repeat(60));

  console.log("\n💡 HOW TO VERIFY:");
  console.log(`   solana account ${mintKeypair.publicKey.toString()}`);
  console.log(`   solana account ${metadataPDA.toString()}`);

  console.log("\n" + "=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
