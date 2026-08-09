export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // To'lov xizmati URL manzili (Stripe/Payme/Click va h.k.)
    return res.status(200).json({ 
      url: 'https://t.me/dedco_trading_bot' // Bot yoki to'lov sahifasi havolasi
    });
  } catch (error) {
    return res.status(500).json({ error: 'To\'lov jarayonida xatolik' });
  }
}
