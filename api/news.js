export default async function handler(req, res) {
  // Vercel Environment Variables'dan FINNHUB_API_KEY ni oladi
  const apiKey = process.env.FINNHUB_API_KEY; 
  const symbol = req.query.symbol || 'AAPL';

  if (!apiKey) {
    return res.status(500).json({ error: "FINNHUB_API_KEY Vercel sozlamalarida topilmadi!" });
  }

  try {
    // 1. Finnhub Yangiliklarini olish
    const newsRes = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=2024-01-01&to=2026-12-31&token=${apiKey}`
    );
    const newsData = await newsRes.json();

    // 2. Finnhub Narx ma'lumotlarini (Quote) olish
    const quoteRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
    );
    const quoteData = await quoteRes.json();

    // Ma'lumotlarni HTML ga qaytarish
    return res.status(200).json({
      news: Array.isArray(newsData) ? newsData.slice(0, 5) : [],
      price: quoteData ? quoteData.c : null
    });
  } catch (error) {
    return res.status(500).json({ error: "Finnhub ma'lumotlarini olishda xatolik yuz berdi" });
  }
}
