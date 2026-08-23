export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Server sozlanmagan" });
  }

  if (req.method === "GET") {
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/user_stocks?select=*&order=created_at.desc`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      const stocks = await r.json();
      return res.status(200).json({ stocks });
    } catch (e) {
      return res.status(500).json({ error: "Server xatosi" });
    }
  }

  if (req.method === "POST") {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Aksiya yaratish uchun avval tizimga kiring" });

    const user = await getUserFromToken(token, supabaseUrl, serviceKey);
    if (!user) return res.status(401).json({ error: "Sessiya yaroqsiz, qayta kiring" });

    const { name, ticker, category } = req.body || {};
    if (!name || !ticker || ticker.length > 6) {
      return res.status(400).json({ error: "Nom va qisqa ticker (max 6 belgi) kerak" });
    }

    await ensureProfile(user.id, supabaseUrl, serviceKey);

    // 1. Bu user allaqachon aksiya yaratganmi?
    const ownerCheck = await fetch(
      `${supabaseUrl}/rest/v1/user_stocks?owner_id=eq.${user.id}&select=id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ).then((r) => r.json());

    if (Array.isArray(ownerCheck) && ownerCheck.length > 0) {
      return res.status(400).json({ error: "Siz allaqachon aksiya yaratgansiz — bitta userga faqat bitta aksiya ruxsat etiladi" });
    }

    // 2. Nom yoki ticker band emasmi? (katta-kichik harfga qaramay)
    const tickerUpper = ticker.toUpperCase();
    const [nameCheck, tickerCheck] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/user_stocks?name=ilike.${encodeURIComponent(name)}&select=id`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json()),
      fetch(`${supabaseUrl}/rest/v1/user_stocks?ticker=eq.${tickerUpper}&select=id`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json())
    ]);

    if (Array.isArray(nameCheck) && nameCheck.length > 0) {
      return res.status(400).json({ error: "Bu nom band, boshqasini tanlang" });
    }
    if (Array.isArray(tickerCheck) && tickerCheck.length > 0) {
      return res.status(400).json({ error: "Bu ticker band, boshqasini tanlang" });
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/user_stocks`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        owner_id: user.id,
        name,
        ticker: tickerUpper,
        category: category || "Boshqa",
        base_price: 10,
        current_price: 10,
        total_supply: 0
      })
    });

    if (!insertRes.ok) {
      return res.status(400).json({ error: "Nom yoki ticker band, yoki siz allaqachon aksiya yaratgansiz" });
    }

    const created = await insertRes.json();
    return res.status(200).json({ stock: created[0] });
  }

  return res.status(405).json({ error: "Method not allowed" });
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
