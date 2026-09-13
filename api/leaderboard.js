const CACHE_ID = "leaderboard_v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });

  try {
    const cached = await fetch(`${supabaseUrl}/rest/v1/leaderboard_cache?id=eq.${CACHE_ID}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json());

    const row = cached?.[0];
    if (row && Date.now() - new Date(row.updated_at).getTime() < CACHE_TTL_MS) {
      return res.status(200).json(row.data);
    }

    const [profiles, holdings] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/profiles?select=id,balance,level,exp,active_frame`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json()),
      fetch(`${supabaseUrl}/rest/v1/stock_holdings?quantity=gt.0&select=user_id,quantity,user_stocks(current_price)`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json())
    ]);

    const holdingsValueByUser = {};
    if (Array.isArray(holdings)) {
      for (const h of holdings) {
        const val = parseFloat(h.quantity) * parseFloat(h.user_stocks?.current_price || 0);
        holdingsValueByUser[h.user_id] = (holdingsValueByUser[h.user_id] || 0) + val;
      }
    }

    const ranked = (Array.isArray(profiles) ? profiles : [])
      .map((p) => ({
        id: p.id,
        level: p.level || 1,
        exp: p.exp || 0,
        activeFrame: p.active_frame || 'none',
        netWorth: parseFloat(p.balance || 0) + (holdingsValueByUser[p.id] || 0)
      }))
      .sort((a, b) => b.netWorth - a.netWorth)
      .slice(0, 20);

    // Ismlarni olamiz (Supabase Auth admin API)
    const withNames = await Promise.all(
      ranked.map(async (r) => {
        try {
          const ur = await fetch(`${supabaseUrl}/auth/v1/admin/users/${r.id}`, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
          });
          if (ur.ok) {
            const ud = await ur.json();
            return { ...r, name: ud?.user_metadata?.name || ud?.email?.split("@")[0] || "Foydalanuvchi" };
          }
        } catch (e) {}
        return { ...r, name: "Foydalanuvchi" };
      })
    );

    const data = { leaders: withNames, updatedAt: new Date().toISOString() };

    await fetch(`${supabaseUrl}/rest/v1/leaderboard_cache`, {
      method: "POST",
      headers: {
        apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({ id: CACHE_ID, data, updated_at: new Date().toISOString() })
    });

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
            }
