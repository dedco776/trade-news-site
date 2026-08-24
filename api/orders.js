export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Avval tizimga kiring" });

  const user = await getUserFromToken(token, supabaseUrl, serviceKey);
  if (!user) return res.status(401).json({ error: "Sessiya yaroqsiz, qayta kiring" });

  if (req.method === "GET") {
    const { stock_id } = req.query;
    const filter = stock_id ? `&stock_id=eq.${stock_id}` : "";
    const orders = await fetch(
      `${supabaseUrl}/rest/v1/stock_orders?user_id=eq.${user.id}&status=eq.pending${filter}&select=*,user_stocks(ticker,name)&order=created_at.desc`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ).then((r) => r.json());
    return res.status(200).json({ orders: orders || [] });
  }

  if (req.method === "DELETE") {
    const { order_id } = req.body || {};
    if (!order_id) return res.status(400).json({ error: "order_id kerak" });

    const check = await fetch(`${supabaseUrl}/rest/v1/stock_orders?id=eq.${order_id}&select=user_id`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json());

    if (!check?.[0] || check[0].user_id !== user.id) {
      return res.status(403).json({ error: "Ruxsat yo'q" });
    }

    await fetch(`${supabaseUrl}/rest/v1/stock_orders?id=eq.${order_id}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "cancelled" })
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
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
