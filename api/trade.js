import { fillPendingOrders } from "./market-bot.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Avval tizimga kiring" });

  const user = await getUserFromToken(token, supabaseUrl, serviceKey);
  if (!user) return res.status(401).json({ error: "Sessiya yaroqsiz, qayta kiring" });

  if (!isMarketOpen()) {
    return res.status(400).json({ error: "Bozor hozir yopiq. Savdo vaqti: Dushanba-Juma, 09:00-18:00 (Toshkent vaqti)" });
  }

  const { stock_id, type, quantity, order_type, target_price } = req.body || {};
  const qty = parseInt(quantity, 10);
  const orderType = order_type || "market";

  if (!stock_id || !["buy", "sell"].includes(type) || !qty || qty < 1 || qty > 50) {
    return res.status(400).json({ error: "Noto'g'ri so'rov" });
  }
  if (!["market", "limit", "stop_loss", "take_profit"].includes(orderType)) {
    return res.status(400).json({ error: "Noto'g'ri buyurtma turi" });
  }

  await ensureProfile(user.id, supabaseUrl, serviceKey);

  // ===== Market bo'lmagan buyurtmalar (Limit / Stop-Loss / Take-Profit) — navbatga qo'yiladi =====
  if (orderType !== "market") {
    const tp = parseFloat(target_price);
    if (!tp || tp <= 0) return res.status(400).json({ error: "Maqsad narx (target price) kerak" });

    if ((orderType === "stop_loss" || orderType === "take_profit")) {
      const holdingCheck = await fetch(
        `${supabaseUrl}/rest/v1/stock_holdings?user_id=eq.${user.id}&stock_id=eq.${stock_id}&select=quantity`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ).then((r) => r.json());
      const owned = holdingCheck?.[0]?.quantity ? parseFloat(holdingCheck[0].quantity) : 0;
      if (owned < qty) return res.status(400).json({ error: "Sizda yetarli ulush yo'q (SL/TP faqat egalik qilingan ulush uchun)" });
    }

    const side = orderType === "limit" ? type : "sell";

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/stock_orders`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ stock_id, user_id: user.id, side, order_type: orderType, target_price: tp, quantity: qty, status: "pending" })
    });

    if (!insertRes.ok) return res.status(400).json({ error: "Buyurtma yaratilmadi" });
    const created = await insertRes.json();
    return res.status(200).json({ success: true, order: created[0], pending: true });
  }

  // ===== Market buyurtma — darhol bajariladi =====
  const [stockRes, profileRes, holdingRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/user_stocks?id=eq.${stock_id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json()),
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json()),
    fetch(`${supabaseUrl}/rest/v1/stock_holdings?user_id=eq.${user.id}&stock_id=eq.${stock_id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json())
  ]);

  const stock = stockRes?.[0];
  const profile = profileRes?.[0];
  const holding = holdingRes?.[0];

  if (!stock) return res.status(404).json({ error: "Aksiya topilmadi" });
  if (!profile) return res.status(400).json({ error: "Profil topilmadi" });

  const basePrice = parseFloat(stock.base_price);
  let supply = parseFloat(stock.total_supply);
  let price = priceAt(basePrice, supply);
  let total = 0;

  if (type === "buy") {
    for (let i = 0; i < qty; i++) { total += price; supply += 1; price = priceAt(basePrice, supply); }
    if (total > parseFloat(profile.balance)) return res.status(400).json({ error: "Balansingiz yetarli emas" });
  } else {
    const ownedQty = holding ? parseFloat(holding.quantity) : 0;
    if (qty > ownedQty) return res.status(400).json({ error: "Sizda yetarli ulush yo'q" });
    for (let i = 0; i < qty; i++) { supply -= 1; price = priceAt(basePrice, supply); total += price; }
  }

  const newBalance = type === "buy" ? parseFloat(profile.balance) - total : parseFloat(profile.balance) + total;
  const currentHolding = holding ? parseFloat(holding.quantity) : 0;
  const newHoldingQty = type === "buy" ? currentHolding + qty : currentHolding - qty;

  await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ balance: newBalance })
    }),
    fetch(`${supabaseUrl}/rest/v1/user_stocks?id=eq.${stock_id}`, {
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
          body: JSON.stringify({ user_id: user.id, stock_id, quantity: newHoldingQty })
        }),
    fetch(`${supabaseUrl}/rest/v1/stock_transactions`, {
      method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ stock_id, user_id: user.id, type, quantity: qty, price: total / qty })
    })
  ]);

  // Egasiga 2% royalty (o'zi savdo qilmasa)
  if (stock.owner_id !== user.id) {
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

  // Yangi narx boshqa kutayotgan limit/SL/TP buyurtmalarni ishga tushirishi mumkin
  try { await fillPendingOrders(stock_id, price, supabaseUrl, serviceKey); } catch (e) {}

  return res.status(200).json({ success: true, newPrice: price, total, newBalance });
}

function priceAt(basePrice, supply) {
  return basePrice * (1 + supply * 0.01);
}

function isMarketOpen() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const tashkent = new Date(utcMs + 5 * 60 * 60000);
  const day = tashkent.getDay();
  const hour = tashkent.getHours();
  if (day === 0 || day === 6) return false;
  return hour >= 9 && hour < 18;
}

async function getUserFromToken(token, supabaseUrl, serviceKey) {
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function ensureProfile(userId, supabaseUrl, serviceKey) {
  const existing = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  }).then((r) => r.json());

  if (!Array.isArray(existing) || existing.length === 0) {
    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ id: userId, balance: 100 })
    });
  }
      }
