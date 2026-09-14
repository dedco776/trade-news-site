import { createNotification } from "../lib/notifications.js";

const DAILY_BONUS_AMOUNT = 10;
const DAILY_BONUS_EXP = 10;
const REFERRAL_BONUS = 20;
const REFERRAL_EXP = 20;
const LEADERBOARD_CACHE_ID = "leaderboard_v1";
const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Server sozlanmagan" });
  }

  // Leaderboard hammaga ochiq — login talab qilinmaydi
  if (req.method === "GET" && req.query.view === "leaderboard") {
    return handleLeaderboard(req, res, supabaseUrl, serviceKey);
  }

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Avval tizimga kiring" });

  const user = await getUserFromToken(token, supabaseUrl, serviceKey);
  if (!user) return res.status(401).json({ error: "Sessiya yaroqsiz, qayta kiring" });

  await ensureProfile(user.id, supabaseUrl, serviceKey);

  if (req.method === "GET" && req.query.view === "notifications") {
    return handleGetNotifications(user, res, supabaseUrl, serviceKey);
  }

  if (req.method === "POST" && req.body?.action === "mark_notifications_read") {
    await fetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ read: true })
    });
    return res.status(200).json({ success: true });
  }

  if (req.method === "POST" && req.body?.action === "apply_referral") {
    return handleApplyReferral(user, req.body?.referral_code, res, supabaseUrl, serviceKey);
  }

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

  // ===== Standart: Portfolio ma'lumotlari =====
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

  // Kunlik kirish bonusi
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

async function handleGetNotifications(user, res, supabaseUrl, serviceKey) {
  const notifications = await fetch(
    `${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=30`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  ).then((r) => r.json());
  const unreadCount = Array.isArray(notifications) ? notifications.filter((n) => !n.read).length : 0;
  return res.status(200).json({ notifications: notifications || [], unreadCount });
}

async function handleApplyReferral(user, referralCode, res, supabaseUrl, serviceKey) {
  if (!referralCode) return res.status(400).json({ error: "Referal kod kerak" });

  const myProfileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  }).then((r) => r.json());
  const myProfile = myProfileRes?.[0];
  if (!myProfile) return res.status(400).json({ error: "Profil topilmadi" });
  if (myProfile.referred_by) return res.status(400).json({ error: "Siz allaqachon referal kod ishlatgansiz" });
  if (myProfile.referral_code === referralCode.toUpperCase()) {
    return res.status(400).json({ error: "O'zingizning kodingizni ishlata olmaysiz" });
  }

  const referrerRes = await fetch(`${supabaseUrl}/rest/v1/profiles?referral_code=eq.${referralCode.toUpperCase()}&select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  }).then((r) => r.json());
  const referrer = referrerRes?.[0];
  if (!referrer) return res.status(404).json({ error: "Bunday referal kod topilmadi" });

  await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        referred_by: referrer.id,
        balance: parseFloat(myProfile.balance || 0) + REFERRAL_BONUS,
        exp: parseInt(myProfile.exp || 0, 10) + REFERRAL_EXP,
        level: Math.floor((parseInt(myProfile.exp || 0, 10) + REFERRAL_EXP) / 100) + 1
      })
    }),
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${referrer.id}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        balance: parseFloat(referrer.balance || 0) + REFERRAL_BONUS,
        exp: parseInt(referrer.exp || 0, 10) + REFERRAL_EXP,
        level: Math.floor((parseInt(referrer.exp || 0, 10) + REFERRAL_EXP) / 100) + 1
      })
    })
  ]);

  await createNotification(user.id, 'referral', `Referal bonus: $${REFERRAL_BONUS} va ${REFERRAL_EXP} EXP oldingiz!`, supabaseUrl, serviceKey);
  await createNotification(referrer.id, 'referral', `Sizning referal kodingiz orqali yangi user qo'shildi: $${REFERRAL_BONUS} va ${REFERRAL_EXP} EXP oldingiz!`, supabaseUrl, serviceKey);

  return res.status(200).json({ success: true, bonus: REFERRAL_BONUS });
}

async function handleLeaderboard(req, res, supabaseUrl, serviceKey) {
  try {
    const cached = await fetch(`${supabaseUrl}/rest/v1/leaderboard_cache?id=eq.${LEADERBOARD_CACHE_ID}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).then((r) => r.json());

    const row = cached?.[0];
    if (row && Date.now() - new Date(row.updated_at).getTime() < LEADERBOARD_CACHE_TTL_MS) {
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
      body: JSON.stringify({ id: LEADERBOARD_CACHE_ID, data, updated_at: new Date().toISOString() })
    });

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
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
