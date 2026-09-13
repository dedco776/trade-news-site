import { createNotification } from "./notifications.js";

const DAILY_BONUS_AMOUNT = 10;
const DAILY_BONUS_EXP = 10;

export default async function handler(req, res) {
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

  if (req.method === "PATCH") {
    const { active_frame } = req.body || {};
    const profile = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=level`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json());
    const level = profile?.[0]?.level || 1;
    const maxTier = Math.floor(level / 5);
    const requestedTier = parseInt(active_frame, 10) || 0;
    if (requestedTier > maxTier) return res.status(403).json({ error: "Bu ramka hali ochilmagan" });

    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ active_frame: String(requestedTier) })
    });
    return res.status(200).json({ success: true });
  }

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let [profileRes, holdingsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json()),
    fetch(
      `${supabaseUrl}/rest/v1/stock_holdings?user_id=eq.${user.id}&quantity=gt.0&select=*,user_stocks(name,ticker,current_price)`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ).then((r) => r.json())
  ]);

  let profile = profileRes?.[0] || { balance: 100, exp: 0, level: 1, active_frame: 'none' };

  // Kunlik kirish bonusi — har kuni birinchi tekshiruvda beriladi
  let dailyBonusGiven = false;
  const todayStr = new Date().toISOString().slice(0, 10);
  if (profile.last_daily_bonus_date !== todayStr) {
    const newBalance = parseFloat(profile.balance || 0) + DAILY_BONUS_AMOUNT;
    const newExp = parseInt(profile.exp || 0, 10) + DAILY_BONUS_EXP;
    const newLevel = Math.floor(newExp / 100) + 1;

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ balance: newBalance, exp: newExp, level: newLevel, last_daily_bonus_date: todayStr })
    });

    if (patchRes.ok) {
      const patched = await patchRes.json();
      profile = patched?.[0] || { ...profile, balance: newBalance, exp: newExp, level: newLevel };
      dailyBonusGiven = true;
      await createNotification(
        user.id, 'daily_bonus',
        `Kunlik bonus: $${DAILY_BONUS_AMOUNT} va ${DAILY_BONUS_EXP} EXP oldingiz!`,
        supabaseUrl, serviceKey
      );
    }
  }

  const level = profile.level || 1;
  const exp = profile.exp || 0;

  let rank = "Rookie";
  if (level >= 10) rank = "Market Maker";
  else if (level >= 5) rank = "Swing Specialist";

  return res.status(200).json({
    balance: profile.balance,
    holdings: holdingsRes || [],
    level,
    exp,
    expInLevel: exp % 100,
    expForNextLevel: 100,
    rank,
    activeFrame: profile.active_frame || 'none',
    maxUnlockedTier: Math.floor(level / 5),
    totalCharityGiven: profile.total_charity_given || 0,
    referralCode: profile.referral_code || null,
    dailyBonusGiven,
    dailyBonusAmount: DAILY_BONUS_AMOUNT
  });
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
      body: JSON.stringify({ id: userId, balance: 100, referral_code: userId.slice(0, 8).toUpperCase() })
    });
  }
      }
