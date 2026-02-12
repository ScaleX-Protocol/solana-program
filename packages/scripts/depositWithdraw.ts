/**
 * OpenBook V2 - Deposit/Withdraw (Settle) Example
 *
 * This demonstrates position-based trading:
 * 1. Deposit tokens into market vaults
 * 2. Trade with lower CU costs
 * 3. Settle (withdraw) funds back to wallet
 */

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "fs";

const LOCAL_RPC = "http://127.0.0.1:8899";
const OPENBOOK_PROGRAM = new PublicKey("opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb");

// Your market addresses (replace with actual from deployment)
const MARKET_ADDRESS = new PublicKey("YOUR_MARKET_ADDRESS_HERE");

async function main() {
  console.log("💰 OpenBook V2 - Deposit/Withdraw Example\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Setup
  process.env.ANCHOR_WALLET = `${process.env.HOME}/.config/solana/id.json`;
  const connection = new Connection(LOCAL_RPC, "confirmed");
  const keypairData = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const client = new OpenBookV2Client(provider, OPENBOOK_PROGRAM);

  // Fetch market info
  const market = await client.deserializeMarketAccount(MARKET_ADDRESS);
  if (!market) {
    console.log("❌ Market not found");
    return;
  }

  console.log(`📊 Market: ${MARKET_ADDRESS.toString()}`);
  console.log(`   Base Mint:  ${market.baseMint.toString()}`);
  console.log(`   Quote Mint: ${market.quoteMint.toString()}\n`);

  // Get user token accounts
  const userBaseAccount = await getAssociatedTokenAddress(
    market.baseMint,
    authority.publicKey
  );
  const userQuoteAccount = await getAssociatedTokenAddress(
    market.quoteMint,
    authority.publicKey
  );

  // Get or create open orders account (position account)
  let openOrdersAccount: PublicKey;
  const openOrdersAccounts = await client.findOpenOrdersForMarket(
    authority.publicKey,
    MARKET_ADDRESS
  );

  if (openOrdersAccounts.length === 0) {
    console.log("📝 Creating Open Orders account (Position account)...");

    // Note: You'll need to call createOpenOrdersAccount first
    // This is simplified - in reality you'd call client.program.methods.createOpenOrdersAccount()
    console.log("   ⚠️  You need to create an Open Orders account first");
    console.log("   Use the place order flow which auto-creates it\n");
    return;
  } else {
    openOrdersAccount = openOrdersAccounts[0];
    console.log(`✅ Using existing Open Orders: ${openOrdersAccount.toString()}\n`);
  }

  // Check current balances
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Current Balances:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const baseBalance = await connection.getTokenAccountBalance(userBaseAccount);
  const quoteBalance = await connection.getTokenAccountBalance(userQuoteAccount);

  console.log(`Wallet:`);
  console.log(`  Base:  ${baseBalance.value.uiAmount} tokens`);
  console.log(`  Quote: ${quoteBalance.value.uiAmount} tokens\n`);

  // Fetch position info
  const openOrdersData = await client.deserializeOpenOrderAccount(openOrdersAccount);
  if (openOrdersData) {
    console.log(`Position (deposited in market):`);
    console.log(`  Base:  ${openOrdersData.position.baseFreeLots} lots (free)`);
    console.log(`  Quote: ${openOrdersData.position.quoteFreeLots} lots (free)`);
    console.log(`  Locked Base:  ${openOrdersData.position.baseLots} lots`);
    console.log(`  Locked Quote: ${openOrdersData.position.quoteLots} lots\n`);
  }

  // Example 1: DEPOSIT
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💳 DEPOSIT (move tokens to position)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const depositBaseAmount = 1_000_000; // 1 token (6 decimals)
  const depositQuoteAmount = 10_000_000; // 10 tokens

  console.log(`Depositing:`);
  console.log(`  Base:  ${depositBaseAmount / 1_000_000} tokens`);
  console.log(`  Quote: ${depositQuoteAmount / 1_000_000} tokens\n`);

  try {
    const depositTx = await client.program.methods
      .deposit(
        depositBaseAmount,
        depositQuoteAmount
      )
      .accounts({
        owner: authority.publicKey,
        userBaseAccount,
        userQuoteAccount,
        openOrdersAccount,
        market: MARKET_ADDRESS,
        marketBaseVault: market.marketBaseVault,
        marketQuoteVault: market.marketQuoteVault,
      })
      .rpc();

    console.log(`✅ Deposit successful!`);
    console.log(`   Signature: ${depositTx}\n`);

    // Wait for confirmation
    await connection.confirmTransaction(depositTx, "confirmed");
  } catch (err: any) {
    console.log(`❌ Deposit failed: ${err.message}\n`);
  }

  // Example 2: SETTLE FUNDS (Withdraw)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🏦 SETTLE FUNDS (withdraw to wallet)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Withdrawing available balance from position...\n");

  try {
    const settleTx = await client.program.methods
      .settleFunds()
      .accounts({
        owner: authority.publicKey,
        penaltyPayer: authority.publicKey,
        openOrdersAccount,
        market: MARKET_ADDRESS,
        marketAuthority: market.marketAuthority,
        marketBaseVault: market.marketBaseVault,
        marketQuoteVault: market.marketQuoteVault,
        userBaseAccount,
        userQuoteAccount,
        referrerAccount: null, // Optional referrer
      })
      .rpc();

    console.log(`✅ Settle successful!`);
    console.log(`   Signature: ${settleTx}\n`);

    await connection.confirmTransaction(settleTx, "confirmed");

    // Check new balances
    const newBaseBalance = await connection.getTokenAccountBalance(userBaseAccount);
    const newQuoteBalance = await connection.getTokenAccountBalance(userQuoteAccount);

    console.log(`New wallet balances:`);
    console.log(`  Base:  ${newBaseBalance.value.uiAmount} tokens`);
    console.log(`  Quote: ${newQuoteBalance.value.uiAmount} tokens\n`);
  } catch (err: any) {
    console.log(`❌ Settle failed: ${err.message}\n`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💡 When to use Deposit/Settle:\n");
  console.log("✅ Market makers placing many orders");
  console.log("✅ High-frequency traders (lower CU costs)");
  console.log("✅ When you want to keep funds in market for speed\n");
  console.log("❌ Casual traders (just use direct trading)");
  console.log("❌ One-off trades\n");
}

main().catch(console.error);
