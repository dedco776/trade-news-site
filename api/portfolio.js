export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Server sozlanmagan" });
  }

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Avval tizimga kiring" });

  const user = await getUserFromToken(token, supabaseUrl, serviceKey);
  if (!user) return res.status(401).json({ error: "Sessiya yaroqsiz, qayta kiring" });

  await ensureProfile(user.id, supabaseUrl, serviceKey);

  const [profileRes, holdingsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json()),
    fetch(
      `${supabaseUrl}/rest/v1/stock_holdings?user_id=eq.${user.id}&quantity=gt.0&select=*,user_stocks(name,ticker,current_price)`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ).then((r) => r.json())
  ]);

  const profile = profileRes?.[0] || { balance: 100 };

  return res.status(200).json({ balance: profile.balance, holdings: holdingsRes || [] });
}

async function getUserFromToken(token, supabaseUrl, serviceKey) {
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function ensureProfile(userId, supabaseUrl, serviceKey) {
  const existing = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  ).then((r) => r.json());

  if (!Array.isArray(existing) || existing.length === 0) {
    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal"
      },
      body: JSON.stringify({ id: userId, balance: 100 })
    });
  }
      }
