import { fillPendingOrders } from "./market-bot.js";

async function createNotification(userId, type, message, supabaseUrl, serviceKey) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, type, message })
    });
  } catch (e) {}
}

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
    return res.status(400).json({ error: "Bozor hozir yopiq. Savdo vaqti: Dushanba-Juma, 07:00-22:00 (Toshkent vaqti)" });
  }

  const { stock_id, type, quantity, order_type, target_price, attach_sl, attach_tp } = req.body || {};
  const qty = parseInt(quantity, 10);
  const orderType = order_type || "market";
