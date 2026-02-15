import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";
import { RPC, authority, programId } from "./utils";

async function main() {
  console.log("🚀 Creating Markets on Custom OpenBook Program\n");
  console.log("Program ID:", programId.toString());
  console.log("RPC:", RPC);
  console.log("Authority:", authority.publicKey.toString());
  console.log("");

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(
    new Connection(RPC, { commitment: "confirmed" }),
    wallet,
    { commitment: "confirmed" }
  );
  const client = new OpenBookV2Client(provider, programId);

  // Token addresses from token creation
  const BTC = new PublicKey("EuMVKEbrUvt1otSEoWLSd43srGHTPaqFE44w2gKxXrsZ");
  const USDT = new PublicKey("A4DF6GSZ3S9aEhLoNqrrRcziGREywXunixd83B9BPSpN");
  const WETH = new PublicKey("J1yrfjVzZdej3R3Jf8S5K731WqPpw6faEcHQoKGjruEC");

  // Create BTC/USDT market
  console.log("📊 Creating BTC/USDT market...");
  const btcUsdtIxs = await client.createMarketIx(
    authority.publicKey,
    "BTC/USDT",
    USDT, // quote
    BTC,  // base
    new BN(100),      // baseLotSize
    new BN(10),       // quoteLotSize
    new BN(1000),     // makerFee
    new BN(1000),     // takerFee
    new BN(0),        // timeExpiry
    null,             // oracleA
    null,             // oracleB
    null,             // openOrdersAdmin
    null,             // consumeEventsAdmin
    null              // closeMarketAdmin
  );

  const btcUsdtTx = await client.sendAndConfirmTransaction(btcUsdtIxs[0], {
    additionalSigners: btcUsdtIxs[1],
  });
  console.log("✅ BTC/USDT created:", btcUsdtTx);
  console.log("");

  // Create WETH/USDT market
  console.log("📊 Creating WETH/USDT market...");
  const wethUsdtIxs = await client.createMarketIx(
    authority.publicKey,
    "WETH/USDT",
    USDT, // quote
    WETH, // base
    new BN(100),      // baseLotSize
    new BN(10),       // quoteLotSize
    new BN(1000),     // makerFee
    new BN(1000),     // takerFee
    new BN(0),        // timeExpiry
    null,             // oracleA
    null,             // oracleB
    null,             // openOrdersAdmin
    null,             // consumeEventsAdmin
    null              // closeMarketAdmin
  );

  const wethUsdtTx = await client.sendAndConfirmTransaction(wethUsdtIxs[0], {
    additionalSigners: wethUsdtIxs[1],
  });
  console.log("✅ WETH/USDT created:", wethUsdtTx);
  console.log("");

  console.log("🎉 Markets created successfully!");
  console.log("Tokens:");
  console.log("  BTC:  ", BTC.toString());
  console.log("  USDT: ", USDT.toString());
  console.log("  WETH: ", WETH.toString());
}

main().catch(console.error);
