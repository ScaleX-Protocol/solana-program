# OpenBook V2 - Viewing Orders & Market Depth Guide

Complete guide to viewing your order book, market depth, and trading activity.

---

## 📊 Quick View Commands

### 1. View Market Overview
```bash
cd /Users/renaka/gtx/openbook/scripts-v2
export ANCHOR_WALLET=~/.config/solana/id.json
npm run order-book
```

**Shows:**
- Market addresses
- Order book account addresses (Bids/Asks)
- Account sizes (confirms orders exist)
- Event heap information

### 2. View All Markets
```bash
npm run view-markets
```

**Shows:**
- All deployed markets
- Token mint addresses
- Market creation timestamps

### 3. Watch Live Transactions
```bash
solana logs
```

**Shows:**
- Real-time transaction logs
- Order placements
- Trade executions
- Program logs

---

## 📈 Current Market State

### BTC/USDT Market
- **Market Address:** `9iBYgJBWtgjwjeQHvPB4xZNqtzdNPC97tV2vjnVFQwW9`
- **Bids (Buy Orders):** `2wmS7NkLnJ6YqcVHaoSvYoSGasNgvXeKZVAZhPciV4FP`
- **Asks (Sell Orders):** `F5Jjcptbun8ZxDvZXd35vSDPozBDS9rUaJCThVYQf1LB`
- **Event Heap:** `GDV4v2xUDY1M1u6EMZ1qXaa3kg4WwAPRkvz9VABR5Q9E`

**Active Orders (from last trading demo):**
- 5 BUY orders (bids) at price lots: 995, 996, 997, 998, 999
- 5 SELL orders (asks) at price lots: 1001, 1002, 1003, 1004, 1005
- **Spread:** 2 lots (1000-999)

### WETH/USDT Market
- **Market Address:** `CR6sRovnYSxUWfeMUmGBr5FWi6nStLJ9VRNbe7mDpYct`
- **Bids:** `Dya4qAviCf6HPrTcxCmmzQn2RfhFwkbTd6eU8XRsoG4A`
- **Asks:** `CcvJuvB5KU4wAWxkziD9UiV7aFyQ1bDJmtR6sH7xmrVn`
- **Event Heap:** `2UUQV5nLjsstjbyC1hqEuy9AZUEtNghQjGf25Z92MaGG`

**Active Orders:**
- Currently empty (place orders with `npm run simple-trade`)

---

## 🔍 Advanced: Inspecting Order Book Data

### Method 1: Using Solana CLI

**View Bids Account:**
```bash
solana account 2wmS7NkLnJ6YqcVHaoSvYoSGasNgvXeKZVAZhPciV4FP
```

**View Asks Account:**
```bash
solana account F5Jjcptbun8ZxDvZXd35vSDPozBDS9rUaJCThVYQf1LB
```

**View Market Account:**
```bash
solana account 9iBYgJBWtgjwjeQHvPB4xZNqtzdNPC97tV2vjnVFQwW9
```

### Method 2: Using OpenBook V2 SDK

The order book data is stored in a binary tree format. To parse it properly, you need to use the OpenBook V2 SDK's methods:

```typescript
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";

// Get market
const market = await client.deserializeMarketAccount(marketPk);

// Load order book (L2 - aggregated depth)
const l2 = await client.getL2(marketPk, market);

// Load order book (L3 - individual orders)
const l3 = await client.getL3(marketPk, market);
```

### Method 3: Watch Transaction Logs

Start the log watcher:
```bash
solana logs
```

Then place orders in another terminal:
```bash
npm run simple-trade
```

You'll see real-time output like:
```
Program log: Instruction: PlaceOrder
Program log: Price: 999 lots
Program log: Size: 10 lots
Program log: Side: Bid
```

---

## 📋 Understanding Order Book Structure

### Order Book Components

1. **Market Account**
   - Contains market configuration
   - Points to bids/asks/event heap
   - Stores maker/taker fees

2. **Bids (Buy Orders)**
   - Binary tree of buy orders
   - Sorted by price (highest first)
   - Each order has: price, size, owner

3. **Asks (Sell Orders)**
   - Binary tree of sell orders
   - Sorted by price (lowest first)
   - Each order has: price, size, owner

4. **Event Heap**
   - Stores trade events
   - Used for settlement
   - Maintains order of fills

### Price Lots Explained

Orders use "lots" instead of raw prices:

```
Price Lots = Price / Quote Lot Size
Size Lots = Size / Base Lot Size
```

For our demo orders:
- Price lot 999 = actual price determined by lot size
- Price lot 1001 = slightly higher price

The spread between best bid (999) and best ask (1001) is 2 lots.

---

## 🛠️ Building a Custom Order Book Viewer

### Create Your Own Viewer

Here's a template for a custom order book viewer:

```typescript
import { OpenBookV2Client } from "@openbook-dex/openbook-v2";

async function viewOrderBook(marketPk: PublicKey) {
  const client = new OpenBookV2Client(provider, PROGRAM_ID);
  const market = await client.deserializeMarketAccount(marketPk);

  // Get L2 orderbook (price levels)
  const l2 = await client.getL2(marketPk, market);

  console.log("ASKS (Sell Orders):");
  l2.asks.forEach(([price, size]) => {
    console.log(`  ${price} @ ${size}`);
  });

  console.log("\nBIDS (Buy Orders):");
  l2.bids.forEach(([price, size]) => {
    console.log(`  ${price} @ ${size}`);
  });
}
```

---

## 📊 Visualizing Your Order Book

### Option 1: Console Output

Use the provided scripts:
```bash
npm run order-book     # Market overview
npm run view-markets   # All markets
solana logs           # Live logs
```

### Option 2: Build a Web UI

Create a simple web interface:

```typescript
// React example
function OrderBookView() {
  const [bids, setBids] = useState([]);
  const [asks, setAsks] = useState([]);

  useEffect(() => {
    async function loadOrderBook() {
      const client = new OpenBookV2Client(provider, PROGRAM_ID);
      const market = await client.deserializeMarketAccount(MARKET_PK);
      const l2 = await client.getL2(MARKET_PK, market);

      setBids(l2.bids);
      setAsks(l2.asks);
    }

    loadOrderBook();
    const interval = setInterval(loadOrderBook, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>BTC/USDT Order Book</h2>
      <OrderBookTable bids={bids} asks={asks} />
    </div>
  );
}
```

### Option 3: Use Solana Explorer

For deployed programs on mainnet/devnet, you can use:
- Solana Explorer: https://explorer.solana.com/
- Solscan: https://solscan.io/
- SolanaFM: https://solana.fm/

(Note: Local validator data isn't visible on public explorers)

---

## 🔬 Debugging & Verification

### Verify Orders Were Placed

```bash
# Check transaction signatures from the trading demo output
solana confirm <SIGNATURE>

# Example:
solana confirm 2CKrgy3UZ7UP2inS...
```

### Check Account Balances

```bash
# Get your token accounts
spl-token accounts

# Check specific token balance
spl-token balance <MINT_ADDRESS>
```

### Inspect Program Logs

```bash
# Get logs for a specific transaction
solana confirm -v <SIGNATURE>
```

---

## 📝 Summary: Your Order Book

Based on the trading demo we just ran:

### BTC/USDT Order Book

```
ASKS (Sell Orders) - Want to sell BTC for USDT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1005 lots | 10,000 size
1004 lots | 10,000 size
1003 lots | 10,000 size
1002 lots | 10,000 size
1001 lots | 10,000 size
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MID: 1000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
999 lots | 10 size
998 lots | 10 size
997 lots | 10 size
996 lots | 10 size
995 lots | 10 size
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BIDS (Buy Orders) - Want to buy BTC with USDT
```

**Spread:** 2 lots (1001 - 999)
**Total Orders:** 10
**Open Orders Account:** `4oXKVM4BUJwyugbYXUQvM8FyrJKFPiwtypfUq6QE8V91`

---

## 🚀 Next Steps

1. **Place More Orders**
   ```bash
   npm run simple-trade
   ```

2. **Match Orders** (Execute Trades)
   - Place a market buy at 1001+ to match with asks
   - Place a market sell at 999- to match with bids

3. **Build Custom Tools**
   - Create a price monitoring script
   - Build an order book visualizer
   - Set up trade alerts

4. **Integrate with Your App**
   - Connect your frontend to the local validator
   - Display real-time order book updates
   - Enable user trading through your UI

---

## 📚 Resources

- **OpenBook V2 SDK:** https://github.com/openbook-dex/openbook-v2
- **Solana Docs:** https://docs.solana.com/
- **Your Deployment Summary:** `/Users/renaka/gtx/openbook/DEPLOYMENT_SUMMARY.md`

---

**Your local OpenBook DEX is fully operational with active orders!** 🎉
