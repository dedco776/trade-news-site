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
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });

  try {
    const stocks = await fetch(
      `${supabaseUrl}/rest/v1/user_stocks?select=*`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ).then((r) => r.json());

    if (!Array.isArray(stocks)) return res.status(200).json({ ticked: 0 });

    const now = Date.now();
    let ticked = 0;

    for (const stock of stocks) {
      const lastRun = new Date(stock.last_bot_run || stock.created_at).getTime();
      // Har 30 soniyada bir marta ishga tushadi (avval 2 daqiqa edi — juda kam edi)
      if (now - lastRun < 30 * 1000) continue;

      let supply = parseFloat(stock.total_supply);
