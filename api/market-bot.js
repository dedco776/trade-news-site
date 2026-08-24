export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });

  try {
    const stocks = await fetch(
      `${supabaseUrl}/rest/v1/user_stocks?select=*`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ).then((r) => r.json());

    if (!Array.isArray(stocks)) return res.status(200).json({ ticked: 0 });

    const now = Date.now();
    let ticked = 0;

    for (const stock of stocks) {
      const lastRun = new Date(stock.last_bot_run || stock.created_at).getTime();
      // Har 2 daqiqada bir marta, va faqat ~60% ehtimol bilan (tabiiyroq ko'rinish uchun)
      if (now - lastRun < 2 * 60 * 1000) continue;
      if (Math.random() > 0.6) {
        await patchStock(stock.id, { last_bot_run: new Date().toISOString() }, supabaseUrl, serviceKey);
        continue;
      }

      let supply = parseFloat(stock.total_supply);
      const basePrice = parseFloat(stock.base_price);
      const side = Math.random() > 0.5 ? "buy" : "sell";
      const qty = 1 + Math.floor(Math.random() * 2); // 1-2 dona
      let price = priceAt(basePrice, supply);

      if (side === "buy") {
        for (let i = 0; i < qty; i++) { price = priceAt(basePrice, supply); supply += 1; }
      } else {
        if (supply < qty) { await patchStock(stock.id, { last_bot_run: new Date().toISOString() }, supabaseUrl, serviceKey); continue; }
        for (let i = 0; i < qty; i++) { supply -= 1; price = priceAt(basePrice, supply); }
      }

      await patchStock(stock.id, { current_price: price, total_supply: supply, last_bot_run: new Date().toISOString() }, supabaseUrl, serviceKey);

      await fetch(`${supabaseUrl}/rest/v1/stock_transactions`, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ stock_id: stock.id, user_id: stock.owner_id, type: side, quantity: qty, price, is_bot: true })
      });

      // Kunlik daromad hisobotini yangilash (soddalashtirilgan)
      const lastEarningsDay = new Date(stock.last_bot_run || stock.created_at).toDateString();
      if (lastEarningsDay !== new Date().toDateString()) {
        const change = (Math.random() - 0.45) * 0.1; // biroz ijobiyroq ehtimolga moyil
        const newEarnings = parseFloat(stock.daily_earnings || 0) * (1 + change) + (Math.random() * 5);
        await patchStock(stock.id, { daily_earnings: Number(newEarnings.toFixed(2)) }, supabaseUrl, serviceKey);
      }

      await fillPendingOrders(stock.id, price, supabaseUrl, serviceKey);
      ticked++;
    }

    return res.status(200).json({ ticked });
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
}

// Yangi narx formulasi: P = P0 * (1 + supply * 0.01)
function priceAt(basePrice, supply) {
  return basePrice * (1 + supply * 0.01);
}

async function patchStock(id, fields, supabaseUrl, serviceKey) {
  await fetch(`${supabaseUrl}/rest/v1/user_stocks?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(fields)
  });
}

// Narx o'zgarganda kutilayotgan limit/stop-loss/take-profit buyurtmalarni tekshiradi va bajaradi
export async function fillPendingOrders(stockId, currentPrice, supabaseUrl, serviceKey) {
  const orders = await fetch(
    `${supabaseUrl}/rest/v1/stock_orders?stock_id=eq.${stockId}&status=eq.pending&select=*`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  ).then((r) => r.json());

  if (!Array.isArray(orders) || orders.length === 0) return;

  for (const order of orders) {
    const target = parseFloat(order.target_price);
    let shouldFill = false;

    if (order.side === "buy" && order.order_type === "limit" && currentPrice <= target) shouldFill = true;
    if (order.side === "sell" && order.order_type === "limit" && currentPrice >= target) shouldFill = true;
    if (order.order_type === "stop_loss" && currentPrice <= target) shouldFill = true;
    if (order.order_type === "take_profit" && currentPrice >= target) shouldFill = true;

    if (shouldFill) {
      await executeOrder(order, supabaseUrl, serviceKey);
    }
  }
}

async function executeOrder(order, supabaseUrl, serviceKey) {
  const [stockRes, profileRes, holdingRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/user_stocks?id=eq.${order.stock_id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json()),
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${order.user_id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json()),
    fetch(`${supabaseUrl}/rest/v1/stock_holdings?user_id=eq.${order.user_id}&stock_id=eq.${order.stock_id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json())
  ]);

  const stock = stockRes?.[0];
  const profile = profileRes?.[0];
  const holding = holdingRes?.[0];
  if (!stock || !profile) return await cancelOrder(order.id, supabaseUrl, serviceKey);

  const qty = parseFloat(order.quantity);
  const basePrice = parseFloat(stock.base_price);
  let supply = parseFloat(stock.total_supply);
  let price = priceAt(basePrice, supply);
  let total = 0;
  const isSell = order.side === "sell" || order.order_type === "stop_loss" || order.order_type === "take_profit";

  if (!isSell) {
    for (let i = 0; i < qty; i++) { total += price; supply += 1; price = priceAt(basePrice, supply); }
    if (total > parseFloat(profile.balance)) return await cancelOrder(order.id, supabaseUrl, serviceKey);
  } else {
    const owned = holding ? parseFloat(holding.quantity) : 0;
    if (qty > owned) return await cancelOrder(order.id, supabaseUrl, serviceKey);
    for (let i = 0; i < qty; i++) { supply -= 1; price = priceAt(basePrice, supply); total += price; }
  }

  const newBalance = isSell ? parseFloat(profile.balance) + total : parseFloat(profile.balance) - total;
  const currentHolding = holding ? parseFloat(holding.quantity) : 0;
  const newHoldingQty = isSell ? currentHolding - qty : currentHolding + qty;

  await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${order.user_id}`, {
      method: "PATCH", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ balance: newBalance })
    }),
    fetch(`${supabaseUrl}/rest/v1/user_stocks?id=eq.${order.stock_id}`, {
      method: "PATCH", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ current_price: price, total_supply: supply })
    }),
    holding
      ? fetch(`${supabaseUrl}/rest/v1/stock_holdings?id=eq.${holding.id}`, {
          method: "PATCH", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ quantity: newHoldingQty })
        })
      : fetch(`${supabaseUrl}/rest/v1/stock_holdings`, {
          method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: order.user_id, stock_id: order.stock_id, quantity: newHoldingQty })
        }),
    fetch(`${supabaseUrl}/rest/v1/stock_orders?id=eq.${order.id}`, {
      method: "PATCH", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "filled" })
    }),
    fetch(`${supabaseUrl}/rest/v1/stock_transactions`, {
      method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ stock_id: order.stock_id, user_id: order.user_id, type: isSell ? "sell" : "buy", quantity: qty, price: total / qty })
    })
  ]);

  // Egasiga 2% royalty (virtual bonus)
  if (stock.owner_id !== order.user_id) {
    const royalty = total * 0.02;
    const ownerProfile = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${stock.owner_id}&select=balance`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json());
    const ownerBalance = ownerProfile?.[0]?.balance !== undefined ? parseFloat(ownerProfile[0].balance) : 100;
    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: stock.owner_id, balance: ownerBalance + royalty })
    });
  }
}

async function cancelOrder(orderId, supabaseUrl, serviceKey) {
  await fetch(`${supabaseUrl}/rest/v1/stock_orders?id=eq.${orderId}`, {
    method: "PATCH",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "cancelled" })
  });
      }
