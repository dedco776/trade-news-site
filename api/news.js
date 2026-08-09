export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const symbol = req.query.symbol || 'AAPL';
  const lang = req.query.lang || 'uz';

  if (!apiKey) {
    return res.status(500).json({ error: "FINNHUB_API_KEY topilmadi" });
  }

  try {
    // 1. Finnhub Yangiliklarini olish
    const newsRes = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=2024-01-01&to=2026-12-31&token=${apiKey}`
    );
    const newsData = await newsRes.json();
    let rawNews = Array.isArray(newsData) ? newsData.slice(0, 4) : [];

    // 2. Yangilik sarlavhasi va qisqacha mazmunini tanlangan tilga tarjima qilish
    const translatedNews = await Promise.all(
      rawNews.map(async (item) => {
        if (lang === 'en') return item;
        try {
          const targetLang = lang === 'uz' ? 'uz' : 'ru';
          const headlineTr = await translateText(item.headline, targetLang);
          const summaryTr = await translateText(item.summary, targetLang);
          return {
            ...item,
            headline: headlineTr || item.headline,
            summary: summaryTr || item.summary
          };
        } catch (e) {
          return item;
        }
      })
    );

    // 3. Finnhub Quote (Real Narx)
    const quoteRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
    );
    const quoteData = await quoteRes.json();

    return res.status(200).json({
      news: translatedNews,
      price: quoteData ? quoteData.c : null
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}

// Bepul Google Translate API orqali tarjima qilish funksiyasi
async function translateText(text, targetLang) {
  if (!text) return "";
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await res.json();
    return data[0].map((item) => item[0]).join("");
  } catch (err) {
    return text;
  }
}
