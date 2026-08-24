export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { id } = req.query;

  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });
  if (!id) return res.status(400).json({ error: "Aksiya id kerak" });

  try {
    const [stockRes, txRes, holdersRes, orderBookRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/user_stocks?id=eq.${id}&select=*`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json()),
      fetch(
        `${supabaseUrl}/rest/v1/stock_transactions?stock_id=eq.${id}&select=type,quantity,price,created_at,is_bot&order=created_at.asc`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ).then((r) => r.json()),
      fetch(`${supabaseUrl}/rest/v1/stock_holdings?stock_id=eq.${id}&quantity=gt.0&select=user_id`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json()),
      fetch(`${supabaseUrl}/rest/v1/stock_orders?stock_id=eq.${id}&status=eq.pending&select=side,order_type,target_price,quantity`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).then((r) => r.json())
    ]);

    const stock = stockRes?.[0];
    if (!stock) return res.status(404).json({ error: "Aksiya topilmadi" });

    let ownerName = null;
    try {
      const ownerRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${stock.owner_id}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      });
      if (ownerRes.ok) {
        const ownerData = await ownerRes.json();
        ownerName = ownerData?.user_metadata?.name || ownerData?.email?.split("@")[0] || null;
      }
    } catch (e) {}
    stock.owner_name = ownerName;

    const transactions = Array.isArray(txRes) ? txRes : [];
    const priceHistory = [
      { time: stock.created_at, price: parseFloat(stock.base_price) },
      ...transactions.map((tx) => ({ time: tx.created_at, price: parseFloat(tx.price) }))
    ];

    const firstPrice = priceHistory[0].price;
    const lastPrice = parseFloat(stock.current_price);
    const changePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    let trend = "neutral";
    if (changePct > 5) trend = "up";
    else if (changePct < -5) trend = "down";

    // 24 soatlik statistika
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = transactions.filter((tx) => new Date(tx.created_at).getTime() >= dayAgo);
    const prices24h = last24h.map((tx) => parseFloat(tx.price));
    const high24h = prices24h.length ? Math.max(...prices24h) : lastPrice;
    const low24h = prices24h.length ? Math.min(...prices24h) : lastPrice;
    const volume24h = last24h.reduce((sum, tx) => sum + parseFloat(tx.quantity) * parseFloat(tx.price), 0);

    const marketCap = lastPrice * parseFloat(stock.total_supply);
    const holdersCount = new Set((holdersRes || []).map((h) => h.user_id)).size;

    const activity = transactions.slice(-20).reverse().map((tx) => ({
      type: tx.type, quantity: tx.quantity, price: tx.price, time: tx.created_at, is_bot: tx.is_bot
    }));

    const orderBook = Array.isArray(orderBookRes) ? orderBookRes : [];
    const buyWall = orderBook.filter((o) => o.side === "buy").sort((a, b) => b.target_price - a.target_price).slice(0, 10);
    const sellWall = orderBook.filter((o) => o.side === "sell").sort((a, b) => a.target_price - b.target_price).slice(0, 10);

    return res.status(200).json({
      stock,
      priceHistory,
      changePct: Number(changePct.toFixed(2)),
      trend,
      activity,
      orderBook: { buyWall, sellWall },
      metrics: {
        marketCap: Number(marketCap.toFixed(2)),
        high24h: Number(high24h.toFixed(2)),
        low24h: Number(low24h.toFixed(2)),
        volume24h: Number(volume24h.toFixed(2)),
        circulatingSupply: parseFloat(stock.total_supply),
        holdersCount,
        halalStatus: "100% Halal"
      }
    });
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
}
