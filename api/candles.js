export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { stock_id, interval } = req.query;

  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });
  if (!stock_id) return res.status(400).json({ error: "stock_id kerak" });

  const bucketMs = { "1m": 60000, "5m": 300000, "15m": 900000, "1d": 86400000 }[interval] || 300000;

  try {
    const [stockRes, txRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/user_stocks?id=eq.${stock_id}&select=base_price,created_at`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json()),
      fetch(
        `${supabaseUrl}/rest/v1/stock_transactions?stock_id=eq.${stock_id}&select=price,quantity,created_at&order=created_at.asc`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ).then((r) => r.json())
    ]);

    const stock = stockRes?.[0];
    if (!stock) return res.status(404).json({ error: "Aksiya topilmadi" });

    const points = [
      { price: parseFloat(stock.base_price), quantity: 0, time: new Date(stock.created_at).getTime() },
      ...(Array.isArray(txRes) ? txRes : []).map((tx) => ({
        price: parseFloat(tx.price),
        quantity: parseFloat(tx.quantity),
        time: new Date(tx.created_at).getTime()
      }))
    ];

    // Nuqtalarni vaqt bo'yicha bucket'larga (shamlarga) yig'amiz
    const buckets = new Map();
    for (const p of points) {
      const bucketTime = Math.floor(p.time / bucketMs) * bucketMs;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, { open: p.price, high: p.price, low: p.price, close: p.price, volume: 0, time: bucketTime });
      }
      const b = buckets.get(bucketTime);
      b.high = Math.max(b.high, p.price);
      b.low = Math.min(b.low, p.price);
      b.close = p.price;
      b.volume += p.quantity;
    }

    const candles = Array.from(buckets.values()).sort((a, b) => a.time - b.time);

    // Lightweight Charts sekundlarda vaqt kutadi
    const formatted = candles.map((c) => ({
      time: Math.floor(c.time / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));

    return res.status(200).json({ candles: formatted });
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
  }
