export default function handler(req, res) {
  // Vercel Environment Variables'dan olinadi
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Environment variables topilmadi" });
  }

  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
}
