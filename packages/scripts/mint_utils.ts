import * as splToken from "@solana/spl-token";
import {
  PublicKey,
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";

export interface TokenData {
  mint: PublicKey;
  startingPrice: number;
  nbDecimals: number;
  priceOracle: Keypair | undefined;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
}

export class MintUtils {
  private conn: Connection;
  private authority: Keypair;

  constructor(conn: Connection, authority: Keypair) {
    this.conn = conn;
    this.authority = authority;
  }

  async createMint(nb_decimals = 6): Promise<PublicKey> {
    const kp = Keypair.generate();
    return await splToken.createMint(
      this.conn,
      this.authority,
      this.authority.publicKey,
      this.authority.publicKey,
      nb_decimals,
      kp
    );
  }

  /**
   * Creates a token mint WITH metadata (name, symbol, logo)
   * This makes tokens display properly in wallets and explorers
   */
  async createMintWithMetadata(
    metadata: TokenMetadata,
    nb_decimals = 6
  ): Promise<PublicKey> {
    // 1. Create the SPL token mint
    const mintKeypair = Keypair.generate();
    const mint = await splToken.createMint(
      this.conn,
      this.authority,
      this.authority.publicKey,
      this.authority.publicKey,
      nb_decimals,
      mintKeypair
    );

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
        mintAuthority: this.authority.publicKey,
        payer: this.authority.publicKey,
        updateAuthority: this.authority.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
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

    // 4. Send transaction to create metadata
    const transaction = new Transaction().add(createMetadataInstruction);
    await sendAndConfirmTransaction(this.conn, transaction, [this.authority], {
      commitment: "confirmed",
    });

    return mint;
  }

  public async createMints(nbMints: number): Promise<PublicKey[]> {
    return await Promise.all(
      Array.from(Array(nbMints).keys()).map((_) => {
        return this.createMint();
      })
    );
  }

  public async createNewToken(nbDecimals = 6, startingPrice = 1_000_000) {
    const mint = await this.createMint(nbDecimals);
    const tokenData: TokenData = {
      mint: mint,
      startingPrice: startingPrice,
      nbDecimals: nbDecimals,
      priceOracle: undefined,
    };
    return tokenData;
  }

  public async createTokenAccount(
    mint: PublicKey,
    payer: Keypair,
    owner: PublicKey
  ) {
    const account = Keypair.generate();
    return splToken.createAccount(this.conn, payer, mint, owner, account);
  }

  public async getOrCreateTokenAccount(
    mint: PublicKey,
    payer: Keypair,
    owner: PublicKey
  ) {
    return await splToken.getOrCreateAssociatedTokenAccount(
      this.conn,
      payer,
      mint,
      owner,
      false
    );
  }

  public async mintTo(mint: PublicKey, tokenAccount: PublicKey) {
    await splToken.mintTo(
      this.conn,
      this.authority,
      mint,
      tokenAccount,
      this.authority,
      1000000000000
    );
  }
}
