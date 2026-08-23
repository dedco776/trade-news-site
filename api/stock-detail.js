export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { id } = req.query;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Server sozlanmagan" });
  }
  if (!id) return res.status(400).json({ error: "Aksiya id kerak" });

  try {
    const [stockRes, txRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/user_stocks?id=eq.${id}&select=*`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json()),
      fetch(
        `${supabaseUrl}/rest/v1/stock_transactions?stock_id=eq.${id}&select=type,quantity,price,created_at&order=created_at.asc`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ).then((r) => r.json())
    ]);

    const stock = stockRes?.[0];
    if (!stock) return res.status(404).json({ error: "Aksiya topilmadi" });

    const transactions = Array.isArray(txRes) ? txRes : [];

    // Narx tarixi (grafik uchun) — boshlang'ich narxdan boshlanadi
    const priceHistory = [
      { time: stock.created_at, price: parseFloat(stock.base_price) },
      ...transactions.map((tx) => ({ time: tx.created_at, price: parseFloat(tx.price) }))
    ];

    // Oddiy avtomatik texnik tahlil: birinchi va oxirgi narxni solishtiradi
    const firstPrice = priceHistory[0].price;
    const lastPrice = parseFloat(stock.current_price);
    const changePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    let trend = "neutral";
    if (changePct > 5) trend = "up";
    else if (changePct < -5) trend = "down";

    // Faoliyat lentasi — oxirgi 20 ta savdo (anonim)
    const activity = transactions
      .slice(-20)
      .reverse()
      .map((tx) => ({
        type: tx.type,
        quantity: tx.quantity,
        price: tx.price,
        time: tx.created_at
      }));

    return res.status(200).json({
      stock,
      priceHistory,
      changePct: Number(changePct.toFixed(2)),
      trend,
      activity
    });
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
        }
