const HARAM_INDUSTRIES = [
  "banks", "insurance", "beverages - alcoholic", "gambling, resorts & casinos",
  "tobacco", "diversified financial services", "consumer finance",
  "capital markets", "mortgage finance", "thrifts & mortgage finance"
];

export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const symbol = (req.query.symbol || "AAPL").toUpperCase();

  if (!apiKey) return res.status(500).json({ error: "FINNHUB_API_KEY topilmadi" });

  try {
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`)
    ]);

    const quote = await quoteRes.json();
    const profile = await profileRes.json();

    const industry = (profile?.finnhubIndustry || "").toLowerCase();
    const isHaram = HARAM_INDUSTRIES.some((h) => industry.includes(h));

    return res.status(200).json({
      symbol,
      name: profile?.name || symbol,
      industry: profile?.finnhubIndustry || null,
      halalStatus: isHaram ? "Haram" : "Halal",
      halalLevel: isHaram ? "haram" : "halal",
      price: quote?.c ?? null,
      entry: quote?.c ?? null,
      tp: quote?.h ?? null,   // kunlik yuqori narx — qarshilik nuqtasi
      sl: quote?.l ?? null,   // kunlik past narx — tayanch nuqtasi
      changePct: quote?.dp ?? null
    });
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
}
