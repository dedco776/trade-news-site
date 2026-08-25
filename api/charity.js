export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Avval tizimga kiring" });

  const user = await getUserFromToken(token, supabaseUrl, serviceKey);
  if (!user) return res.status(401).json({ error: "Sessiya yaroqsiz, qayta kiring" });

  const { type, amount, stock_id } = req.body || {};
  const donationAmount = parseFloat(amount);

  if (!["purification", "zakat"].includes(type) || !donationAmount || donationAmount <= 0) {
    return res.status(400).json({ error: "Noto'g'ri so'rov" });
  }

  const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  }).then((r) => r.json());

  const profile = profileRes?.[0];
  if (!profile) return res.status(400).json({ error: "Profil topilmadi" });
  if (donationAmount > parseFloat(profile.balance)) {
    return res.status(400).json({ error: "Balansingiz yetarli emas" });
  }

  const newBalance = parseFloat(profile.balance) - donationAmount;
  const newTotalCharity = parseFloat(profile.total_charity_given || 0) + donationAmount;

  const patchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ balance: newBalance, total_charity_given: newTotalCharity })
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    return res.status(500).json({ error: "Xatolik: " + errText });
  }

  await fetch(`${supabaseUrl}/rest/v1/charity_log`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: user.id, type, amount: donationAmount, stock_id: stock_id || null })
  });

  return res.status(200).json({ success: true, newBalance, newTotalCharity });
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
