import { createNotification } from "./notifications.js";

const REFERRAL_BONUS = 20;
const REFERRAL_EXP = 20;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Server sozlanmagan" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Avval tizimga kiring" });

  const user = await getUserFromToken(token, supabaseUrl, serviceKey);
  if (!user) return res.status(401).json({ error: "Sessiya yaroqsiz, qayta kiring" });

  const { referral_code } = req.body || {};
  if (!referral_code) return res.status(400).json({ error: "Referal kod kerak" });

  await ensureProfile(user.id, supabaseUrl, serviceKey);

  const myProfileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  }).then((r) => r.json());
  const myProfile = myProfileRes?.[0];

  if (!myProfile) return res.status(400).json({ error: "Profil topilmadi" });
  if (myProfile.referred_by) return res.status(400).json({ error: "Siz allaqachon referal kod ishlatgansiz" });
  if (myProfile.referral_code === referral_code.toUpperCase()) {
    return res.status(400).json({ error: "O'zingizning kodingizni ishlata olmaysiz" });
  }

  const referrerRes = await fetch(`${supabaseUrl}/rest/v1/profiles?referral_code=eq.${referral_code.toUpperCase()}&select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  }).then((r) => r.json());
  const referrer = referrerRes?.[0];

  if (!referrer) return res.status(404).json({ error: "Bunday referal kod topilmadi" });

  // Ikkalasiga ham bonus
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

async function getUserFromToken(token, supabaseUrl, serviceKey) {
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function ensureProfile(userId, supabaseUrl, serviceKey) {
  const existing = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  }).then((r) => r.json());

  if (!Array.isArray(existing) || existing.length === 0) {
    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ id: userId, balance: 100, referral_code: userId.slice(0, 8).toUpperCase() })
    });
  }
    }
