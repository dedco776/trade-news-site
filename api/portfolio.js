async function createNotification(userId, type, message, supabaseUrl, serviceKey) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, type, message })
    });
  } catch (e) {}
}

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
