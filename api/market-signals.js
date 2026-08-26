const WATCHLIST = ["NVDA", "AAPL", "MSFT", "AMZN", "TSLA", "INTC", "SBUX", "AMD", "META", "GOOGL", "JPM", "BAC", "KO", "MCD"];

const HARAM_INDUSTRIES = [
  "banks", "insurance", "beverages - alcoholic", "gambling, resorts & casinos",
  "tobacco", "diversified financial services", "consumer finance",
  "capital markets", "mortgage finance", "thrifts & mortgage finance"
];

const CACHE_ID = "top5_signals";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) return res.status(500).json({ error: "FINNHUB_API_KEY topilmadi" });

  try {
    // 1. Keshni tekshirish
    if (supabaseUrl && serviceKey) {
      const cached = await fetch(`${supabaseUrl}/rest/v1/market_signals_cache?id=eq.${CACHE_ID}&select=*`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json());

      const row = cached?.[0];
      if (row && Date.now() - new Date(row.updated_at).getTime() < CACHE_TTL_MS) {
        return res.status(200).json(row.data);
      }
    }

    // 2. Har bir aksiya uchun narx va sektor ma'lumotini olamiz
    const results = await Promise.all(
      WATCHLIST.map(async (symbol) => {
        try {
          const [quoteRes, profileRes] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`),
            fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`)
          ]);
          const quote = await quoteRes.json();
          const profile = await profileRes.json();
          const industry = (profile?.finnhubIndustry || "").toLowerCase();
          const isHaram = HARAM_INDUSTRIES.some((h) => industry.includes(h));

          return {
            symbol,
            price: quote?.c ?? 0,
            entry: quote?.c ?? 0,
            tp: quote?.h ?? 0,
            sl: quote?.l ?? 0,
            changePct: quote?.dp ?? 0,
            halalStatus: isHaram ? "Haram" : "Halal",
            halalLevel: isHaram ? "haram" : "halal"
          };
        } catch (e) {
          return null;
        }
      })
    );

    const valid = results.filter((r) => r && r.price > 0);
    const sorted = [...valid].sort((a, b) => b.changePct - a.changePct);

    const data = {
      buyList: sorted.slice(0, 5),
      sellList: sorted.slice(-5).reverse(),
      updatedAt: new Date().toISOString()
    };

    // 3. Keshga yozamiz
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/rest/v1/market_signals_cache`, {
        method: "POST",
        headers: {
          apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({ id: CACHE_ID, data, updated_at: new Date().toISOString() })
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
            }
