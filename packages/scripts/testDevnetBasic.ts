import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey
} from "@solana/web3.js";
import { getKeypairFromFile } from "./utils";
import * as os from "os";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🧪 Testing Basic Devnet Functionality\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const connection = new Connection(RPC, "confirmed");
  console.log("🌐 RPC:", RPC);

  // Load authority
  const authorityFile = `${os.homedir()}/.config/solana/id.json`;
  const authority = getKeypairFromFile(authorityFile);
  console.log("🔑 Authority:", authority.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log("💰 Balance:", (balance / LAMPORTS_PER_SOL).toFixed(4), "SOL\n");

  // Test 1: Create a new account
  console.log("📝 TEST 1: Create New Account");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const newAccount = Keypair.generate();
  console.log("   New account:", newAccount.publicKey.toBase58());

  try {
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: newAccount.publicKey,
      lamports: 0.001 * LAMPORTS_PER_SOL,
      space: 0,
      programId: SystemProgram.programId,
    });

    const tx = new Transaction().add(createAccountIx);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [authority, newAccount],
      { commitment: "confirmed" }
    );

    console.log("   ✅ Account created!");
    console.log("   TX:", signature.slice(0, 20) + "...");

    // Verify account exists immediately
    await sleep(2000);
    const accountInfo = await connection.getAccountInfo(newAccount.publicKey);

    if (accountInfo) {
      console.log("   ✅ Account verified immediately");
      console.log("   Balance:", accountInfo.lamports / LAMPORTS_PER_SOL, "SOL");
    } else {
      console.log("   ⚠️  Account not found immediately");

      // Try again after waiting
      await sleep(10000);
      const accountInfo2 = await connection.getAccountInfo(newAccount.publicKey);
      if (accountInfo2) {
        console.log("   ✅ Account verified after 10s wait");
      } else {
        console.log("   ❌ Account still not found (propagation delay)");
      }
    }
  } catch (error: any) {
    console.log("   ❌ Failed:", error.message?.split('\n')[0]);
  }

  console.log("");
  await sleep(3000);

  // Test 2: Simple transfer
  console.log("📝 TEST 2: Simple SOL Transfer");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const recipient = Keypair.generate();
  console.log("   Recipient:", recipient.publicKey.toBase58());

  try {
    const transferIx = SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 0.001 * LAMPORTS_PER_SOL,
    });

    const tx = new Transaction().add(transferIx);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [authority],
      { commitment: "confirmed" }
    );

    console.log("   ✅ Transfer successful!");
    console.log("   TX:", signature.slice(0, 20) + "...");

    // Verify balance immediately
    await sleep(2000);
    const recipientBalance = await connection.getBalance(recipient.publicKey);

    if (recipientBalance > 0) {
      console.log("   ✅ Balance verified immediately");
      console.log("   Amount:", recipientBalance / LAMPORTS_PER_SOL, "SOL");
    } else {
      console.log("   ⚠️  Balance not updated immediately");

      // Try again after waiting
      await sleep(10000);
      const recipientBalance2 = await connection.getBalance(recipient.publicKey);
      if (recipientBalance2 > 0) {
        console.log("   ✅ Balance verified after 10s wait");
        console.log("   Amount:", recipientBalance2 / LAMPORTS_PER_SOL, "SOL");
      } else {
        console.log("   ❌ Balance still 0 (propagation delay)");
      }
    }
  } catch (error: any) {
    console.log("   ❌ Failed:", error.message?.split('\n')[0]);
  }

  console.log("");
  await sleep(3000);

  // Test 3: Multiple sequential transactions
  console.log("📝 TEST 3: Sequential Transactions (OpenBook-like pattern)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // TX 1: Create account
    const account1 = Keypair.generate();
    console.log("   Step 1: Creating account...");

    const createIx = SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: account1.publicKey,
      lamports: 0.001 * LAMPORTS_PER_SOL,
      space: 0,
      programId: SystemProgram.programId,
    });

    const tx1 = new Transaction().add(createIx);
    const sig1 = await sendAndConfirmTransaction(
      connection,
      tx1,
      [authority, account1],
      { commitment: "confirmed" }
    );
    console.log("   ✅ Account created:", sig1.slice(0, 20) + "...");

    // Wait before next step (simulating OpenBook workflow)
    console.log("   ⏳ Waiting 5 seconds...");
    await sleep(5000);

    // TX 2: Transfer to that account
    console.log("   Step 2: Transferring to account...");

    const transferIx = SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: account1.publicKey,
      lamports: 0.001 * LAMPORTS_PER_SOL,
    });

    const tx2 = new Transaction().add(transferIx);
    const sig2 = await sendAndConfirmTransaction(
      connection,
      tx2,
      [authority],
      { commitment: "confirmed" }
    );
    console.log("   ✅ Transfer successful:", sig2.slice(0, 20) + "...");

    // Verify final state
    const finalBalance = await connection.getBalance(account1.publicKey);
    console.log("   ✅ Final balance:", finalBalance / LAMPORTS_PER_SOL, "SOL");
    console.log("   ✅ Sequential transactions work!");

  } catch (error: any) {
    console.log("   ❌ Failed:", error.message?.split('\n')[0]);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Test Complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
